#!/usr/bin/env python3
"""Preserve the visible app feed across scans for the retention window.

Earlier passes build and clean the current scan result. This late pass enforces
the app contract the user sees: once an article is visible, it remains visible
until it ages out of the retention window, unless it is already represented by a
current top-level article or source cluster. Articles flagged as unreachable in
the same scan are not retained.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    from final_feed_integrity import same_story_article
except Exception:
    same_story_article = None

LATEST_FILE = Path("latest-news.json")
PREVIOUS_FILE = Path("previous-latest-news.json")
ARCHIVE_FILE = Path("app-feed-archive.json")
RETENTION_DAYS = 14
SPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[a-z0-9]+", re.I)
STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might new latest update report reports news says said about into "
    "after before over under this that these those article story source sources uap uaps ufo ufos"
    .split()
)


def compact(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", compact(value).lower()).strip()


def words(value: Any) -> set[str]:
    return {word.lower() for word in WORD_RE.findall(compact(value)) if len(word) > 2 and word.lower() not in STOP}


def article_match_text(article: dict[str, Any]) -> str:
    parts = [
        article.get("title", ""),
        article.get("summary", ""),
        " ".join(article.get("clusterTitles") or []),
    ]
    parts.extend(
        compact(source.get("title"))
        for source in article.get("otherSources") or []
        if isinstance(source, dict)
    )
    return compact(" ".join(parts)).lower()


def source_key(source: dict[str, Any]) -> str:
    link = compact(source.get("link") or source.get("url"))
    if link:
        return "link:" + link.lower()
    return "title:" + title_key(source.get("source")) + ":" + title_key(source.get("title"))


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "source": article.get("source", ""),
        "link": article.get("link") or article.get("url") or "",
        "url": article.get("url") or article.get("link") or "",
        "publishedAt": article.get("publishedAt") or article.get("date"),
    }


def article_sources(article: dict[str, Any]) -> list[dict[str, Any]]:
    return [source_from_article(article)] + [source for source in article.get("otherSources") or [] if isinstance(source, dict)]


def source_keys(article: dict[str, Any]) -> set[str]:
    return {key for key in (source_key(source) for source in article_sources(article)) if key and key != "title::"}


def parse_time(value: Any) -> datetime | None:
    text = compact(value)
    if not text:
        return None
    for candidate in [text, text[:10]]:
        try:
            if candidate.endswith("Z"):
                candidate = candidate[:-1] + "+00:00"
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            pass
    return None


def article_time(article: dict[str, Any]) -> datetime | None:
    for key in ("publishedAt", "date", "displayedAt", "sourceDisplayedAt"):
        dt = parse_time(article.get(key))
        if dt:
            return dt
    return None


def within_retention(article: dict[str, Any], now: datetime) -> bool:
    dt = article_time(article)
    return not dt or dt >= now - timedelta(days=RETENTION_DAYS)


def fallback_same_story(a: dict[str, Any], b: dict[str, Any]) -> bool:
    if title_key(a.get("title")) and title_key(a.get("title")) == title_key(b.get("title")):
        return True
    a_summary = compact(a.get("summary")).lower()
    b_summary = compact(b.get("summary")).lower()
    if len(a_summary) >= 180 and a_summary == b_summary:
        return True
    a_text = article_match_text(a)
    b_text = article_match_text(b)
    alien_site_a = bool(re.search(r"\baliens?\.gov\b|\baliens?\s+website\b", a_text))
    alien_site_b = bool(re.search(r"\baliens?\.gov\b|\baliens?\s+website\b", b_text))
    immigration_a = bool(re.search(r"\b(immigration|ice|migrant|migrants|alien arrest|federal encounters)\b", a_text))
    immigration_b = bool(re.search(r"\b(immigration|ice|migrant|migrants|alien arrest|federal encounters)\b", b_text))
    if alien_site_a and alien_site_b and immigration_a and immigration_b:
        return True
    if (
        "immigration" in a_text
        and "immigration" in b_text
        and "trump" in a_text
        and "trump" in b_text
        and re.search(r"\balien(?:s|\.gov)?\b", a_text)
        and re.search(r"\balien(?:s|\.gov)?\b", b_text)
    ):
        return True
    a_words = words(a.get("title") or a.get("summary"))
    b_words = words(b.get("title") or b.get("summary"))
    overlap = a_words & b_words
    return len(overlap) >= 5 and len(overlap) / max(1, min(len(a_words), len(b_words))) >= 0.55


def dedupe_sources_for(article: dict[str, Any]) -> None:
    primary_keys = source_keys({**article, "otherSources": []})
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for source in article.get("otherSources") or []:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key in seen or key in primary_keys:
            continue
        seen.add(key)
        deduped.append(source)
    article["otherSources"] = deduped
    article["mentions"] = max(1, 1 + len(deduped))
    article["clusterTitles"] = [compact(source.get("title")) for source in deduped if compact(source.get("title"))][:10]


def merge_duplicate_into(target: dict[str, Any], duplicate: dict[str, Any]) -> None:
    target.setdefault("otherSources", [])
    if source_key(source_from_article(target)) != source_key(source_from_article(duplicate)):
        target["otherSources"].append(source_from_article(duplicate))
    target["otherSources"].extend(source for source in duplicate.get("otherSources") or [] if isinstance(source, dict))
    if len(compact(duplicate.get("summary"))) > len(compact(target.get("summary"))):
        target["summary"] = duplicate.get("summary", "")
        target.pop("summaryStatus", None)
        if duplicate.get("translation"):
            target["translation"] = duplicate.get("translation")
    dedupe_sources_for(target)


def merge_visible_duplicates(articles: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    merged: list[dict[str, Any]] = []
    removed = 0
    for article in sorted(articles, key=sort_key, reverse=True):
        for existing in merged:
            if fallback_same_story(existing, article):
                merge_duplicate_into(existing, article)
                removed += 1
                break
        else:
            merged.append(article)
    return sorted(merged, key=sort_key, reverse=True), removed


def represented(previous: dict[str, Any], current_articles: list[dict[str, Any]]) -> bool:
    previous_id = compact(previous.get("id"))
    previous_title = title_key(previous.get("title"))
    previous_sources = source_keys(previous)
    for current in current_articles:
        if previous_id and previous_id == compact(current.get("id")):
            return True
        if previous_title and previous_title == title_key(current.get("title")):
            return True
        if previous_sources and previous_sources & source_keys(current):
            return True
        if same_story_article:
            try:
                if same_story_article(current, previous):
                    return True
            except Exception:
                pass
        if fallback_same_story(current, previous):
            return True
    return False


def merge_if_represented(previous: dict[str, Any], current_articles: list[dict[str, Any]]) -> bool:
    previous_id = compact(previous.get("id"))
    previous_title = title_key(previous.get("title"))
    previous_sources = source_keys(previous)
    retained = normalize_retained(previous)
    for current in current_articles:
        same = False
        if previous_id and previous_id == compact(current.get("id")):
            same = True
        elif previous_title and previous_title == title_key(current.get("title")):
            same = True
        elif previous_sources and previous_sources & source_keys(current):
            same = True
        elif same_story_article:
            try:
                same = bool(same_story_article(current, previous))
            except Exception:
                same = False
        if same or fallback_same_story(current, previous):
            merge_duplicate_into(current, retained)
            return True
    return False


def normalize_retained(article: dict[str, Any]) -> dict[str, Any]:
    retained = dict(article)
    retained.setdefault("otherSources", [])
    retained.setdefault("clusterTitles", [])
    retained["retainedFromPreviousScan"] = True
    retained.pop("sourceIsNew", None)
    if retained.get("displayedAt"):
        retained["displayedAt"] = compact(retained.get("displayedAt"))
    else:
        retained["displayedAt"] = compact(retained.get("publishedAt") or retained.get("date"))
    return retained


def sort_key(article: dict[str, Any]) -> tuple[int, int, str]:
    try:
        quality = int(article.get("quality") or article.get("sourceQuality") or 0)
    except Exception:
        quality = 0
    try:
        mentions = int(article.get("mentions") or 1)
    except Exception:
        mentions = 1
    return quality, mentions, compact(article.get("publishedAt") or article.get("date") or article.get("displayedAt"))


def archive_key(article: dict[str, Any]) -> str:
    article_id = compact(article.get("id"))
    if article_id:
        return "id:" + article_id
    keys = sorted(source_keys(article))
    if keys:
        return keys[0]
    return "title:" + title_key(article.get("title"))


def load(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"articles": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"articles": []}
    return data if isinstance(data, dict) else {"articles": []}


def blocked_titles(data: dict[str, Any]) -> set[str]:
    filter_meta = (data.get("scanMeta") or {}).get("unreachableArticleFilter") or {}
    return {title_key(title) for title in filter_meta.get("removedTitles") or [] if title_key(title)}


def is_blocked(article: dict[str, Any], blocked: set[str]) -> bool:
    return bool(title_key(article.get("title")) in blocked)


def archive_candidates(previous: dict[str, Any], archive: dict[str, Any], blocked: set[str]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    by_key: dict[str, dict[str, Any]] = {}
    for payload in (previous, archive):
        for article in payload.get("articles") or []:
            if not isinstance(article, dict) or not compact(article.get("title")) or is_blocked(article, blocked):
                continue
            key = archive_key(article)
            existing = by_key.get(key)
            if not existing:
                by_key[key] = article
                continue
            existing_summary = compact(existing.get("summary"))
            candidate_summary = compact(article.get("summary"))
            if len(candidate_summary) >= 180 and len(candidate_summary) > len(existing_summary):
                merged = dict(existing)
                merged["summary"] = candidate_summary
                merged.pop("summaryStatus", None)
                if article.get("translation"):
                    merged["translation"] = article.get("translation")
                by_key[key] = merged
    candidates.extend(by_key.values())
    return candidates


def write_archive(articles: list[dict[str, Any]], now: datetime, blocked: set[str]) -> None:
    by_key: dict[str, dict[str, Any]] = {}
    for article in articles:
        if not isinstance(article, dict) or not compact(article.get("title")) or not within_retention(article, now) or is_blocked(article, blocked):
            continue
        by_key[archive_key(article)] = dict(article)
    archived = sorted(by_key.values(), key=sort_key, reverse=True)
    ARCHIVE_FILE.write_text(
        json.dumps(
            {
                "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "retentionDays": RETENTION_DAYS,
                "articles": archived,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    data = load(LATEST_FILE)
    previous = load(PREVIOUS_FILE)
    archive = load(ARCHIVE_FILE)
    blocked = blocked_titles(data)
    now = parse_time(data.get("timestamp")) or datetime.now(timezone.utc)
    current = [
        article for article in data.get("articles") or []
        if isinstance(article, dict) and compact(article.get("title")) and not is_blocked(article, blocked)
    ]
    candidates = archive_candidates(previous, archive, blocked)

    restored: list[dict[str, Any]] = []
    for article in candidates:
        if not within_retention(article, now):
            continue
        if merge_if_represented(article, current + restored):
            continue
        restored.append(normalize_retained(article))

    if restored:
        current.extend(restored)
    current, merged_duplicates = merge_visible_duplicates(current)
    current.sort(key=sort_key, reverse=True)
    data["articles"] = current

    summaries = data.setdefault("summaries", {}) if isinstance(data.get("summaries"), dict) else {}
    active_ids = {compact(article.get("id")) for article in current if compact(article.get("id"))}
    summaries = {key: value for key, value in summaries.items() if key in active_ids}
    for article in current:
        aid = compact(article.get("id"))
        summary = compact(article.get("summary"))
        if aid and summary and len(summary) >= 180:
            summaries[aid] = summary
    data["summaries"] = summaries

    write_archive(current, now, blocked)

    meta = data.setdefault("scanMeta", {})
    meta["retainedAppArticles"] = {
        "policy": "visible_app_articles_retained_for_14_days_after_final_cluster_cleanup_v4_merge_same_story_retained_duplicates",
        "archiveCandidates": len(candidates),
        "currentBeforeRestore": len(current) - len(restored),
        "restoredArticles": len(restored),
        "blockedUnreachableTitles": len(blocked),
        "mergedDuplicateVisibleArticles": merged_duplicates,
        "retentionDays": RETENTION_DAYS,
        "restoredTitles": [article.get("title", "") for article in restored[:20]],
    }
    meta["appTopics"] = len(data.get("articles") or [])
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"retained app articles: restored={len(restored)}; total={len(data.get('articles') or [])}; blocked={len(blocked)}")


if __name__ == "__main__":
    main()
