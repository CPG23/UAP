#!/usr/bin/env python3
"""Preserve the visible app feed across scans for the retention window.

Earlier passes build and clean the current scan result. This late pass enforces
the app contract the user sees: once an article is visible, it remains visible
until it ages out of the retention window, unless it is already represented by a
current top-level article or source cluster.
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
    overlap = words(a.get("title")) & words(b.get("title"))
    return len(overlap) >= 5 and len(overlap) / max(1, min(len(words(a.get("title"))), len(words(b.get("title"))))) >= 0.55


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


def sort_key(article: dict[str, Any]) -> tuple[int, str]:
    try:
        quality = int(article.get("quality") or article.get("sourceQuality") or 0)
    except Exception:
        quality = 0
    return quality, compact(article.get("publishedAt") or article.get("date") or article.get("displayedAt"))


def load(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"articles": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"articles": []}
    return data if isinstance(data, dict) else {"articles": []}


def main() -> None:
    data = load(LATEST_FILE)
    previous = load(PREVIOUS_FILE)
    now = parse_time(data.get("timestamp")) or datetime.now(timezone.utc)
    current = [article for article in data.get("articles") or [] if isinstance(article, dict) and compact(article.get("title"))]
    previous_articles = [article for article in previous.get("articles") or [] if isinstance(article, dict) and compact(article.get("title"))]

    restored: list[dict[str, Any]] = []
    for article in previous_articles:
        if not within_retention(article, now):
            continue
        if represented(article, current + restored):
            continue
        restored.append(normalize_retained(article))

    if restored:
        current.extend(restored)
        current.sort(key=sort_key, reverse=True)
        data["articles"] = current
        summaries = data.setdefault("summaries", {}) if isinstance(data.get("summaries"), dict) else {}
        for article in current:
            aid = compact(article.get("id"))
            summary = compact(article.get("summary"))
            if aid and summary and len(summary) >= 180:
                summaries[aid] = summary
        data["summaries"] = summaries
    else:
        data["articles"] = current

    meta = data.setdefault("scanMeta", {})
    meta["retainedAppArticles"] = {
        "policy": "visible_app_articles_retained_for_14_days_after_final_cluster_cleanup_v1",
        "previousVisibleArticles": len(previous_articles),
        "currentBeforeRestore": len(current) - len(restored),
        "restoredArticles": len(restored),
        "retentionDays": RETENTION_DAYS,
        "restoredTitles": [article.get("title", "") for article in restored[:20]],
    }
    meta["appTopics"] = len(data.get("articles") or [])
    LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"retained app articles: restored={len(restored)}; total={len(data.get('articles') or [])}")


if __name__ == "__main__":
    main()
