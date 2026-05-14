#!/usr/bin/env python3
"""Regroup near-duplicate news items by title and article summary.

This pass runs after summaries exist. It keeps sources attached only when they
match the same story signature. Broad UAP terms alone are not enough to group two
articles together.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
NEWS_PATH = ROOT / "latest-news.json"
SPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[a-z0-9]+")

STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might new latest update report reports news says said about into "
    "after before over under this that these those watch video live first amid via than uap uaps "
    "ufo ufos unidentified anomalous aerial flying phenomena article source sources".split()
)

STRONG_TERMS = set(
    "aaro alien archive archives congress crash declassified disclosure document documents dod "
    "federal files foia government hearing image images military nasa nonhuman pentagon photos pilot "
    "radar records release released senate sighting sightings trump video videos war whistleblower "
    "ukraine ukrainian russia russian defense defence ministry cia lazar corbell cyprus pursue website".split()
)

UAP_RE = re.compile(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b")
FILE_RE = re.compile(r"\b(file|files|record|records|archive|archives|document|documents|video|videos|photo|photos|material|materials)\b")
RELEASE_RE = re.compile(r"\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?)\b")
US_GOV_RE = re.compile(r"\b(pentagon|department of war|defense department|defence department|dod|war\.gov|pursue|trump|united states|u\.s\.|us government|federal|state department|fbi|nasa)\b")
WEBSITE_RE = re.compile(r"\b(website|site|portal|war\.gov|hits|launch|launched|public view)\b")


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def words(text: str) -> list[str]:
    return [word for word in WORD_RE.findall(text.lower()) if len(word) > 2 and word not in STOP]


def word_set(text: str) -> set[str]:
    return set(words(text))


def story_key(text: str) -> str:
    raw = clean(text).lower()
    if "sleeping dog" in raw and re.search(r"\b(corbell|lazar|whistleblower|cia|ufo|uap)\b", raw):
        return "sleeping-dog-corbell"

    has_uap = bool(UAP_RE.search(raw))
    has_files = bool(FILE_RE.search(raw))
    has_release = bool(RELEASE_RE.search(raw))
    has_gov = bool(US_GOV_RE.search(raw))
    has_site = bool(WEBSITE_RE.search(raw))

    if has_uap and has_files and has_release and has_gov:
        return "us-uap-file-release"
    if has_uap and has_gov and has_site and (has_files or has_release):
        return "us-uap-file-release"
    if "pursue" in raw and has_uap and (has_files or has_release or has_site):
        return "us-uap-file-release"
    return ""


def article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([
        article.get("title", ""),
        article.get("description", ""),
        article.get("summary", ""),
    ]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def overlap_ratio(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def same_story_words(a_words: set[str], b_words: set[str]) -> bool:
    if not a_words or not b_words:
        return False
    shared = a_words & b_words
    shared_strong = shared & STRONG_TERMS
    a_strong = a_words & STRONG_TERMS
    b_strong = b_words & STRONG_TERMS
    ratio = overlap_ratio(a_words, b_words)

    if ratio >= 0.46 and len(shared) >= 4:
        return True
    if ratio >= 0.30 and len(shared_strong) >= 2:
        return True
    if a_strong and b_strong and not shared_strong:
        return False
    return ratio >= 0.36 and len(shared) >= 6


def same_story_article(a: dict[str, Any], b: dict[str, Any]) -> bool:
    a_text = article_text(a)
    b_text = article_text(b)
    a_key = story_key(a_text)
    b_key = story_key(b_text)
    if a_key or b_key:
        return a_key == b_key
    return same_story_words(word_set(a_text), word_set(b_text))


def same_story_source(article: dict[str, Any], source: dict[str, Any]) -> bool:
    a_text = article_text(article)
    s_text = source_text(source)
    a_key = story_key(a_text)
    s_key = story_key(s_text)
    if a_key or s_key:
        return a_key == s_key
    return same_story_words(word_set(a_text), word_set(s_text))


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "url": article.get("url") or article.get("link", ""),
        "link": article.get("link") or article.get("url", ""),
        "source": article.get("source", ""),
        "publishedAt": article.get("publishedAt") or article.get("detectedAt"),
    }


def dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
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
    return titles[:10]


def merge_quality(primary: dict[str, Any], source_count: int) -> int:
    base = int(primary.get("sourceQuality") or primary.get("quality") or 50)
    return max(0, min(100, base + max(0, source_count - 1) * 3))


def all_sources(article: dict[str, Any]) -> list[dict[str, Any]]:
    return [source_from_article(article)] + [source for source in article.get("otherSources") or [] if isinstance(source, dict)]


def merge_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    primary = max(group, key=lambda item: (int(item.get("quality") or 0), len(clean(item.get("summary"))), int(item.get("mentions") or 1)))
    merged = deepcopy(primary)
    sources = dedupe_sources([source for article in group for source in all_sources(article)])
    other_sources = [source for source in sources if source_key(source) != source_key(source_from_article(merged))]

    merged["otherSources"] = other_sources
    merged["mentions"] = max(1, 1 + len(other_sources))
    merged["clusterTitles"] = unique_titles(other_sources, merged.get("title", ""))
    merged["sourceQuality"] = merge_quality(merged, merged["mentions"])
    merged["quality"] = max(int(merged.get("quality") or 0), merged["sourceQuality"])
    merged.pop("translations", None)
    merged.pop("translationMeta", None)
    return merged


def prune_sources(article: dict[str, Any]) -> dict[str, Any]:
    other_sources = [deepcopy(source) for source in article.get("otherSources") or [] if isinstance(source, dict)]
    kept = [source for source in other_sources if same_story_source(article, source)]
    if len(kept) == len(other_sources):
        return article

    repaired = deepcopy(article)
    repaired["otherSources"] = dedupe_sources(kept)
    repaired["mentions"] = max(1, 1 + len(repaired["otherSources"]))
    repaired["clusterTitles"] = unique_titles(repaired["otherSources"], repaired.get("title", ""))
    repaired["sourceQuality"] = merge_quality(repaired, repaired["mentions"])
    repaired.pop("translations", None)
    repaired.pop("translationMeta", None)
    return repaired


def regroup(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = [prune_sources(article) for article in articles if isinstance(article, dict)]
    used: set[int] = set()
    merged: list[dict[str, Any]] = []

    for index, article in enumerate(cleaned):
        if index in used:
            continue
        group = [article]
        used.add(index)
        for other_index in range(index + 1, len(cleaned)):
            if other_index in used:
                continue
            if same_story_article(article, cleaned[other_index]):
                group.append(cleaned[other_index])
                used.add(other_index)
        merged.append(merge_group(group) if len(group) > 1 else article)

    return merged


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = payload.get("articles") or []
    before = len(articles)
    payload["articles"] = regroup(articles)

    meta = payload.setdefault("scanMeta", {})
    meta["regroupedTopics"] = before - len(payload["articles"])
    meta["topicRegrouping"] = "title_summary_story_signature_v6"
    meta["topicGroupingPolicy"] = "story_signature_or_title_summary_similarity; broad_uap_terms_alone_do_not_group"

    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
