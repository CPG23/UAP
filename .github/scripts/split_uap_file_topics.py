#!/usr/bin/env python3
"""Split unrelated grouped sources before summaries are enriched.

The first scanner pass groups from RSS title/description only. This guard prevents
one broad article from swallowing different stories as sources. Any source whose
title does not share a clear topic signature with the primary article is promoted
back to its own top-level article before the summary pipeline runs.
"""

from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[a-z0-9]+")

STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might new latest update report reports news says said about "
    "into after before over under this that these those watch video live first amid via than "
    "uap uaps ufo ufos unidentified anomalous aerial flying phenomena".split()
)

STRONG_TERMS = set(
    "aaro alien archive archives congress crash declassified disclosure document documents dod "
    "federal files foia government hearing image images military nasa nonhuman pentagon photos "
    "pilot radar records release released senate sighting sightings trump video videos war whistleblower".split()
)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def words(text: str) -> list[str]:
    return [word for word in WORD_RE.findall(text.lower()) if len(word) > 2 and word not in STOP]


def word_set(text: str) -> set[str]:
    return set(words(text))


def topic_id(title: str) -> str:
    return "-".join(sorted(word_set(title))[:10]) or "article"


def article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([
        article.get("title", ""),
        article.get("description", ""),
        article.get("summary", ""),
    ]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def overlap_ratio(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def same_story(article: dict[str, Any], source: dict[str, Any]) -> bool:
    primary_words = word_set(article_text(article))
    source_words = word_set(source_text(source))
    if not primary_words or not source_words:
        return False

    shared = primary_words & source_words
    shared_strong = shared & STRONG_TERMS
    source_strong = source_words & STRONG_TERMS
    primary_strong = primary_words & STRONG_TERMS

    if overlap_ratio(primary_words, source_words) >= 0.42 and len(shared) >= 3:
        return True
    if len(shared_strong) >= 2 and overlap_ratio(primary_words, source_words) >= 0.24:
        return True
    if source_strong and primary_strong and not shared_strong:
        return False
    return len(shared) >= 5 and overlap_ratio(primary_words, source_words) >= 0.30


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


def rank_source(source: dict[str, Any]) -> tuple[int, int]:
    title = clean(source.get("title"))
    return (1 if source.get("url") or source.get("link") else 0, len(title))


def make_article_from_source(source: dict[str, Any], template: dict[str, Any]) -> dict[str, Any]:
    title = clean(source.get("title"))
    link = clean(source.get("url") or source.get("link"))
    quality = max(45, min(100, int(template.get("quality") or 50) - 5))
    return {
        "id": topic_id(title),
        "title": title,
        "source": clean(source.get("source")) or "UAP News",
        "link": link,
        "date": template.get("date"),
        "publishedAt": source.get("publishedAt") or template.get("publishedAt"),
        "summary": "",
        "mentions": 1,
        "otherSources": [],
        "clusterTitles": [],
        "quality": quality,
        "qualityBreakdown": template.get("qualityBreakdown", []),
        "qualityExplanation": template.get("qualityExplanation", ""),
        "matchedTerms": sorted((word_set(title) & STRONG_TERMS))[:8],
        "sourceQuality": quality,
        "summaryStatus": {"articleContentSummary": "pending"},
    }


def split_article(article: dict[str, Any]) -> list[dict[str, Any]]:
    other_sources = [deepcopy(source) for source in article.get("otherSources") or [] if isinstance(source, dict)]
    if not other_sources:
        return [article]

    kept = []
    split = []
    for source in other_sources:
        if same_story(article, source):
            kept.append(source)
        else:
            split.append(source)

    if not split:
        return [article]

    repaired = deepcopy(article)
    kept = dedupe(kept)
    repaired["otherSources"] = kept
    repaired["mentions"] = max(1, 1 + len(kept))
    repaired["clusterTitles"] = cluster_titles(kept, repaired.get("title", ""))
    repaired.pop("translations", None)
    repaired.pop("translationMeta", None)

    promoted = [make_article_from_source(source, article) for source in sorted(dedupe(split), key=rank_source, reverse=True)]
    return [repaired] + promoted


def merge_duplicates(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for article in articles:
        key = clean(article.get("id")) or topic_id(article.get("title", ""))
        if key not in merged:
            merged[key] = article
            order.append(key)
            continue
        existing = merged[key]
        sources = dedupe(existing.get("otherSources", []) + [
            {
                "title": article.get("title", ""),
                "url": article.get("link", ""),
                "link": article.get("link", ""),
                "source": article.get("source", ""),
                "publishedAt": article.get("publishedAt"),
            }
        ] + article.get("otherSources", []))
        existing["otherSources"] = sources
        existing["mentions"] = max(existing.get("mentions", 1), 1 + len(sources))
        existing["clusterTitles"] = cluster_titles(sources, existing.get("title", ""))
    return [merged[key] for key in order]


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = payload.get("articles") or []
    split: list[dict[str, Any]] = []
    created = 0
    for article in articles:
        parts = split_article(article) if isinstance(article, dict) else [article]
        created += max(0, len(parts) - 1)
        split.extend(parts)

    payload["articles"] = merge_duplicates(split)
    meta = payload.setdefault("scanMeta", {})
    meta["splitUnrelatedGroupedSources"] = created
    meta["splitGroupedSourcesPolicy"] = "title_description_summary_similarity_before_enrichment"
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"split unrelated grouped sources: created={created}")


if __name__ == "__main__":
    main()
