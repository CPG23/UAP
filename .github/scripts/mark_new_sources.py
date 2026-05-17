#!/usr/bin/env python3
"""Mark newly added sources inside existing visible topics.

The app marks a topic as "New" when a new source makes it newly relevant again.
This pass adds the same 24-hour display timestamp at source level, so the opened
source list can show exactly which source was newly added.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
PREVIOUS_FILE = Path("previous-latest-news.json")
SPACE_RE = re.compile(r"\s+")


DISPLAY_TIME_FIELDS = (
    "displayedAt",
    "sourceDisplayedAt",
    "firstDisplayedAt",
    "detectedAt",
    "createdAt",
    "timestamp",
    "publishedAt",
    "date",
)


SOURCE_TIME_FIELDS = (
    "displayedAt",
    "sourceDisplayedAt",
    "firstDisplayedAt",
    "detectedAt",
    "createdAt",
)


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
    if title or publisher:
        return "title:" + publisher + ":" + title
    return ""


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "url": article.get("url") or article.get("link", ""),
        "link": article.get("link") or article.get("url", ""),
        "source": article.get("source", ""),
        "displayedAt": article.get("sourceDisplayedAt") or article.get("displayedAt"),
        "sourceDisplayedAt": article.get("sourceDisplayedAt"),
        "publishedAt": article.get("publishedAt") or article.get("detectedAt") or article.get("date"),
    }


def source_items(article: dict[str, Any]) -> list[dict[str, Any]]:
    items = [source_from_article(article)]
    items.extend(source for source in article.get("otherSources") or [] if isinstance(source, dict))
    return items


def source_keys(article: dict[str, Any]) -> set[str]:
    return {key for key in (source_key(source) for source in source_items(article)) if key}


def first_time(container: dict[str, Any], fields: tuple[str, ...] = DISPLAY_TIME_FIELDS) -> str:
    for field in fields:
        value = compact(container.get(field))
        if value:
            return value
    return ""


def article_display_time(article: dict[str, Any], fallback: str = "") -> str:
    return first_time(article) or fallback


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


def load_feed(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"articles": []}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"articles": []}
    return loaded if isinstance(loaded, dict) else {"articles": []}


def previous_indexes(previous_articles: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, str], list[dict[str, Any]]]:
    by_match: dict[str, dict[str, Any]] = {}
    source_times: dict[str, str] = {}
    articles: list[dict[str, Any]] = []

    for article in previous_articles:
        if not isinstance(article, dict):
            continue
        keys = source_keys(article)
        if not keys:
            continue
        article_time = article_display_time(article)
        record = {"sourceKeys": keys, "displayedAt": article_time}
        articles.append(record)
        for key in match_keys(article):
            by_match.setdefault(key, record)

        primary = source_from_article(article)
        primary_key = source_key(primary)
        primary_time = first_time(primary, SOURCE_TIME_FIELDS) or article_time
        if primary_key and primary_time:
            source_times.setdefault(primary_key, primary_time)

        for source in article.get("otherSources") or []:
            if not isinstance(source, dict):
                continue
            key = source_key(source)
            time = first_time(source, SOURCE_TIME_FIELDS) or article_time
            if key and time:
                source_times.setdefault(key, time)

    return by_match, source_times, articles


def matched_previous(article: dict[str, Any], current_keys: set[str], by_match: dict[str, dict[str, Any]], previous_articles: list[dict[str, Any]]) -> tuple[set[str], str]:
    matched_keys: set[str] = set()
    matched_time = ""

    for key in match_keys(article):
        record = by_match.get(key)
        if record:
            matched_keys.update(record.get("sourceKeys", set()))
            matched_time = matched_time or compact(record.get("displayedAt"))

    if matched_keys:
        return matched_keys, matched_time

    best_record: dict[str, Any] | None = None
    best_overlap = 0
    for record in previous_articles:
        previous_keys = record.get("sourceKeys", set())
        overlap = len(current_keys & previous_keys)
        if overlap > best_overlap:
            best_overlap = overlap
            best_record = record

    if best_record and best_overlap:
        return set(best_record.get("sourceKeys", set())), compact(best_record.get("displayedAt"))

    return set(), ""


def mark_primary(article: dict[str, Any], previous_keys: set[str], previous_time: str, source_times: dict[str, str], timestamp: str) -> None:
    primary = source_from_article(article)
    key = source_key(primary)
    article_time = article_display_time(article, timestamp)
    existing_time = compact(article.get("sourceDisplayedAt"))
    if existing_time:
        article["sourceDisplayedAt"] = existing_time
        return

    if key and key in source_times:
        article["sourceDisplayedAt"] = source_times[key]
        article.pop("sourceIsNew", None)
        return

    if key and previous_keys and key not in previous_keys:
        article["sourceDisplayedAt"] = timestamp
        article["sourceIsNew"] = True
        return

    if not previous_keys:
        article["sourceDisplayedAt"] = article_time or timestamp
        article["sourceIsNew"] = True
        return

    article["sourceDisplayedAt"] = previous_time or article_time or timestamp
    article.pop("sourceIsNew", None)


def mark_secondary_sources(article: dict[str, Any], previous_keys: set[str], previous_time: str, source_times: dict[str, str], timestamp: str) -> None:
    article_time = article_display_time(article, timestamp)
    for source in article.get("otherSources") or []:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key:
            continue
        existing_time = first_time(source, SOURCE_TIME_FIELDS)
        if existing_time:
            source["displayedAt"] = existing_time
            continue
        if key in source_times:
            source["displayedAt"] = source_times[key]
            source.pop("isNew", None)
            continue
        if previous_keys and key not in previous_keys:
            source["displayedAt"] = timestamp
            source["isNew"] = True
            continue
        if not previous_keys:
            source["displayedAt"] = article_time or timestamp
            source["isNew"] = True
            continue
        source["displayedAt"] = previous_time or article_time or timestamp
        source.pop("isNew", None)


def main() -> None:
    data = load_feed(LATEST_FILE)
    previous = load_feed(PREVIOUS_FILE)
    timestamp = compact(data.get("timestamp"))
    by_match, source_times, previous_articles = previous_indexes(
        [article for article in previous.get("articles") or [] if isinstance(article, dict)]
    )

    updated_sources = 0
    new_sources = 0
    for article in data.get("articles") or []:
        if not isinstance(article, dict):
            continue
        current_keys = source_keys(article)
        previous_keys, previous_time = matched_previous(article, current_keys, by_match, previous_articles)
        before = json.dumps(article.get("otherSources") or [], sort_keys=True, ensure_ascii=False)
        mark_primary(article, previous_keys, previous_time, source_times, timestamp)
        mark_secondary_sources(article, previous_keys, previous_time, source_times, timestamp)
        after = json.dumps(article.get("otherSources") or [], sort_keys=True, ensure_ascii=False)
        if before != after or article.get("sourceDisplayedAt"):
            updated_sources += 1
        if article.get("sourceIsNew"):
            new_sources += 1
        new_sources += sum(1 for source in article.get("otherSources") or [] if isinstance(source, dict) and source.get("isNew"))

    meta = data.setdefault("scanMeta", {})
    meta["sourceNewBadge"] = {
        "policy": "source_displayedAt_24h_window",
        "updatedTopics": updated_sources,
        "newSources": new_sources,
    }
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"source new markers: topics={updated_sources}; new_sources={new_sources}")


if __name__ == "__main__":
    main()
