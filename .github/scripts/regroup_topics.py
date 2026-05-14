#!/usr/bin/env python3
"""Regroup near-duplicate published news items before translations are prepared.

The scanner is intentionally cautious while collecting RSS items. This pass runs on
latest-news.json, where AI summaries are already available, so it can merge the
same story across outlets without guessing from the headline alone.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
NEWS_PATH = ROOT / "latest-news.json"

UAP_RE = re.compile(r"\b(uap|ufo|ufos|ovni|unidentified\s+(?:aerial|anomalous|flying)|alien)\b", re.I)
FILE_RE = re.compile(r"\b(file|files|record|records|archive|document|documents|photo|photos|image|images|video|videos|footage|akten|fotos)\b", re.I)
RELEASE_RE = re.compile(r"\b(release|released|releases|declassif|publish|published|publishes|unseal|disclos|freig|veroffentlicht|veroeffentlicht)\b", re.I)
OFFICIAL_RE = re.compile(r"\b(pentagon|dod|defense|defence|government|congress|aoc|aaro|foia|trump|white\s+house|national\s+archives|us|u\.s\.|official|federal)\b", re.I)

SPACE_RE = re.compile(r"\s+")


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "").strip())


def article_topic_text(article: dict[str, Any]) -> str:
    """Only compare the article itself, not already-attached source lists."""
    return clean(
        " ".join(
            [
                article.get("title", ""),
                article.get("description", ""),
                article.get("summary", ""),
                article.get("source", ""),
            ]
        )
    )


def source_topic_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def is_uap_file_release_text(text: str) -> bool:
    return bool(
        UAP_RE.search(text)
        and FILE_RE.search(text)
        and RELEASE_RE.search(text)
        and OFFICIAL_RE.search(text)
    )


def is_uap_file_release(article: dict[str, Any]) -> bool:
    return is_uap_file_release_text(article_topic_text(article))


def source_is_uap_file_release(source: dict[str, Any]) -> bool:
    return is_uap_file_release_text(source_topic_text(source))


def same_topic(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return is_uap_file_release(a) and is_uap_file_release(b)


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "url": article.get("url") or article.get("link", ""),
        "link": article.get("link") or article.get("url", ""),
        "source": article.get("source", ""),
        "publishedAt": article.get("publishedAt") or article.get("detectedAt"),
    }


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def all_sources(article: dict[str, Any]) -> list[dict[str, Any]]:
    sources = [source_from_article(article)]
    for source in article.get("otherSources") or []:
        if isinstance(source, dict):
            sources.append(source)
    return sources


def dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for source in sources:
        key = source_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(source)
    return result


def unique_titles(sources: list[dict[str, Any]], primary_title: str) -> list[str]:
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


def merge_quality(primary: dict[str, Any], source_count: int) -> int:
    base = int(primary.get("sourceQuality") or primary.get("quality") or 50)
    return max(0, min(100, base + max(0, source_count - 1) * 3))


def merge_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    primary = deepcopy(group[0])
    sources = dedupe_sources([source for article in group for source in all_sources(article)])
    other_sources = sources[1:]

    primary["otherSources"] = other_sources
    primary["mentions"] = len(sources)
    primary["clusterTitles"] = unique_titles(other_sources, primary.get("title", ""))
    primary["sourceQuality"] = merge_quality(primary, len(sources))

    # Translations belong to the old text/source structure and are regenerated later.
    primary.pop("translations", None)
    primary.pop("translationMeta", None)
    return primary


def prune_unrelated_file_sources(article: dict[str, Any]) -> dict[str, Any]:
    """Remove UAP file-release sources from an unrelated primary article.

    A new top-level article must be created by the scanner before summaries are
    generated. Creating one here would attach the wrong summary to it.
    """
    if is_uap_file_release(article):
        return article

    other_sources = [deepcopy(source) for source in article.get("otherSources") or [] if isinstance(source, dict)]
    kept_sources = [source for source in other_sources if not source_is_uap_file_release(source)]
    if len(kept_sources) == len(other_sources):
        return article

    repaired = deepcopy(article)
    repaired["otherSources"] = kept_sources
    repaired["mentions"] = max(1, 1 + len(kept_sources))
    repaired["clusterTitles"] = unique_titles(kept_sources, repaired.get("title", ""))
    repaired["sourceQuality"] = merge_quality(repaired, repaired["mentions"])
    repaired.pop("translations", None)
    repaired.pop("translationMeta", None)
    return repaired


def prune_overmerged_sources(article: dict[str, Any]) -> dict[str, Any]:
    """Repair older feed items that were grouped too broadly in a previous run."""
    if not is_uap_file_release(article):
        return prune_unrelated_file_sources(article)

    primary_source = source_from_article(article)
    kept_other_sources = [
        deepcopy(source)
        for source in article.get("otherSources") or []
        if isinstance(source, dict) and source_is_uap_file_release(source)
    ]
    sources = dedupe_sources([primary_source] + kept_other_sources)
    repaired = deepcopy(article)
    repaired["otherSources"] = sources[1:]
    repaired["mentions"] = len(sources)
    repaired["clusterTitles"] = unique_titles(sources[1:], repaired.get("title", ""))
    repaired["sourceQuality"] = merge_quality(repaired, len(sources))
    repaired.pop("translations", None)
    repaired.pop("translationMeta", None)
    return repaired


def regroup(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    used: set[int] = set()
    merged: list[dict[str, Any]] = []

    for index, article in enumerate(articles):
        if index in used:
            continue
        group = [article]
        used.add(index)
        for other_index in range(index + 1, len(articles)):
            if other_index in used:
                continue
            if same_topic(article, articles[other_index]):
                group.append(articles[other_index])
                used.add(other_index)
        if len(group) > 1:
            merged.append(merge_group(group))
        else:
            merged.append(deepcopy(article))

    return [prune_overmerged_sources(article) for article in merged]


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = payload.get("articles") or []
    before = len(articles)
    payload["articles"] = regroup(articles)

    meta = payload.setdefault("scanMeta", {})
    meta["regroupedTopics"] = before - len(payload["articles"])
    meta["topicRegrouping"] = "title_summary_uap_file_release_v4"

    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
