#!/usr/bin/env python3
"""Final guard for display-ready UAP feed clusters.

Earlier pipeline stages may promote sources, regroup stories and repair summaries.
This last pass keeps the mobile app data honest: unrelated sources are removed
from a cluster, duplicate top-level stories are merged, source counts are rebuilt,
rating is recalculated from the final visible source set, and stale summaries are
cleared when they clearly describe a different topic than the article title.
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
LOW_TRUST_RE = re.compile(r"\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b", re.I)
TRUSTED_RE = re.compile(r"\b(\.gov|department|pbs|ap news|associated press|bbc|abc|sky|cbc|al jazeera|axios|reuters|npr|guardian)\b", re.I)

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


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "article"


def words(text: Any) -> set[str]:
    return {word for word in WORD_RE.findall(clean(text).lower()) if len(word) > 2 and word not in STOP}


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


def core_article_text(article: dict[str, Any]) -> str:
    return clean(" ".join([article.get("title", ""), article.get("description", ""), article.get("source", "")]))


def article_match_text(article: dict[str, Any]) -> str:
    return clean(" ".join([
        article.get("title", ""),
        article.get("description", ""),
        article.get("source", ""),
        article.get("summary", ""),
        " ".join(article.get("clusterTitles") or []),
    ]))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def story_signature(text: Any) -> str:
    raw = clean(text).lower()
    has_uap = bool(re.search(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b", raw))
    has_files = bool(re.search(r"\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b", raw))
    has_release = bool(re.search(r"\b(release|released|releases|releasing|declassif|unseal|unsealed|unsealing|publish|published|posting|posted|opens?|drops?|transparency|public archive)\b", raw))
    has_us = bool(re.search(r"\b(us|u\.s\.|united states|american|pentagon|department of war|defense department|defence department|dod|war\.gov|federal|trump|state department|fbi|white house|ap news|associated press)\b", raw))
    file_release_phrase = bool(re.search(r"\b(shed light|same old material|draw their own conclusions|public view|public archive|pursue|presidential unsealing|reporting system|new batch|massive ufo file archive)\b", raw))

    if "sleeping dog" in raw or re.search(r"\b(corbell|bob lazar)\b", raw):
        return "film:sleeping-dog"
    if re.search(r"\b(ukraine|ukrainian)\b", raw) and re.search(r"\b(advisor|minister|ministry|armed forces|military|russia|russian|defence|defense|wartime|war|tracking|program)\b", raw):
        return "program:ukraine"
    if "immaculate constellation" in raw:
        return "program:immaculate-constellation"
    if re.search(r"\b(longmont)\b", raw):
        return "sighting:longmont"
    if re.search(r"\b(az|arizona)\b", raw) and has_uap:
        return "sighting:arizona"
    if re.search(r"\b(oregon|mcminnville|ufo festival|mcmenamins)\b", raw):
        return "event:oregon-festival"
    if re.search(r"\b(pastor|pastors|biblical|prophecy|nephilim|boebert|translucent beings)\b", raw):
        return "reaction:religious-disclosure"
    if re.search(r"\b(uri geller|burchett|holy crap|next set|next batch|next set of ufo files)\b", raw):
        return "reaction:future-files"
    if re.search(r"\b(japan|tokyo)\b", raw) and has_uap and (has_files or has_release or "disclosure" in raw):
        return "file-release:japan"
    if has_uap and (has_files or "pursue" in raw) and has_us and (has_release or file_release_phrase):
        return "file-release:us"
    if has_uap and has_us and re.search(r"\b(website|site|portal|war\.gov|pursue|public view)\b", raw) and (has_files or has_release):
        return "file-release:us"
    if has_uap and re.search(r"\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b", raw):
        location = ""
        for candidate in ["ukraine", "arizona", "longmont", "oregon", "florida", "japan"]:
            if candidate in raw:
                location = candidate
                break
        return "sighting:" + location if location else "sighting:generic"
    return ""


def summary_conflicts(article: dict[str, Any], summary: str | None = None) -> bool:
    summary = clean(summary if summary is not None else article.get("summary", ""))
    if not summary:
        return False
    core_sig = story_signature(core_article_text(article))
    summary_sig = story_signature(summary)
    if core_sig and summary_sig and core_sig != summary_sig:
        return True
    core = core_article_text(article).lower()
    if summary_sig == "program:immaculate-constellation" and "immaculate constellation" not in core:
        return True
    if summary_sig == "program:ukraine" and not re.search(r"\b(ukraine|ukrainian)\b", core, re.I):
        return True
    return False


def clear_conflicting_summary(article: dict[str, Any]) -> dict[str, Any]:
    if summary_conflicts(article):
        article["summary"] = ""
        article.pop("translation", None)
        article.pop("translations", None)
    return article


def overlap_ratio(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def lexical_same_story(a_text: str, b_text: str) -> bool:
    a_words = words(a_text)
    b_words = words(b_text)
    shared = a_words & b_words
    shared_strong = shared & STRONG
    ratio = overlap_ratio(a_words, b_words)
    return (
        (ratio >= 0.48 and len(shared) >= 4)
        or (ratio >= 0.32 and len(shared_strong) >= 2)
        or (ratio >= 0.38 and len(shared) >= 6)
    )


def same_story_text(a_text: str, b_text: str) -> bool:
    a_sig = story_signature(a_text)
    b_sig = story_signature(b_text)
    if a_sig or b_sig:
        if not (a_sig and b_sig):
            return False
        if a_sig != b_sig:
            return False
        if a_sig == "sighting:generic":
            return lexical_same_story(a_text, b_text)
        return True
    return lexical_same_story(a_text, b_text)


def same_story_article(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return same_story_text(article_match_text(a), article_match_text(b))


def same_story_source(article: dict[str, Any], source: dict[str, Any]) -> bool:
    return same_story_text(article_match_text(article), source_text(source))


def dedupe_sources(sources: list[dict[str, Any]], primary: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    primary_key = source_key(source_from_article(primary)) if primary else ""
    primary_title = slug(primary.get("title", "")) if primary else ""
    for source in sources:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key in seen or key == primary_key:
            continue
        if primary_title and slug(source.get("title", "")) == primary_title:
            continue
        seen.add(key)
        result.append(source)
    return result


def prune_article_sources(article: dict[str, Any]) -> dict[str, Any]:
    repaired = clear_conflicting_summary(deepcopy(article))
    kept = [
        deepcopy(source)
        for source in repaired.get("otherSources") or []
        if isinstance(source, dict) and same_story_source(repaired, source)
    ]
    repaired["otherSources"] = dedupe_sources(kept, repaired)
    repaired["mentions"] = max(1, 1 + len(repaired["otherSources"]))
    repaired["clusterTitles"] = [clean(source.get("title")) for source in repaired["otherSources"] if clean(source.get("title"))][:10]
    return repaired


def source_rank(source: dict[str, Any]) -> tuple[int, int, str]:
    trusted = 1 if TRUSTED_RE.search(clean(source.get("source"))) else 0
    return trusted, len(clean(source.get("title"))), clean(source.get("publishedAt"))


def source_points(mentions: int) -> int:
    if mentions >= 20:
        return 40
    if mentions >= 10:
        return 34
    if mentions >= 5:
        return 24
    return max(0, (mentions - 1) * 5)


def quality_cap(article: dict[str, Any], mentions: int, signature: str) -> int:
    if signature.startswith("film:"):
        return 76
    if mentions <= 1 and LOW_TRUST_RE.search(clean(article.get("source"))):
        return 72
    if mentions <= 1:
        return 84
    return 100


def normalize_quality(article: dict[str, Any]) -> dict[str, Any]:
    mentions = max(1, int(article.get("mentions") or 1))
    signature = story_signature(article_match_text(article))
    parts = [p for p in article.get("qualityBreakdown") or [] if isinstance(p, dict) and p.get("label") != "Mehrere Quellen"]
    points = source_points(mentions)
    if points:
        parts.append({"label": "Mehrere Quellen", "points": points, "text": f"{mentions} Quellen im aktuellen Feed."})
    score = sum(int(p.get("points") or 0) for p in parts) if parts else int(article.get("quality") or article.get("sourceQuality") or 50)
    if signature == "file-release:us" and mentions >= 20:
        score = max(score, 90)
    elif signature == "file-release:us" and mentions >= 10:
        score = max(score, 86)
    elif signature == "file-release:us" and mentions >= 3:
        score = max(score, 82)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(quality_cap(article, mentions, signature), score))
    article["sourceQuality"] = article["quality"]
    return article


def best_valid_summary(merged: dict[str, Any], group: list[dict[str, Any]]) -> str:
    candidates = sorted((clean(article.get("summary")) for article in group), key=len, reverse=True)
    for candidate in candidates:
        if candidate and not summary_conflicts(merged, candidate):
            return candidate
    return ""


def merge_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    primary = max(group, key=lambda article: (int(article.get("quality") or 0), int(article.get("mentions") or 1), len(clean(article.get("summary")))))
    merged = clear_conflicting_summary(deepcopy(primary))
    sources: list[dict[str, Any]] = []
    for article in group:
        sources.append(source_from_article(article))
        sources.extend(article.get("otherSources") or [])
    sources = sorted(dedupe_sources(sources, merged), key=source_rank, reverse=True)
    merged["otherSources"] = sources
    merged["mentions"] = max(1, 1 + len(sources))
    merged["clusterTitles"] = [clean(source.get("title")) for source in sources if clean(source.get("title"))][:10]
    merged["summary"] = best_valid_summary(merged, group)
    merged.pop("translations", None)
    merged.pop("translationMeta", None)
    return normalize_quality(merged)


def merge_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
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
            if same_story_article(article, articles[other_index]):
                group.append(articles[other_index])
                used.add(other_index)
        merged.append(merge_group(group) if len(group) > 1 else normalize_quality(clear_conflicting_summary(article)))
    return merged


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    raw_articles = [article for article in payload.get("articles") or [] if isinstance(article, dict) and clean(article.get("title"))]
    pruned = [prune_article_sources(article) for article in raw_articles]
    articles = merge_articles(pruned)
    articles.sort(key=lambda article: (int(article.get("quality") or 0), clean(article.get("publishedAt") or article.get("date"))), reverse=True)

    payload["articles"] = articles
    payload["summaries"] = {article["id"]: article.get("summary", "") for article in articles if article.get("id") and article.get("summary")}
    meta = payload.setdefault("scanMeta", {})
    meta["finalFeedIntegrity"] = {
        "policy": "prune_unrelated_sources_merge_same_story_recalculate_quality_v4_us_file_release",
        "inputArticles": len(raw_articles),
        "outputArticles": len(articles),
        "clearedConflictingSummaries": sum(1 for article in articles if not clean(article.get("summary"))),
    }
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"final feed integrity: input={len(raw_articles)} output={len(articles)}")


if __name__ == "__main__":
    main()
