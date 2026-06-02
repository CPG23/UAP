#!/usr/bin/env python3
"""Final source-topic and score consistency pass for the app feed."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
ALIEN_SITE_RE = re.compile(r"\baliens?\.gov\b|\baliens?(?:['\u2019])?\s+website\b", re.I)
IMMIGRATION_RE = re.compile(r"\b(immigration|ice|migrant|migrants|alien arrest|federal encounters)\b", re.I)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean(value).lower()).strip()


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")])).lower()


def article_text(article: dict[str, Any]) -> str:
    parts = [
        article.get("title", ""),
        article.get("summary", ""),
        article.get("description", ""),
        article.get("source", ""),
    ]
    return clean(" ".join(parts)).lower()


def source_key(source: dict[str, Any]) -> str:
    link = clean(source.get("link") or source.get("url"))
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


def article_from_source(source: dict[str, Any]) -> dict[str, Any]:
    published_at = clean(source.get("publishedAt") or source.get("rssPublishedAt") or source.get("displayedAt"))
    link = clean(source.get("link") or source.get("url"))
    title = clean(source.get("title"))
    return {
        "id": "alien-gov-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:90],
        "title": title,
        "source": clean(source.get("source")),
        "link": link,
        "url": link,
        "date": published_at[:10] if published_at else "",
        "publishedAt": published_at,
        "summary": "",
        "mentions": 1,
        "otherSources": [],
        "clusterTitles": [],
        "quality": 50,
        "qualityBreakdown": [
            {"label": "Basis", "points": 27, "text": "UAP/UFO-Bezug erkannt und Unterhaltung/Gaming herausgefiltert."},
            {"label": "Starker Titel", "points": 13, "text": "Der Titel enthaelt einen klaren UAP/UFO-Bezug."},
        ],
        "matchedTerms": ["ALIEN"],
        "sourceQuality": 50,
        "displayedAt": clean(source.get("displayedAt") or published_at),
    }


def is_alien_gov_immigration_text(text: str) -> bool:
    normalized = clean(text).lower()
    if ALIEN_SITE_RE.search(normalized) and IMMIGRATION_RE.search(normalized):
        return True
    return bool(
        "are aliens for real" in normalized
        and "white house" in normalized
        and "website" in normalized
    )


def is_alien_gov_immigration_article(article: dict[str, Any]) -> bool:
    return is_alien_gov_immigration_text(article_text(article))


def is_alien_gov_immigration_source(source: dict[str, Any]) -> bool:
    return is_alien_gov_immigration_text(source_text(source))


def dedupe_sources(article: dict[str, Any]) -> None:
    primary_key = source_key(source_from_article(article))
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for source in article.get("otherSources") or []:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key == primary_key or key in seen:
            continue
        seen.add(key)
        deduped.append(source)
    article["otherSources"] = deduped
    article["mentions"] = max(1, 1 + len(deduped))
    article["clusterTitles"] = [clean(source.get("title")) for source in deduped if clean(source.get("title"))][:10]


def source_points(mentions: int) -> int:
    return max(0, (mentions - 1) * 5)


def refresh_quality(article: dict[str, Any]) -> None:
    try:
        mentions = int(article.get("mentions") or 1)
    except Exception:
        mentions = 1
    mentions = max(1, mentions)
    parts = [
        part for part in article.get("qualityBreakdown") or []
        if isinstance(part, dict) and part.get("label") != "Mehrere Quellen"
    ]
    points = source_points(mentions)
    if points:
        parts.append({"label": "Mehrere Quellen", "points": points, "text": f"{mentions} Quellen im aktuellen Feed."})
    score = sum(int(part.get("points") or 0) for part in parts) if parts else int(article.get("quality") or article.get("sourceQuality") or 50)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(100, score))
    article["sourceQuality"] = article["quality"]


def relocate_alien_gov_sources(articles: list[dict[str, Any]]) -> tuple[int, int]:
    targets = [article for article in articles if is_alien_gov_immigration_article(article)]
    if not targets:
        alien_sources: list[dict[str, Any]] = []
        for article in articles:
            kept: list[dict[str, Any]] = []
            for source in article.get("otherSources") or []:
                if isinstance(source, dict) and is_alien_gov_immigration_source(source):
                    alien_sources.append(source)
                elif isinstance(source, dict):
                    kept.append(source)
            article["otherSources"] = kept
        if not alien_sources:
            return 0, 0
        target = article_from_source(alien_sources[0])
        target["otherSources"] = alien_sources[1:]
        articles.append(target)
        return len(alien_sources), 0
    target = max(targets, key=lambda article: (int(article.get("quality") or 0), int(article.get("mentions") or 1)))
    moved = 0
    removed_unrelated = 0
    for alien_article in targets:
        kept: list[dict[str, Any]] = []
        for source in alien_article.get("otherSources") or []:
            if isinstance(source, dict) and is_alien_gov_immigration_source(source):
                kept.append(source)
            elif isinstance(source, dict):
                removed_unrelated += 1
        alien_article["otherSources"] = kept
    for article in articles:
        if article is target:
            continue
        kept: list[dict[str, Any]] = []
        for source in article.get("otherSources") or []:
            if isinstance(source, dict) and is_alien_gov_immigration_source(source):
                target.setdefault("otherSources", []).append(source)
                moved += 1
            elif isinstance(source, dict):
                kept.append(source)
        article["otherSources"] = kept
    return moved, removed_unrelated


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8-sig"))
    articles = [article for article in payload.get("articles") or [] if isinstance(article, dict)]
    moved, removed_unrelated = relocate_alien_gov_sources(articles)
    for article in articles:
        dedupe_sources(article)
        refresh_quality(article)
    articles.sort(
        key=lambda article: (
            int(article.get("quality") or 0),
            int(article.get("mentions") or 1),
            clean(article.get("publishedAt") or article.get("date") or article.get("displayedAt")),
        ),
        reverse=True,
    )
    payload["articles"] = articles
    payload.setdefault("scanMeta", {})["finalFeedSourceConsistency"] = {
        "policy": "relocate_alien_gov_immigration_sources_prune_unrelated_sources_and_refresh_linear_source_scores_v4_restore_source_base",
        "relocatedAlienGovImmigrationSources": moved,
        "removedUnrelatedAlienGovClusterSources": removed_unrelated,
        "articlesRefreshed": len(articles),
    }
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"final feed source consistency: moved_alien_gov_sources={moved}; removed_unrelated_alien_gov_sources={removed_unrelated}; refreshed={len(articles)}")


if __name__ == "__main__":
    main()
