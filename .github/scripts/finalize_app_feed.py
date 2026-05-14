#!/usr/bin/env python3
"""Apply the final app-feed contract before translations are prepared.

The mobile app should receive display-ready data. This pass keeps the browser from
becoming a second data pipeline by enforcing the basic contract in latest-news.json:
unique top-level titles, deduped sources, correct source counts, synced summaries,
quality-based ordering, and push payloads that only mention visible app articles.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
NTFY_PAYLOAD_FILE = Path("ntfy-payload.json")
APP_URL = "https://cpg23.github.io/UAP/"
SPACE_RE = re.compile(r"\s+")
BAD_SUMMARY_RE = re.compile(
    r"full article text could not be reliably extracted|"
    r"summary is limited to verified feed metadata|"
    r"the feed lists an article|"
    r"this item tracks a |"
    r"publisher text could not be safely extracted|"
    r"the headline states|"
    r"the headline says|"
    r"the headline is treated|"
    r"based on the headline|"
    r"based only on the headline|"
    r"according to the headline|"
    r"the title states|"
    r"the title suggests|"
    r"the article falls under|"
    r"falls under the uap category|"
    r"categorized as uap|"
    r"uap category|"
    r"the article discusses|"
    r"the article appears to|"
    r"the article is about|"
    r"the piece discusses|"
    r"the piece highlights|"
    r"the story discusses|"
    r"the story highlights|"
    r"the report discusses|"
    r"the report highlights|"
    r"the report appears to|"
    r"available feed metadata|"
    r"listed headline|"
    r"matched uap terms|"
    r"for deeper context|"
    r"source claim|"
    r"the scanner connects|"
    r"uap news does not add details|"
    r"mehrere quellen berichten über die veröffentlichung oder freigabe|"
    r"die ausführliche zusammenfassung wird beim nächsten github-scan|"
    r"der artikel behandelt:",
    re.I,
)
MIN_SUMMARY_CHARS = 180


def compact(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", compact(value).lower()).strip()


def source_key(source: dict[str, Any]) -> str:
    return compact(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "url": article.get("url") or article.get("link", ""),
        "link": article.get("link") or article.get("url", ""),
        "source": article.get("source", ""),
        "publishedAt": article.get("publishedAt") or article.get("detectedAt") or article.get("date"),
    }


def dedupe_sources(sources: list[dict[str, Any]], primary_title: str = "") -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    primary = title_key(primary_title)
    for source in sources:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key in seen:
            continue
        if primary and title_key(source.get("title")) == primary:
            continue
        seen.add(key)
        result.append(source)
    return result


def is_good_summary(value: Any) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS:
        return False
    if BAD_SUMMARY_RE.search(text):
        return False
    if len(re.findall(r"[.!?]", text)) < 2:
        return False
    return True


def parse_quality(article: dict[str, Any]) -> int:
    try:
        return int(article.get("quality") or article.get("sourceQuality") or 0)
    except (TypeError, ValueError):
        return 0


def parse_time(article: dict[str, Any]) -> str:
    return compact(article.get("publishedAt") or article.get("date") or "")


def merge_article(target: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    incoming_sources = [source_from_article(incoming)] + [
        source for source in incoming.get("otherSources") or [] if isinstance(source, dict)
    ]
    sources = dedupe_sources((target.get("otherSources") or []) + incoming_sources, target.get("title", ""))
    target["otherSources"] = sources
    target["mentions"] = max(int(target.get("mentions") or 1), int(incoming.get("mentions") or 1), 1 + len(sources))
    target["clusterTitles"] = [compact(source.get("title")) for source in sources if compact(source.get("title"))][:10]
    if len(compact(incoming.get("summary"))) > len(compact(target.get("summary"))):
        target["summary"] = incoming.get("summary", "")
    if parse_quality(incoming) > parse_quality(target):
        target["quality"] = parse_quality(incoming)
        target["sourceQuality"] = parse_quality(incoming)
        if incoming.get("qualityBreakdown"):
            target["qualityBreakdown"] = incoming.get("qualityBreakdown")
    return target


def normalize_article(article: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(article, dict) or not compact(article.get("title")):
        return None
    if not is_good_summary(article.get("summary")):
        return None
    article["title"] = compact(article.get("title"))
    article["summary"] = compact(article.get("summary"))
    article["source"] = compact(article.get("source")) or "UAP News"
    article["otherSources"] = dedupe_sources(article.get("otherSources") or [], article["title"])
    article["mentions"] = max(1, 1 + len(article["otherSources"]))
    article["clusterTitles"] = [compact(source.get("title")) for source in article["otherSources"] if compact(source.get("title"))][:10]
    article["quality"] = parse_quality(article)
    article["sourceQuality"] = article["quality"]
    article.pop("summaryStatus", None)
    return article


def normalize_articles(raw_articles: list[Any]) -> list[dict[str, Any]]:
    by_title: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for raw in raw_articles:
        article = normalize_article(raw)
        if not article:
            continue
        key = title_key(article.get("title"))
        if key not in by_title:
            by_title[key] = article
            order.append(key)
        else:
            merge_article(by_title[key], article)
    articles = [by_title[key] for key in order]
    articles.sort(key=lambda article: (parse_quality(article), parse_time(article)), reverse=True)
    return articles


def update_notification(data: dict[str, Any], visible_articles: list[dict[str, Any]]) -> None:
    visible_by_id = {compact(article.get("id")): article for article in visible_articles if compact(article.get("id"))}
    notification = data.get("notificationBatch") if isinstance(data.get("notificationBatch"), dict) else {}
    ids = [compact(article_id) for article_id in notification.get("ids", []) if compact(article_id) in visible_by_id]
    notification["ids"] = ids
    notification["articles"] = [
        {"id": article_id, "title": visible_by_id[article_id].get("title", ""), "source": visible_by_id[article_id].get("source", "UAP News")}
        for article_id in ids
    ]
    data["notificationBatch"] = notification

    if not NTFY_PAYLOAD_FILE.exists():
        return
    if not ids:
        NTFY_PAYLOAD_FILE.unlink(missing_ok=True)
        return
    payload = json.loads(NTFY_PAYLOAD_FILE.read_text(encoding="utf-8"))
    listed = [visible_by_id[article_id] for article_id in ids[:10]]
    payload["title"] = f"UAP News - {len(listed)} new report{'s' if len(listed) != 1 else ''}"
    payload["message"] = "\n".join(f"{index + 1}. {article.get('title', '')}" for index, article in enumerate(listed))
    payload["click"] = APP_URL
    payload["actions"] = [{"action": "view", "label": "Open app", "url": APP_URL}]
    payload.pop("attach", None)
    NTFY_PAYLOAD_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    original_count = len(data.get("articles") or [])
    articles = normalize_articles(data.get("articles") or [])
    data["articles"] = articles
    data["summaries"] = {article["id"]: article["summary"] for article in articles if article.get("id")}
    update_notification(data, articles)
    meta = data.setdefault("scanMeta", {})
    meta["finalAppFeedContract"] = {
        "policy": "display_ready_feed_v1",
        "inputArticles": original_count,
        "outputArticles": len(articles),
        "sort": "quality_desc_then_publishedAt_desc",
        "summary": "article_content_summary_required",
    }
    meta["appTopics"] = len(articles)
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"final app feed contract: input={original_count}; output={len(articles)}")


if __name__ == "__main__":
    main()
