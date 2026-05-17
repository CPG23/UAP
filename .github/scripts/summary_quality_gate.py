#!/usr/bin/env python3
"""Mark weak summaries without removing articles from the app feed.

The mobile app should never show scanner/meta fallback text as a summary. If the
pipeline cannot extract enough article text to produce a content summary, the item
stays visible and is marked so the app can show a clear placeholder. Later scans
will keep trying to repair the summary.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
NTFY_PAYLOAD_FILE = Path("ntfy-payload.json")
APP_URL = "https://cpg23.github.io/UAP/"

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
GENERIC_LEAD_RE = re.compile(
    r"^(this|the)\s+(article|piece|story|report|headline|title)\s+"
    r"(states|says|discusses|highlights|appears|covers|focuses|is about|falls under)",
    re.I,
)
WORD_RE = re.compile(r"[a-z0-9]+", re.I)
STOP_WORDS = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might this that these those article report story piece headline title "
    "uap uaps ufo ufos news new latest update says said about into after before over under"
    .split()
)
MIN_SUMMARY_CHARS = 180
MISSING_SUMMARY_STATUS = {
    "articleContentSummary": "missing",
    "message": "Keine verlässliche Zusammenfassung verfügbar. GitHub versucht beim nächsten Scan automatisch, diese zu ergänzen.",
}


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def words(value: Any) -> set[str]:
    return {
        word.lower()
        for word in WORD_RE.findall(compact(value))
        if len(word) > 2 and word.lower() not in STOP_WORDS
    }


def sentence_count(text: str) -> int:
    return len(re.findall(r"[.!?](?:\s|$)", text))


def title_echo(summary: str, title: str) -> bool:
    summary_words = words(summary)
    title_words = words(title)
    if not summary_words or not title_words:
        return False
    overlap = len(summary_words & title_words) / max(1, min(len(summary_words), len(title_words)))
    return overlap >= 0.82 and len(summary_words) < 42


def has_content_overlap(summary: str, article: dict[str, Any]) -> bool:
    source_text = " ".join(
        compact(part)
        for part in [
            article.get("title"),
            article.get("description"),
            " ".join(compact(src.get("title")) for src in article.get("otherSources", []) if isinstance(src, dict)),
        ]
        if compact(part)
    )
    source_words = words(source_text)
    summary_words = words(summary)
    if not source_words or not summary_words:
        return True
    shared = source_words & summary_words
    return len(shared) >= 3 or len(shared) / max(1, min(len(source_words), len(summary_words))) >= 0.18


def is_good_summary(value: Any, article: dict[str, Any] | None = None) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS:
        return False
    if BAD_SUMMARY_RE.search(text) or GENERIC_LEAD_RE.search(text):
        return False
    if sentence_count(text) < 2:
        return False
    if article and title_echo(text, compact(article.get("title"))):
        return False
    if article and not has_content_overlap(text, article):
        return False
    return True


def mark_missing(article: dict[str, Any]) -> None:
    article["summary"] = ""
    article["summaryStatus"] = dict(MISSING_SUMMARY_STATUS)


def rebuild_ntfy_payload(data: dict[str, Any]) -> None:
    """Make the push notification match only top-level articles visible in the app."""
    if not NTFY_PAYLOAD_FILE.exists():
        return

    try:
        payload = json.loads(NTFY_PAYLOAD_FILE.read_text(encoding="utf-8"))
    except Exception:
        NTFY_PAYLOAD_FILE.unlink(missing_ok=True)
        return

    notification = data.get("notificationBatch") if isinstance(data.get("notificationBatch"), dict) else {}
    notification_ids = [compact(item) for item in notification.get("ids", [])]
    visible_by_id = {
        compact(article.get("id")): article
        for article in data.get("articles", [])
        if isinstance(article, dict) and compact(article.get("id"))
    }
    visible_articles = [visible_by_id[item_id] for item_id in notification_ids if item_id in visible_by_id][:10]

    if not visible_articles:
        NTFY_PAYLOAD_FILE.unlink(missing_ok=True)
        print("summary quality gate: removed ntfy payload because no notified articles remain visible")
        return

    title_count = len(visible_articles)
    payload["title"] = f"UAP News - {title_count} new report{'s' if title_count != 1 else ''}"
    payload["message"] = "\n".join(
        f"{index + 1}. {compact(article.get('title'))}"
        for index, article in enumerate(visible_articles)
    )
    payload["click"] = APP_URL
    payload["actions"] = [{"action": "view", "label": "Open app", "url": APP_URL}]
    payload.pop("attach", None)
    payload["tags"] = ["flying_saucer"]

    NTFY_PAYLOAD_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"summary quality gate: rebuilt ntfy payload from {title_count} visible app articles")


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    articles = data.get("articles") or []
    summaries = data.get("summaries") if isinstance(data.get("summaries"), dict) else {}

    kept = []
    missing = []
    for article in articles:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        summary = article.get("summary") or summaries.get(article_id)
        if is_good_summary(summary, article):
            article["summary"] = compact(summary)
            article.pop("summaryStatus", None)
            kept.append(article)
        else:
            mark_missing(article)
            kept.append(article)
            missing.append(
                {
                    "id": article_id,
                    "title": article.get("title", ""),
                    "source": article.get("source", ""),
                    "reason": "missing_article_content_summary_kept_visible",
                }
            )

    data["articles"] = kept
    data["summaries"] = {article["id"]: article["summary"] for article in kept if article.get("id") and is_good_summary(article.get("summary"), article)}

    notification = data.get("notificationBatch")
    active_ids = {article.get("id") for article in kept if article.get("id")}
    if isinstance(notification, dict):
        notification["ids"] = [article_id for article_id in notification.get("ids", []) if article_id in active_ids]
        notification["articles"] = [
            item for item in notification.get("articles", [])
            if isinstance(item, dict) and item.get("id") in active_ids
        ]

    meta = data.setdefault("scanMeta", {})
    meta["summaryQualityGate"] = {
        "policy": "missing_article_content_summary_kept_visible_for_retry",
        "kept": len(kept),
        "missing": len(missing),
        "missingItems": missing[:20],
    }
    meta["appTopics"] = len(kept)

    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rebuild_ntfy_payload(data)
    print(f"summary quality gate: kept={len(kept)} missing={len(missing)}")


if __name__ == "__main__":
    main()
