#!/usr/bin/env python3
"""Keep only app articles with real article-content summaries.

The mobile app should never show scanner/meta fallback text as a summary. If the
pipeline cannot extract enough article text to produce a content summary, the item
is removed from latest-news.json for that run instead of being shown with a weak
placeholder.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")

BAD_SUMMARY_RE = re.compile(
    r"full article text could not be reliably extracted|"
    r"summary is limited to verified feed metadata|"
    r"the feed lists an article|"
    r"this item tracks a |"
    r"publisher text could not be safely extracted|"
    r"the headline states|"
    r"the headline is treated|"
    r"the article falls under|"
    r"available feed metadata|"
    r"listed headline|"
    r"matched uap terms|"
    r"for deeper context|"
    r"source claim|"
    r"the scanner connects|"
    r"uap news does not add details",
    re.I,
)

MIN_SUMMARY_CHARS = 180


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_good_summary(value: Any) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS:
        return False
    if BAD_SUMMARY_RE.search(text):
        return False
    if len(re.findall(r"[.!?]", text)) < 2:
        return False
    return True


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    articles = data.get("articles") or []
    summaries = data.get("summaries") if isinstance(data.get("summaries"), dict) else {}

    kept = []
    removed = []
    for article in articles:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        summary = article.get("summary") or summaries.get(article_id)
        if is_good_summary(summary):
            article["summary"] = compact(summary)
            kept.append(article)
        else:
            removed.append(
                {
                    "id": article_id,
                    "title": article.get("title", ""),
                    "source": article.get("source", ""),
                    "reason": "missing_article_content_summary",
                }
            )

    active_ids = {article.get("id") for article in kept if article.get("id")}
    data["articles"] = kept
    data["summaries"] = {article["id"]: article["summary"] for article in kept if article.get("id")}

    notification = data.get("notificationBatch")
    if isinstance(notification, dict):
        notification["ids"] = [article_id for article_id in notification.get("ids", []) if article_id in active_ids]
        notification["articles"] = [
            item for item in notification.get("articles", [])
            if isinstance(item, dict) and item.get("id") in active_ids
        ]

    meta = data.setdefault("scanMeta", {})
    meta["summaryQualityGate"] = {
        "policy": "article_content_summary_required",
        "kept": len(kept),
        "removed": len(removed),
        "removedItems": removed[:20],
    }
    meta["appTopics"] = len(kept)

    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"summary quality gate: kept={len(kept)} removed={len(removed)}")


if __name__ == "__main__":
    main()
