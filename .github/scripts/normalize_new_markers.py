#!/usr/bin/env python3
"""Normalize article/source New markers after all grouping passes.

This prevents legacy or migration timestamps from marking every retained article as
new. Only freshly notified topics or sources that are genuinely new compared with
the previous feed keep the current scan timestamp.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
PREVIOUS_FILE = Path("previous-latest-news.json")
SPACE_RE = re.compile(r"\s+")


def compact(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", compact(value).lower()).strip()


def source_key(source: dict[str, Any]) -> str:
    link = compact(source.get("link") or source.get("url"))
    if link:
        return "link:" + link.lower()
    title = title_key(source.get("title"))
    publisher = title_key(source.get("source"))
    return "title:" + publisher + ":" + title if title or publisher else ""


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "link": article.get("link") or article.get("url") or "",
        "url": article.get("url") or article.get("link") or "",
        "source": article.get("source", ""),
        "publishedAt": article.get("publishedAt") or article.get("date"),
    }


def source_items(article: dict[str, Any]) -> list[dict[str, Any]]:
    return [source_from_article(article)] + [source for source in article.get("otherSources") or [] if isinstance(source, dict)]


def source_keys(article: dict[str, Any]) -> set[str]:
    return {key for key in (source_key(source) for source in source_items(article)) if key}


def match_keys(article: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    article_id = compact(article.get("id"))
    title = title_key(article.get("title"))
    source = title_key(article.get("source"))
    if article_id:
        keys.append("id:" + article_id)
    if title:
        keys.append("title:" + title)
    if title and source:
        keys.append("source_title:" + source + ":" + title)
    return keys


def load(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"articles": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"articles": []}
    return data if isinstance(data, dict) else {"articles": []}


def previous_indexes(previous_articles: list[dict[str, Any]]) -> tuple[dict[str, set[str]], dict[str, str]]:
    by_match: dict[str, set[str]] = {}
    article_times: dict[str, str] = {}
    for article in previous_articles:
        keys = source_keys(article)
        displayed = compact(article.get("displayedAt") or article.get("publishedAt") or article.get("date"))
        for match in match_keys(article):
            by_match.setdefault(match, set()).update(keys)
            if displayed:
                article_times.setdefault(match, displayed)
    return by_match, article_times


def matched_previous_sources(article: dict[str, Any], by_match: dict[str, set[str]]) -> set[str]:
    found: set[str] = set()
    for match in match_keys(article):
        found.update(by_match.get(match, set()))
    return found


def previous_article_time(article: dict[str, Any], article_times: dict[str, str]) -> str:
    for match in match_keys(article):
        if article_times.get(match):
            return article_times[match]
    return ""


def natural_time(article: dict[str, Any], fallback: str) -> str:
    return compact(article.get("publishedAt") or article.get("date") or fallback)


def normalize_source_flags(article: dict[str, Any], previous_sources: set[str], timestamp: str) -> bool:
    current_primary_key = source_key(source_from_article(article))
    primary_is_new = bool(previous_sources and current_primary_key and current_primary_key not in previous_sources)
    if primary_is_new:
        article["sourceIsNew"] = True
        article["sourceDisplayedAt"] = timestamp
    else:
        article.pop("sourceIsNew", None)
        article["sourceDisplayedAt"] = compact(article.get("sourceDisplayedAt") or article.get("displayedAt") or natural_time(article, timestamp))

    any_new = primary_is_new
    for source in article.get("otherSources") or []:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        is_new = bool(previous_sources and key and key not in previous_sources)
        if is_new:
            source["isNew"] = True
            source["displayedAt"] = timestamp
            any_new = True
        else:
            source.pop("isNew", None)
            source["displayedAt"] = compact(source.get("publishedAt") or source.get("date") or article.get("publishedAt") or article.get("date") or source.get("displayedAt") or article.get("displayedAt") or timestamp)
    return any_new


def main() -> None:
    data = load(LATEST_FILE)
    previous = load(PREVIOUS_FILE)
    timestamp = compact(data.get("timestamp"))
    by_match, article_times = previous_indexes([article for article in previous.get("articles") or [] if isinstance(article, dict)])
    notification_ids = {compact(item) for item in ((data.get("notificationBatch") or {}).get("ids") or [])}

    corrected = 0
    new_topics = 0
    new_sources = 0
    for article in data.get("articles") or []:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        previous_sources = matched_previous_sources(article, by_match)
        had_new_source = normalize_source_flags(article, previous_sources, timestamp)
        if had_new_source:
            new_sources += 1
        if article_id in notification_ids or had_new_source:
            article["displayedAt"] = timestamp
            new_topics += 1
        else:
            article["displayedAt"] = previous_article_time(article, article_times) or natural_time(article, timestamp)
            corrected += 1

    meta = data.setdefault("scanMeta", {})
    meta["newMarkerNormalization"] = {
        "policy": "new_only_for_notification_topics_or_sources_new_vs_previous_feed",
        "correctedExistingTopics": corrected,
        "newTopics": new_topics,
        "topicsWithNewSources": new_sources,
    }
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"new marker normalization: corrected={corrected}; new_topics={new_topics}; new_source_topics={new_sources}")


if __name__ == "__main__":
    main()
