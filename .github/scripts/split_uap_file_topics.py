#!/usr/bin/env python3
"""Split UAP file-release sources out of unrelated topic clusters.

This runs directly after daily_scan.py and before summary enrichment. That timing is
important: newly split topics get their own summary later instead of inheriting the
summary of an unrelated primary article.
"""

from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")

UAP_RE = re.compile(r"\b(uap|ufo|ufos|unidentified\s+(?:aerial|anomalous|flying)|alien)\b", re.I)
FILE_RE = re.compile(r"\b(file|files|record|records|archive|document|documents|photo|photos|image|images|video|videos|footage)\b", re.I)
RELEASE_RE = re.compile(r"\b(release|released|releases|declassif|publish|published|publishes|unseal|disclos|opens?)\b", re.I)
OFFICIAL_RE = re.compile(r"\b(pentagon|dod|defense|defence|government|war\.gov|aaro|foia|trump|white\s+house|national\s+archives|us|u\.s\.|official|federal)\b", re.I)
PREFERRED_SOURCE_RE = re.compile(r"\b(npr|al jazeera|abc|newsnation|sky news|defense|defence|aerotime|florida today|australian broadcasting|livenow|fox)\b", re.I)
SPACE_RE = re.compile(r"\s+")
STOP = set("a an the to of for in on at by with from and or is are was were this that new latest uap ufo ufos uaps".split())


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def words(text: str) -> list[str]:
    return [word for word in re.sub(r"[^a-z0-9]", " ", text.lower()).split() if len(word) > 2 and word not in STOP]


def topic_id(title: str) -> str:
    return "-".join(sorted(set(words(title)))[:10]) or "uap-file-release"


def article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([
        article.get("title", ""),
        article.get("description", ""),
        article.get("summary", ""),
        article.get("source", ""),
    ]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def is_file_release_text(text: str) -> bool:
    return bool(UAP_RE.search(text) and FILE_RE.search(text) and RELEASE_RE.search(text) and OFFICIAL_RE.search(text))


def is_file_release_article(article: dict[str, Any]) -> bool:
    return is_file_release_text(article_text(article))


def is_file_release_source(source: dict[str, Any]) -> bool:
    return is_file_release_text(source_text(source))


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def dedupe(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for source in sources:
        key = source_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(source)
    return result


def rank_source(source: dict[str, Any]) -> tuple[int, int, int]:
    text = source_text(source)
    return (
        1 if PREFERRED_SOURCE_RE.search(text) else 0,
        1 if source.get("url") or source.get("link") else 0,
        len(clean(source.get("title"))),
    )


def cluster_titles(sources: list[dict[str, Any]], primary_title: str) -> list[str]:
    primary = clean(primary_title).lower()
    titles: list[str] = []
    seen: set[str] = set()
    for source in sources:
        title = clean(source.get("title"))
        key = title.lower()
        if not title or key == primary or key in seen:
            continue
        seen.add(key)
        titles.append(title)
    return titles[:8]


def make_article_from_sources(sources: list[dict[str, Any]], template: dict[str, Any]) -> dict[str, Any]:
    sources = dedupe(sources)
    sources.sort(key=rank_source, reverse=True)
    primary = sources[0]
    title = clean(primary.get("title"))
    link = clean(primary.get("url") or primary.get("link"))
    quality = max(int(template.get("quality") or 0), min(100, 70 + max(0, len(sources) - 1) * 3))
    return {
        "id": topic_id(title),
        "title": title,
        "source": clean(primary.get("source")) or "UAP News",
        "link": link,
        "date": template.get("date"),
        "publishedAt": primary.get("publishedAt") or template.get("publishedAt"),
        "summary": "",
        "mentions": len(sources),
        "otherSources": sources[1:],
        "clusterTitles": cluster_titles(sources[1:], title),
        "quality": quality,
        "qualityBreakdown": template.get("qualityBreakdown", []),
        "qualityExplanation": template.get("qualityExplanation", ""),
        "matchedTerms": sorted(set((template.get("matchedTerms") or []) + ["PENTAGON", "DISCLOSURE"]))[:8],
        "sourceQuality": quality,
        "summaryStatus": {"articleContentSummary": "pending"},
    }


def split_article(article: dict[str, Any]) -> list[dict[str, Any]]:
    if is_file_release_article(article):
        return [article]

    other_sources = [deepcopy(source) for source in article.get("otherSources") or [] if isinstance(source, dict)]
    file_sources = [source for source in other_sources if is_file_release_source(source)]
    if len(file_sources) < 2:
        return [article]

    kept_sources = [source for source in other_sources if not is_file_release_source(source)]
    repaired = deepcopy(article)
    repaired["otherSources"] = kept_sources
    repaired["mentions"] = max(1, 1 + len(kept_sources))
    repaired["clusterTitles"] = cluster_titles(kept_sources, repaired.get("title", ""))
    repaired.pop("translations", None)
    repaired.pop("translationMeta", None)

    return [repaired, make_article_from_sources(file_sources, article)]


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = payload.get("articles") or []
    split: list[dict[str, Any]] = []
    created = 0
    for article in articles:
        parts = split_article(article) if isinstance(article, dict) else [article]
        created += max(0, len(parts) - 1)
        split.extend(parts)

    payload["articles"] = split
    meta = payload.setdefault("scanMeta", {})
    meta["splitUapFileReleaseTopics"] = created
    meta["splitUapFileReleasePolicy"] = "sources_split_before_summary_enrichment"
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"split UAP file-release topics: created={created}")


if __name__ == "__main__":
    main()
