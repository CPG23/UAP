#!/usr/bin/env python3
"""Synchronize validated summaries and apply the final feed ordering."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from summary_validation import has_extraction_garbage, summary_matches_article

LATEST_FILE = Path("latest-news.json")
MIN_SUMMARY_CHARS = 180
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
    r"uap news does not add details|der artikel behandelt:",
    re.I,
)
GENERIC_LEAD_RE = re.compile(
    r"^(this|the)\s+(article|piece|story|report|headline|title)\s+"
    r"(states|says|discusses|highlights|appears|covers|focuses|is about|falls under)",
    re.I,
)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_good_summary(value: Any, article: dict[str, Any] | None = None) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS or has_extraction_garbage(text):
        return False
    if BAD_SUMMARY_RE.search(text) or GENERIC_LEAD_RE.search(text):
        return False
    if len(re.findall(r"[.!?](?:\s|$)", text)) < 2:
        return False
    return not article or summary_matches_article(text, article)


def clear_summary(article: dict[str, Any]) -> None:
    article["summary"] = ""
    article["summaryStatus"] = {"articleContentSummary": "missing"}
    article.pop("summarySource", None)
    article.pop("summaryPolicy", None)
    article.pop("translation", None)
    article.pop("translations", None)
    article.pop("translationMeta", None)


def source_key(source: dict[str, Any]) -> str:
    return compact(source.get("link") or source.get("url") or source.get("title")).lower()


def source_count(article: dict[str, Any]) -> int:
    seen: set[str] = set()
    primary = source_key(article)
    if primary:
        seen.add(primary)
    for source in article.get("otherSources") or []:
        if isinstance(source, dict):
            key = source_key(source)
            if key:
                seen.add(key)
    return max(1, len(seen))


def sort_key(article: dict[str, Any]) -> tuple[int, int, str]:
    try:
        quality = int(article.get("quality") or article.get("sourceQuality") or 0)
    except (TypeError, ValueError):
        quality = 0
    return (
        source_count(article),
        quality,
        compact(article.get("publishedAt") or article.get("date") or article.get("displayedAt")),
    )


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    summaries = data.get("summaries") if isinstance(data.get("summaries"), dict) else {}
    updated = 0
    cleared_translations = 0
    order_before = [compact(a.get("id") or a.get("title")) for a in data.get("articles") or [] if isinstance(a, dict)]

    for article in data.get("articles") or []:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        canonical = compact(summaries.get(article_id))
        visible = compact(article.get("summary"))
        canonical_good = bool(article_id and is_good_summary(canonical, article))
        visible_good = is_good_summary(visible, article)
        if not canonical_good and not visible_good:
            clear_summary(article)
            if article_id:
                summaries.pop(article_id, None)
            updated += 1
            cleared_translations += 1
            continue
        if not canonical_good or visible == canonical:
            continue
        if not visible_good or len(canonical) >= len(visible) or article.get("summarySource") == "source_page":
            article["summary"] = canonical
            article.pop("summaryStatus", None)
            article.pop("translation", None)
            article.pop("translations", None)
            article.pop("translationMeta", None)
            article["summarySource"] = article.get("summarySource") or "canonical_summary_map"
            updated += 1
            cleared_translations += 1

    for article in data.get("articles") or []:
        if isinstance(article, dict):
            article["mentions"] = source_count(article)
    data["articles"].sort(key=sort_key, reverse=True)
    order_after = [compact(a.get("id") or a.get("title")) for a in data.get("articles") or [] if isinstance(a, dict)]
    reordered = order_before != order_after

    if updated or reordered:
        meta = data.setdefault("scanMeta", {})
        meta["finalVisibleSummarySync"] = {
            "policy": "validated_summaries_then_source_count_quality_date_sort_v3",
            "updatedArticles": updated,
            "clearedTranslations": cleared_translations,
            "reorderedBySourceCount": reordered,
        }
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"final visible summary sync: updated={updated}; reordered_by_source_count={reordered}")


if __name__ == "__main__":
    main()
