#!/usr/bin/env python3
"""Normalize story clusters and ratings after regrouping.

This final guard compares articles by a general story fingerprint: title,
description, summary, source title, event type, actors, and weighted keyword
similarity. It avoids hard-coding current headlines while still merging clear
coverage of the same story.
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
    "will would could should may might new latest update report reports news says said about into "
    "after before over under this that these those watch video live first amid via than public "
    "article source sources uap uaps ufo ufos unidentified anomalous aerial flying phenomena"
    .split()
)
STRONG = set(
    "aaro alien archive archives congress crash declassified disclosure document documents dod federal files foia "
    "government hearing image images military nasa nonhuman pentagon photos pilot radar records release released "
    "senate sighting sightings trump video videos war whistleblower ministry defense defence advisor website portal transparency"
    .split()
)
LOW_TRUST_RE = re.compile(r"\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b", re.I)
TRUSTED_RE = re.compile(r"\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters)\b", re.I)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "article"


def words(text: str) -> list[str]:
    return [word for word in WORD_RE.findall(clean(text).lower()) if len(word) > 2 and word not in STOP]


def word_set(text: str) -> set[str]:
    return set(words(text))


def overlap_ratio(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def event_profile(text: str) -> tuple[str, set[str]]:
    raw = clean(text).lower()
    has_uap = bool(re.search(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b", raw))
    has_files = bool(re.search(r"\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b", raw))
    has_release = bool(re.search(r"\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b", raw))
    has_program = bool(re.search(r"\b(program|tracking|monitoring|studying|study|directive|advisor|ministry|minister)\b", raw))
    has_sighting = bool(re.search(r"\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b", raw))
    has_film = bool(re.search(r"\b(film|movie|documentary|sleeping dog|trailer|director)\b", raw))

    event = ""
    if has_uap and has_files and has_release:
        event = "file-release"
    elif has_uap and has_program:
        event = "program"
    elif has_uap and has_film:
        event = "film"
    elif has_uap and has_sighting:
        event = "sighting"

    actors: set[str] = set()
    actor_patterns = [
        ("us", r"\b(us|u\.s\.|united states|american|pentagon|department of war|defense department|defence department|dod|war\.gov|federal|trump|state department|fbi)\b"),
        ("ukraine", r"\b(ukraine|ukrainian)\b"),
        ("japan", r"\bjapan\b"),
        ("russia", r"\b(russia|russian)\b"),
        ("china", r"\b(china|chinese)\b"),
        ("nasa", r"\bnasa\b"),
        ("congress", r"\b(congress|senate|representative|hearing)\b"),
        ("aaro", r"\baaro\b"),
        ("corbell-lazar", r"\b(corbell|lazar)\b"),
    ]
    for actor, pattern in actor_patterns:
        if re.search(pattern, raw):
            actors.add(actor)
    return event, actors


def actor_compatible(a: set[str], b: set[str]) -> bool:
    return not a or not b or bool(a & b)


def same_story_text(a_text: str, b_text: str) -> bool:
    a_event, a_actors = event_profile(a_text)
    b_event, b_actors = event_profile(b_text)
    if a_event or b_event:
        return bool(a_event and a_event == b_event and actor_compatible(a_actors, b_actors))

    a_words = word_set(a_text)
    b_words = word_set(b_text)
    shared = a_words & b_words
    ratio = overlap_ratio(a_words, b_words)
    shared_strong = shared & STRONG
    return (
        (ratio >= 0.48 and len(shared) >= 4)
        or (ratio >= 0.32 and len(shared_strong) >= 2)
        or (ratio >= 0.38 and len(shared) >= 6)
    )


def article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([article.get("title", ""), article.get("description", ""), article.get("summary", "")]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def candidate_text(candidate: dict[str, Any]) -> str:
    return article_text(candidate["article"]) if candidate["kind"] == "article" else source_text(candidate["source"])


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": article.get("title", ""),
        "url": article.get("url") or article.get("link", ""),
        "link": article.get("link") or article.get("url", ""),
        "source": article.get("source", ""),
        "publishedAt": article.get("publishedAt") or article.get("detectedAt") or article.get("date"),
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


def rank_source(source: dict[str, Any]) -> tuple[int, int]:
    trusted = 1 if TRUSTED_RE.search(clean(source.get("source"))) else 0
    return trusted, len(clean(source.get("title")))


def source_points(mentions: int) -> int:
    return min(28, max(0, mentions - 1) * 7)


def quality_cap(article: dict[str, Any], mentions: int) -> int:
    if mentions > 1:
        return 100
    if LOW_TRUST_RE.search(clean(article.get("source"))):
        return 72
    return 84


def normalize_quality(article: dict[str, Any]) -> dict[str, Any]:
    mentions = max(1, int(article.get("mentions") or 1))
    parts = [p for p in article.get("qualityBreakdown") or [] if isinstance(p, dict) and p.get("label") != "Mehrere Quellen"]
    points = source_points(mentions)
    if points:
        parts.append({"label": "Mehrere Quellen", "points": points, "text": f"{mentions} Quellen im aktuellen Feed."})
    score = sum(int(p.get("points") or 0) for p in parts) if parts else int(article.get("quality") or article.get("sourceQuality") or 50)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(quality_cap(article, mentions), score))
    article["sourceQuality"] = article["quality"]
    return article


def group_article(group: list[dict[str, Any]]) -> dict[str, Any]:
    templates = [candidate["article"] for candidate in group if candidate["kind"] == "article"]
    template = max(templates, key=lambda article: len(article_text(article)), default={})
    article = deepcopy(template)
    sources: list[dict[str, Any]] = []
    for candidate in group:
        if candidate["kind"] == "article":
            sources.append(source_from_article(candidate["article"]))
            sources.extend(candidate["article"].get("otherSources") or [])
        else:
            sources.append(candidate["source"])
    sources = sorted(dedupe_sources(sources), key=rank_source, reverse=True)
    primary = sources[0] if sources else {}
    other = sources[1:]
    event, _actors = event_profile(candidate_text(group[0]))
    article.update({
        "id": slug(f"{event}-{clean(primary.get('title')) or article.get('title', 'article')}"),
        "title": clean(primary.get("title")) or clean(article.get("title")) or "UAP News",
        "source": clean(primary.get("source")) or clean(article.get("source")) or "UAP News",
        "link": clean(primary.get("link") or primary.get("url") or article.get("link") or article.get("url")),
        "publishedAt": primary.get("publishedAt") or article.get("publishedAt") or article.get("date"),
        "mentions": max(1, 1 + len(other)),
        "otherSources": other,
        "clusterTitles": [clean(source.get("title")) for source in other if clean(source.get("title"))][:10],
    })
    if not templates:
        article["summary"] = ""
    article.pop("translations", None)
    article.pop("translationMeta", None)
    return normalize_quality(article)


def normalize(payload: dict[str, Any]) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for article in payload.get("articles") or []:
        if not isinstance(article, dict) or not clean(article.get("title")):
            continue
        candidates.append({"kind": "article", "article": article})
        for source in article.get("otherSources") or []:
            if isinstance(source, dict) and clean(source.get("title")):
                candidates.append({"kind": "source", "source": source, "template": article})

    used: set[int] = set()
    groups: list[list[dict[str, Any]]] = []
    for index, candidate in enumerate(candidates):
        if index in used:
            continue
        group = [candidate]
        used.add(index)
        for other_index in range(index + 1, len(candidates)):
            if other_index not in used and same_story_text(candidate_text(candidate), candidate_text(candidates[other_index])):
                group.append(candidates[other_index])
                used.add(other_index)
        groups.append(group)

    articles = [group_article(group) for group in groups]
    articles = [article for article in articles if clean(article.get("title"))]
    articles.sort(key=lambda article: (int(article.get("quality") or 0), clean(article.get("publishedAt") or article.get("date"))), reverse=True)
    payload["articles"] = articles
    payload["summaries"] = {a["id"]: a.get("summary", "") for a in articles if a.get("id")}
    meta = payload.setdefault("scanMeta", {})
    meta["normalizedClusters"] = "generic_story_similarity_v2"
    return payload


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    NEWS_PATH.write_text(json.dumps(normalize(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("normalized feed clusters and ratings with generic story similarity")


if __name__ == "__main__":
    main()
