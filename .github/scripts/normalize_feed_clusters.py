#!/usr/bin/env python3
"""Normalize story clusters and ratings after regrouping.

This final guard keeps broad UAP/Disclosure language from mixing unrelated
stories, while still joining clear coverage of the same file-release event.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")

UAP_RE = re.compile(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b")
FILE_RE = re.compile(r"\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b")
RELEASE_RE = re.compile(r"\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b")
US_CONTEXT_RE = re.compile(r"\b(us|u\.s\.|united states|government|federal|pentagon|department of war|defense department|defence department|dod|war\.gov|pursue|trump|state department|fbi|nasa|green men|public can|draw.*conclusions|transparency push|historic public release)\b")
LOW_TRUST_RE = re.compile(r"\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b", re.I)

SUMMARIES = {
    "us-uap-file-release": "The U.S. Department of War/Pentagon has begun releasing UFO/UAP records through a public archive, with officials saying readers can review the material and draw their own conclusions.",
    "ukraine-uap-program": "A Ukrainian defense adviser said Ukraine tracks unidentified aerial activity as part of wartime security monitoring, because unusual objects could indicate new Russian technology or other threats.",
    "japan-uap-files": "The article reports that Japan may release or examine UAP-related files after renewed public attention on U.S. and Ukrainian UFO disclosures.",
    "sleeping-dog-corbell": "The article concerns Jeremy Corbell, Bob Lazar or related claims around the film Sleeping Dog and alleged UFO or intelligence-community material.",
}


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "article"


def story_key(text: str) -> str:
    raw = clean(text).lower()
    has_uap = bool(UAP_RE.search(raw))
    has_files = bool(FILE_RE.search(raw))
    has_release = bool(RELEASE_RE.search(raw))
    has_us_context = bool(US_CONTEXT_RE.search(raw))

    if "sleeping dog" in raw and re.search(r"\b(corbell|lazar|whistleblower|cia|ufo|uap)\b", raw):
        return "sleeping-dog-corbell"
    if re.search(r"\b(ukraine|ukrainian)\b", raw) and re.search(r"\b(advisor|minister|ministry|armed forces|military|russia|russian|defence|defense|wartime|war)\b", raw):
        return "ukraine-uap-program"
    if re.search(r"\bjapan\b", raw) and has_uap and (has_files or has_release or "disclosure" in raw):
        return "japan-uap-files"
    if has_uap and has_files and has_release and has_us_context:
        return "us-uap-file-release"
    if has_uap and has_files and has_release and not re.search(r"\b(ukraine|ukrainian|japan|russia|russian|china|chinese)\b", raw):
        return "us-uap-file-release"
    return ""


def article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([article.get("title", ""), article.get("description", ""), article.get("summary", "")]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


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
    src = clean(source.get("source")).lower()
    trusted = 1 if re.search(r"\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters)\b", src) else 0
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


def group_article(key: str, sources: list[dict[str, Any]], template: dict[str, Any]) -> dict[str, Any]:
    sources = sorted(dedupe_sources(sources), key=rank_source, reverse=True)
    primary = sources[0] if sources else {}
    other = sources[1:]
    article = deepcopy(template)
    article.update({
        "id": key,
        "title": clean(primary.get("title")) or clean(template.get("title")) or "UAP News",
        "source": clean(primary.get("source")) or "UAP News",
        "link": clean(primary.get("link") or primary.get("url")),
        "publishedAt": primary.get("publishedAt") or template.get("publishedAt") or template.get("date"),
        "summary": SUMMARIES.get(key) or template.get("summary", ""),
        "mentions": max(1, 1 + len(other)),
        "otherSources": other,
        "clusterTitles": [clean(source.get("title")) for source in other if clean(source.get("title"))][:10],
    })
    article.pop("translations", None)
    article.pop("translationMeta", None)
    return normalize_quality(article)


def normalize(payload: dict[str, Any]) -> dict[str, Any]:
    buckets: dict[str, dict[str, Any]] = {}
    result: list[dict[str, Any]] = []

    def add_bucket(key: str, source: dict[str, Any], template: dict[str, Any]) -> None:
        bucket = buckets.setdefault(key, {"sources": [], "template": template})
        bucket["sources"].append(source)
        if len(clean(template.get("summary"))) > len(clean(bucket.get("template", {}).get("summary"))):
            bucket["template"] = template

    for article in payload.get("articles") or []:
        if not isinstance(article, dict):
            continue
        article_key = story_key(article_text(article))
        remaining_sources: list[dict[str, Any]] = []
        for source in article.get("otherSources") or []:
            if not isinstance(source, dict):
                continue
            key = story_key(source_text(source))
            if key:
                add_bucket(key, source, article)
            else:
                remaining_sources.append(source)
        if article_key:
            add_bucket(article_key, source_from_article(article), article)
        else:
            repaired = deepcopy(article)
            repaired["otherSources"] = dedupe_sources(remaining_sources)
            repaired["mentions"] = max(1, 1 + len(repaired["otherSources"]))
            repaired["clusterTitles"] = [clean(source.get("title")) for source in repaired["otherSources"] if clean(source.get("title"))][:10]
            result.append(normalize_quality(repaired))

    for key, bucket in buckets.items():
        result.append(group_article(key, bucket["sources"], bucket.get("template", {})))

    result.sort(key=lambda article: (int(article.get("quality") or 0), clean(article.get("publishedAt") or article.get("date"))), reverse=True)
    payload["articles"] = result
    payload["summaries"] = {a["id"]: a.get("summary", "") for a in result if a.get("id")}
    meta = payload.setdefault("scanMeta", {})
    meta["normalizedClusters"] = "story_key_file_release_and_rating_v1"
    return payload


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    NEWS_PATH.write_text(json.dumps(normalize(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("normalized feed clusters and ratings")


if __name__ == "__main__":
    main()
