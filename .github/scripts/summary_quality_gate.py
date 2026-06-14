#!/usr/bin/env python3
"""Mark weak or mismatched summaries without removing articles from the feed."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from summary_validation import has_extraction_garbage, summary_matches_article

LATEST_FILE = Path("latest-news.json")
NTFY_PAYLOAD_FILE = Path("ntfy-payload.json")
APP_URL = "https://cpg23.github.io/UAP/"
BAD_SUMMARY_RE = re.compile(
    r"full article text could not be reliably extracted|summary is limited to verified feed metadata|"
    r"the feed lists an article|this item tracks a |publisher text could not be safely extracted|"
    r"the headline states|the headline says|the headline is treated|based on the headline|"
    r"based only on the headline|according to the headline|the title states|the title suggests|"
    r"the article falls under|falls under the uap category|categorized as uap|uap category|"
    r"the article discusses|the article appears to|the article is about|the piece discusses|"
    r"the piece highlights|the story discusses|the story highlights|the report discusses|"
    r"the report highlights|the report appears to|available feed metadata|listed headline|"
    r"matched uap terms|for deeper context|source claim|the scanner connects|"
    r"uap news does not add details|mehrere quellen berichten über die veröffentlichung oder freigabe|"
    r"die ausführliche zusammenfassung wird beim nächsten github-scan|der artikel behandelt:",
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
    "uap uaps ufo ufos news new latest update says said about into after before over under".split()
)
MIN_SUMMARY_CHARS = 180
MISSING_SUMMARY_STATUS = {
    "articleContentSummary": "missing",
    "message": "Keine verlässliche Zusammenfassung verfügbar. Beim nächsten Scan wird automatisch erneut versucht, sie zu ergänzen.",
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


def is_good_summary(value: Any, article: dict[str, Any] | None = None) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS:
        return False
    if has_extraction_garbage(text):
        return False
    if BAD_SUMMARY_RE.search(text) or GENERIC_LEAD_RE.search(text):
        return False
    if sentence_count(text) < 2:
        return False
    if article and title_echo(text, compact(article.get("title"))):
        return False
    if article and not summary_matches_article(text, article):
        return False
    return True


def mark_missing(article: dict[str, Any]) -> None:
    article["summary"] = ""
    article["summaryStatus"] = dict(MISSING_SUMMARY_STATUS)
    article.pop("summarySource", None)
    article.pop("summaryPolicy", None)
    article.pop("translation", None)
    article.pop("translations", None)
    article.pop("translationMeta", None)


def rebuild_ntfy_payload(data: dict[str, Any]) -> None:
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
        return

    count = len(visible_articles)
    payload["title"] = f"UAP News - {count} new report{'s' if count != 1 else ''}"
    payload["message"] = "\n".join(
        f"{index + 1}. {compact(article.get('title'))}"
        for index, article in enumerate(visible_articles)
    )
    payload["click"] = APP_URL
    payload["actions"] = [{"action": "view", "label": "Open app", "url": APP_URL}]
    payload.pop("attach", None)
    payload["tags"] = ["flying_saucer"]
    NTFY_PAYLOAD_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
        else:
            mark_missing(article)
            missing.append({
                "id": article_id,
                "title": article.get("title", ""),
                "source": article.get("source", ""),
                "reason": "missing_or_mismatched_article_content_summary",
            })
        kept.append(article)

    data["articles"] = kept
    data["summaries"] = {
        article["id"]: article["summary"]
        for article in kept
        if article.get("id") and is_good_summary(article.get("summary"), article)
    }

    notification = data.get("notificationBatch")
    active_ids = {article.get("id") for article in kept if article.get("id")}
    if isinstance(notification, dict):
        notification["ids"] = [item for item in notification.get("ids", []) if item in active_ids]
        notification["articles"] = [
            item for item in notification.get("articles", [])
            if isinstance(item, dict) and item.get("id") in active_ids
        ]

    meta = data.setdefault("scanMeta", {})
    meta["summaryQualityGate"] = {
        "policy": "reject_extraction_noise_and_cross_article_summary_mismatches_v4",
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
