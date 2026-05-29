#!/usr/bin/env python3
"""Finalize app New markers and push notification events.

The scan pipeline can regroup articles after the initial RSS pass. This final pass
uses the finished app feed and a persistent seen-story ledger as the source of
truth for New markers: if a topic or source was already visible in the app, it is
not New again just because Google News later changes its RSS URL or date.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
PREVIOUS_FILE = Path("previous-latest-news.json")
SEEN_FILE = Path(".seen-ids.json")
MAX_NEW_AGE_HOURS = 30
SPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[a-z0-9]+", re.I)
STOP_WORDS = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might this that these those article story report reports news "
    "new latest update updated says said about into after before over under uap uaps ufo ufos"
    .split()
)


def compact(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", compact(value).lower()).strip()


def stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:16]


def words(value: Any) -> list[str]:
    return [
        word.lower()
        for word in WORD_RE.findall(compact(value))
        if len(word) > 2 and word.lower() not in STOP_WORDS
    ]


def topic_signature(article: dict[str, Any]) -> str:
    article_id = compact(article.get("id"))
    if article_id:
        return "id:" + article_id
    tokens = sorted(set(words(article.get("title"))))[:12]
    return "title:" + " ".join(tokens) if tokens else "title:" + title_key(article.get("title"))


def source_signature(source: dict[str, Any], article: dict[str, Any]) -> str:
    publisher = title_key(source.get("source") or article.get("source"))
    title = title_key(source.get("title") or article.get("title"))
    source_date = compact(source.get("sourcePublishedAt") or source.get("sourceDate") or source.get("publisherPublishedAt") or source.get("publisherDate"))[:10]
    if publisher or title:
        return "publisher_title:" + publisher + ":" + title + (":" + source_date if source_date else "")
    link = compact(source.get("link") or source.get("url"))
    return "link:" + link.lower()


def topic_seen_key(article: dict[str, Any]) -> str:
    return "seen:topic:v2:" + stable_hash(topic_signature(article))


def source_seen_key(source: dict[str, Any], article: dict[str, Any]) -> str:
    return "seen:source:v2:" + stable_hash(topic_signature(article) + "|" + source_signature(source, article))


def parse_dt(value: Any) -> datetime | None:
    text = compact(value)
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            parsed_date = datetime.fromisoformat(text).date()
            return datetime.combine(parsed_date, time(23, 59, 59), timezone.utc)
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def scan_time(data: dict[str, Any]) -> datetime:
    return parse_dt(data.get("timestamp")) or datetime.now(timezone.utc)


def is_recent(value: Any, now: datetime) -> bool:
    parsed = parse_dt(value)
    if not parsed:
        return False
    age_hours = (now - parsed).total_seconds() / 3600
    return -2 <= age_hours <= MAX_NEW_AGE_HOURS


def natural_article_time(article: dict[str, Any]) -> str:
    return compact(article.get("publishedAt") or article.get("date"))


def natural_source_time(source: dict[str, Any], article: dict[str, Any]) -> str:
    return compact(source.get("publishedAt") or source.get("date") or natural_article_time(article))


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
        "sourcePublishedAt": article.get("sourcePublishedAt"),
        "sourceDate": article.get("sourceDate"),
        "publisherPublishedAt": article.get("publisherPublishedAt"),
        "publisherDate": article.get("publisherDate"),
        "displayedAt": article.get("sourceDisplayedAt") or article.get("displayedAt"),
        "isNew": article.get("sourceIsNew"),
    }


def source_items(article: dict[str, Any]) -> list[tuple[dict[str, Any], bool]]:
    items: list[tuple[dict[str, Any], bool]] = [(source_from_article(article), True)]
    items.extend((source, False) for source in article.get("otherSources") or [] if isinstance(source, dict))
    return items


def source_keys(article: dict[str, Any]) -> set[str]:
    return {key for source, _ in source_items(article) if (key := source_key(source))}


def stable_source_keys(article: dict[str, Any]) -> set[str]:
    return {source_seen_key(source, article) for source, _ in source_items(article) if source_signature(source, article)}


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


def load_seen() -> set[str]:
    if not SEEN_FILE.exists():
        return set()
    try:
        data = json.loads(SEEN_FILE.read_text(encoding="utf-8"))
    except Exception:
        return set()
    return {compact(item) for item in data if compact(item)} if isinstance(data, list) else set()


def save_seen(seen: set[str]) -> None:
    SEEN_FILE.write_text(json.dumps(sorted(seen)[-4000:], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def previous_indexes(previous: dict[str, Any]) -> tuple[dict[str, set[str]], set[str], dict[str, str], dict[str, dict[str, Any]], set[str], set[str]]:
    by_match: dict[str, set[str]] = {}
    all_sources: set[str] = set()
    article_times: dict[str, str] = {}
    source_state: dict[str, dict[str, Any]] = {}
    previous_topics: set[str] = set()
    previous_stable_sources: set[str] = set()

    for article in previous.get("articles") or []:
        if not isinstance(article, dict):
            continue
        keys = source_keys(article)
        stable_keys = stable_source_keys(article)
        all_sources.update(keys)
        previous_stable_sources.update(stable_keys)
        previous_topics.add(topic_seen_key(article))
        displayed = compact(article.get("displayedAt") or natural_article_time(article))
        for match in match_keys(article):
            by_match.setdefault(match, set()).update(keys)
            if displayed:
                article_times.setdefault(match, displayed)
        for source, primary in source_items(article):
            key = source_key(source)
            stable_key = source_seen_key(source, article)
            if not key and not stable_key:
                continue
            shown_at = compact(source.get("displayedAt") or source.get("sourceDisplayedAt") or article.get("sourceDisplayedAt") or article.get("displayedAt"))
            was_new = bool(source.get("isNew") or (primary and article.get("sourceIsNew")))
            if key:
                source_state.setdefault(key, {"displayedAt": shown_at, "isNew": was_new})
            if stable_key:
                source_state.setdefault(stable_key, {"displayedAt": shown_at, "isNew": was_new})
    return by_match, all_sources, article_times, source_state, previous_topics, previous_stable_sources


def matched_sources(article: dict[str, Any], by_match: dict[str, set[str]], all_previous_sources: set[str]) -> set[str]:
    found: set[str] = set()
    for match in match_keys(article):
        found.update(by_match.get(match, set()))
    if found:
        return found
    overlap = source_keys(article) & all_previous_sources
    return overlap


def previous_article_time(article: dict[str, Any], article_times: dict[str, str]) -> str:
    for match in match_keys(article):
        if article_times.get(match):
            return article_times[match]
    return ""


def set_primary_new(article: dict[str, Any], displayed_at: str) -> None:
    article["sourceIsNew"] = True
    article["sourceDisplayedAt"] = displayed_at


def clear_primary_new(article: dict[str, Any], fallback: str) -> None:
    article.pop("sourceIsNew", None)
    article["sourceDisplayedAt"] = compact(article.get("sourceDisplayedAt") or fallback)


def finalize(data: dict[str, Any], previous: dict[str, Any]) -> None:
    now = scan_time(data)
    timestamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    by_match, all_previous_sources, article_times, source_state, previous_topics, previous_stable_sources = previous_indexes(previous)
    seen = load_seen()
    seeded_seen: set[str] = set()
    fresh_seen: set[str] = set()
    visible_seen: set[str] = set()
    notification_ids: list[str] = []
    corrected_old_sources = 0
    fresh_source_count = 0
    resurfaced_suppressed = 0

    for article in previous.get("articles") or []:
        if isinstance(article, dict):
            seeded_seen.add(topic_seen_key(article))
            seeded_seen.update(stable_source_keys(article))
    seen.update(seeded_seen)

    for article in data.get("articles") or []:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        if not article_id:
            continue

        article_time = natural_article_time(article)
        current_keys = source_keys(article)
        previous_keys = matched_sources(article, by_match, all_previous_sources)
        topic_key = topic_seen_key(article)
        topic_already_seen = topic_key in seen or topic_key in previous_topics
        known_as_existing = bool(previous_keys or (current_keys & all_previous_sources) or topic_already_seen)
        event_keys: set[str] = set()
        has_fresh_source = False
        has_preserved_new_source = False

        visible_seen.add(topic_key)

        for source, primary in source_items(article):
            key = source_key(source)
            stable_key = source_seen_key(source, article)
            if not key and not stable_key:
                continue
            source_time = natural_source_time(source, article)
            source_known = key in previous_keys or key in all_previous_sources or stable_key in seen or stable_key in previous_stable_sources
            prior = source_state.get(key, {}) or source_state.get(stable_key, {})
            prior_new = bool(prior.get("isNew")) and is_recent(prior.get("displayedAt"), now)
            visible_seen.add(stable_key)

            if not source_known and stable_key not in seen:
                if primary:
                    set_primary_new(article, timestamp)
                else:
                    source["isNew"] = True
                    source["displayedAt"] = timestamp
                event_keys.add(stable_key)
                has_fresh_source = True
                fresh_source_count += 1
            elif prior_new:
                displayed = compact(prior.get("displayedAt")) or timestamp
                if primary:
                    set_primary_new(article, displayed)
                else:
                    source["isNew"] = True
                    source["displayedAt"] = displayed
                has_preserved_new_source = True
            else:
                if primary:
                    clear_primary_new(article, source_time or previous_article_time(article, article_times) or article_time or timestamp)
                else:
                    if source.pop("isNew", None):
                        corrected_old_sources += 1
                    source["displayedAt"] = source_time or compact(prior.get("displayedAt")) or previous_article_time(article, article_times) or article_time or timestamp
                if not source_known and stable_key in seen:
                    resurfaced_suppressed += 1

        is_new_topic = not known_as_existing and topic_key not in seen
        if is_new_topic:
            event_keys.add(topic_key)
        elif not known_as_existing and topic_key in seen:
            resurfaced_suppressed += 1

        fresh_events = {key for key in event_keys if key not in seen}
        if fresh_events:
            notification_ids.append(article_id)
            fresh_seen.update(fresh_events)
            article["displayedAt"] = timestamp
        elif has_preserved_new_source:
            previous_time = previous_article_time(article, article_times)
            article["displayedAt"] = previous_time or compact(article.get("displayedAt")) or timestamp
        elif has_fresh_source or is_new_topic:
            article["displayedAt"] = timestamp
        else:
            article["displayedAt"] = previous_article_time(article, article_times) or article_time or timestamp

    notification_ids = notification_ids[:10]
    by_id = {compact(article.get("id")): article for article in data.get("articles") or [] if isinstance(article, dict)}
    data["notificationBatch"] = {
        "timestamp": timestamp,
        "ids": notification_ids,
        "articles": [
            {"id": article_id, "title": by_id[article_id].get("title", ""), "source": by_id[article_id].get("source", "UAP News")}
            for article_id in notification_ids
            if article_id in by_id
        ],
    }
    if fresh_seen or visible_seen or seeded_seen:
        seen.update(fresh_seen)
        seen.update(visible_seen)
        save_seen(seen)

    meta = data.setdefault("scanMeta", {})
    meta["finalNewEvents"] = {
        "policy": "new_marker_for_stable_topics_or_sources_not_seen_before_v2_ignore_rss_date_resurface",
        "notifications": len(notification_ids),
        "freshSources": fresh_source_count,
        "correctedOldSourceMarkers": corrected_old_sources,
        "resurfacedSeenItemsSuppressed": resurfaced_suppressed,
        "seededSeenFromPreviousFeed": len(seeded_seen),
    }


def main() -> None:
    data = load(LATEST_FILE)
    previous = load(PREVIOUS_FILE)
    finalize(data, previous)
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    count = len((data.get("notificationBatch") or {}).get("ids") or [])
    print(f"final new events: notifications={count}")


if __name__ == "__main__":
    main()
