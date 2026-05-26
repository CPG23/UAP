#!/usr/bin/env python3
"""Final title/summary based cluster guard for the app feed.

The app should cluster articles that describe the same story, using title plus
summary when available and falling back to title-only matching when a summary is
missing. This pass runs after source backfills so late additions cannot mix
unrelated stories into a visible card.
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
TITLE_ONLY_SUMMARY_CHARS = 140
MISSING_STATUS = {
    "articleContentSummary": "missing",
    "message": "Keine verlässliche Zusammenfassung verfügbar. GitHub versucht beim nächsten Scan automatisch, diese zu ergänzen.",
}

STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might new latest update report reports news says said about into "
    "after before over under this that these those watch video live first amid via than public "
    "article source sources uap uaps ufo ufos unidentified anomalous aerial flying phenomena "
    "claim claims claimed alleging alleged insider government custody program secret multiple different"
    .split()
)
ALIASES = {
    "alleges": "claim",
    "alleged": "claim",
    "claims": "claim",
    "claimed": "claim",
    "claiming": "claim",
    "retrieved": "recover",
    "retrieves": "recover",
    "recovered": "recover",
    "recovery": "recover",
    "retrieval": "recover",
    "retrievals": "recover",
    "crashed": "crash",
    "crashes": "crash",
    "downed": "crash",
    "bodies": "remains",
    "biologics": "remains",
    "biological": "biological",
    "species": "species",
    "beings": "species",
    "lifeforms": "species",
    "lifeform": "species",
    "forms": "species",
    "files": "file",
    "documents": "document",
    "videos": "video",
    "released": "release",
    "releases": "release",
    "declassified": "declassify",
}
STRONG = set(
    "alien remains biological species recover crash spacecraft puthoff cia physicist researcher grusch "
    "coulthart trump briefed briefing legacy program file document video release declassify batch pentagon "
    "department war pursue lake huron shootdown los angeles spot sequoia humanoid superman"
    .split()
)
TRUSTED_RE = re.compile(r"\b(\.gov|department|reuters|ap news|associated press|bbc|abc|pbs|npr|guardian|axios)\b", re.I)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "article"


def words(text: Any) -> set[str]:
    result: set[str] = set()
    for word in WORD_RE.findall(clean(text).lower()):
        if len(word) <= 2 or word in STOP:
            continue
        result.add(ALIASES.get(word, word))
    return result


def text_of(*parts: Any) -> str:
    return clean(" ".join(clean(part) for part in parts))


def article_text(article: dict[str, Any], include_summary: bool = True) -> str:
    parts = [article.get("title", ""), article.get("description", ""), article.get("source", "")]
    if include_summary:
        parts.append(article.get("summary", ""))
    return text_of(*parts)


def source_text(source: dict[str, Any]) -> str:
    return text_of(source.get("title", ""), source.get("source", ""))


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def source_from_article(article: dict[str, Any]) -> dict[str, Any]:
    source = {
        "title": article.get("title", ""),
        "source": article.get("source", ""),
        "link": article.get("link") or article.get("url", ""),
        "url": article.get("url") or article.get("link", ""),
        "publishedAt": article.get("publishedAt") or article.get("date", ""),
    }
    for key in ("displayedAt", "sourceDisplayedAt", "isNew", "sourceIsNew"):
        if key in article:
            source[key] = article[key]
    return source


def overlap_ratio(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def story_signature(text: Any) -> str:
    raw = clean(text).lower()
    token_set = words(raw)
    has_uap = bool(re.search(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|alien)\b", raw))
    has_file = bool({"file", "document", "video", "record", "archive", "transcript"} & token_set)
    has_release = bool({"release", "declassify", "batch", "pursue"} & token_set) or "war.gov" in raw

    if "sleeping dog" in raw or re.search(r"\b(corbell|bob lazar)\b", raw):
        return "film:sleeping-dog"
    if re.search(r"\b(lake huron|shootdown|shot down|downed object)\b", raw):
        return "sighting:lake-huron"
    if re.search(r"\b(sequoia|superman|humanoid figure)\b", raw):
        return "sighting:sequoia-humanoid"
    if re.search(r"\b(los angeles|\bla\b|best places to spot|spot ufos)\b", raw):
        return "sighting:la-spotting"
    if re.search(r"\b(coulthart|trump|briefed|briefing)\b", raw) and re.search(r"\b(grusch|legacy|crash retrieval|retrieval program)\b", raw):
        return "claim:trump-briefing"
    if (
        ("puthoff" in token_set or "physicist" in token_set or "researcher" in token_set or "cia" in token_set)
        and {"alien", "species"} <= token_set
        and ({"recover", "remains", "biological", "crash", "spacecraft"} & token_set)
    ):
        return "claim:alien-species-recovered"
    if {"alien", "species", "recover"} <= token_set and ({"remains", "biological", "spacecraft", "crash"} & token_set):
        return "claim:alien-species-recovered"
    if has_uap and has_file and has_release and re.search(r"\b(pentagon|department of war|war\.gov|pursue|government|declassified|second batch|new batch)\b", raw):
        return "file-release:us"
    if has_uap and re.search(r"\b(sighting|sightings|spotted|seen|encounter|lights|orbs|object|objects)\b", raw):
        return "sighting:generic"
    return ""


def lexical_same_story(a_text: str, b_text: str, title_only: bool = False) -> bool:
    a_words = words(a_text)
    b_words = words(b_text)
    shared = a_words & b_words
    shared_strong = shared & STRONG
    ratio = overlap_ratio(a_words, b_words)
    if title_only:
        return (ratio >= 0.50 and len(shared) >= 4) or (ratio >= 0.34 and len(shared_strong) >= 3)
    return (ratio >= 0.46 and len(shared) >= 4) or (ratio >= 0.30 and len(shared_strong) >= 3) or (ratio >= 0.38 and len(shared) >= 6)


def same_story_text(a_text: str, b_text: str, title_only: bool = False) -> bool:
    a_sig = story_signature(a_text)
    b_sig = story_signature(b_text)
    if a_sig or b_sig:
        if not (a_sig and b_sig):
            return False
        if a_sig != b_sig:
            return False
        if a_sig == "sighting:generic":
            return lexical_same_story(a_text, b_text, title_only=title_only)
        return True
    return lexical_same_story(a_text, b_text, title_only=title_only)


def summary_matches_title(article: dict[str, Any]) -> bool:
    summary = clean(article.get("summary"))
    if not summary:
        return True
    title = clean(article.get("title"))
    title_sig = story_signature(title)
    summary_sig = story_signature(summary)
    if title_sig or summary_sig:
        return bool(title_sig and summary_sig and title_sig == summary_sig)
    title_words = words(title)
    summary_words = words(summary)
    if not title_words or not summary_words:
        return True
    shared = title_words & summary_words
    return len(shared & STRONG) >= 2 or overlap_ratio(title_words, summary_words) >= 0.22


def clear_bad_summary(article: dict[str, Any], summaries: dict[str, Any]) -> bool:
    if summary_matches_title(article):
        return False
    article["summary"] = ""
    article["summaryStatus"] = dict(MISSING_STATUS)
    article.pop("translation", None)
    article.pop("translations", None)
    article.pop("translationMeta", None)
    if article.get("id"):
        summaries.pop(article["id"], None)
    return True


def match_basis(article: dict[str, Any]) -> tuple[str, bool]:
    summary = clean(article.get("summary"))
    if len(summary) >= TITLE_ONLY_SUMMARY_CHARS:
        return article_text(article, include_summary=True), False
    return article_text(article, include_summary=False), True


def source_matches_article(article: dict[str, Any], source: dict[str, Any]) -> bool:
    basis, title_only = match_basis(article)
    return same_story_text(basis, source_text(source), title_only=title_only)


def dedupe_sources(sources: list[dict[str, Any]], primary: dict[str, Any]) -> list[dict[str, Any]]:
    seen = {source_key(source_from_article(primary))}
    primary_title = slug(primary.get("title", ""))
    result: list[dict[str, Any]] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key in seen:
            continue
        if primary_title and slug(source.get("title", "")) == primary_title:
            continue
        seen.add(key)
        result.append(source)
    return result


def source_rank(source: dict[str, Any]) -> tuple[int, str]:
    return (1 if TRUSTED_RE.search(clean(source.get("source"))) else 0, clean(source.get("publishedAt")))


def source_points(mentions: int) -> int:
    if mentions >= 20:
        return 40
    if mentions >= 10:
        return 34
    if mentions >= 5:
        return 24
    return max(0, (mentions - 1) * 5)


def refresh_quality(article: dict[str, Any]) -> None:
    mentions = max(1, int(article.get("mentions") or 1))
    parts = [p for p in article.get("qualityBreakdown") or [] if isinstance(p, dict) and p.get("label") != "Mehrere Quellen"]
    points = source_points(mentions)
    if points:
        parts.append({"label": "Mehrere Quellen", "points": points, "text": f"{mentions} Quellen im aktuellen Feed."})
    score = sum(int(p.get("points") or 0) for p in parts) if parts else int(article.get("quality") or article.get("sourceQuality") or 50)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(100, score))
    article["sourceQuality"] = article["quality"]


def prune_sources(article: dict[str, Any]) -> tuple[dict[str, Any], int]:
    repaired = deepcopy(article)
    original = [source for source in repaired.get("otherSources") or [] if isinstance(source, dict)]
    kept = [deepcopy(source) for source in original if source_matches_article(repaired, source)]
    repaired["otherSources"] = sorted(dedupe_sources(kept, repaired), key=source_rank, reverse=True)
    repaired["mentions"] = max(1, 1 + len(repaired["otherSources"]))
    repaired["clusterTitles"] = [clean(source.get("title")) for source in repaired["otherSources"] if clean(source.get("title"))][:10]
    refresh_quality(repaired)
    return repaired, len(original) - len(kept)


def article_same_story(a: dict[str, Any], b: dict[str, Any]) -> bool:
    a_text, a_title_only = match_basis(a)
    b_text, b_title_only = match_basis(b)
    return same_story_text(a_text, b_text, title_only=(a_title_only or b_title_only))


def best_summary(primary: dict[str, Any], group: list[dict[str, Any]]) -> str:
    candidates = sorted((clean(article.get("summary")) for article in group if clean(article.get("summary"))), key=len, reverse=True)
    probe = {"title": primary.get("title", ""), "summary": ""}
    for summary in candidates:
        probe["summary"] = summary
        if summary_matches_title(probe):
            return summary
    return ""


def merge_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    primary = max(group, key=lambda article: (int(article.get("quality") or 0), int(article.get("mentions") or 1), len(clean(article.get("summary"))))) )
    merged = deepcopy(primary)
    sources: list[dict[str, Any]] = []
    for article in group:
        if article is not primary:
            sources.append(source_from_article(article))
        sources.extend(article.get("otherSources") or [])
    merged["summary"] = best_summary(merged, group)
    if not merged["summary"]:
        merged["summaryStatus"] = dict(MISSING_STATUS)
        merged.pop("translation", None)
    kept = [source for source in sources if source_matches_article(merged, source)]
    merged["otherSources"] = sorted(dedupe_sources(kept, merged), key=source_rank, reverse=True)
    merged["mentions"] = max(1, 1 + len(merged["otherSources"]))
    merged["clusterTitles"] = [clean(source.get("title")) for source in merged["otherSources"] if clean(source.get("title"))][:10]
    merged.pop("translations", None)
    merged.pop("translationMeta", None)
    refresh_quality(merged)
    return merged


def merge_articles(articles: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    used: set[int] = set()
    merged: list[dict[str, Any]] = []
    merged_count = 0
    for index, article in enumerate(articles):
        if index in used:
            continue
        group = [article]
        used.add(index)
        for other_index in range(index + 1, len(articles)):
            if other_index in used:
                continue
            if article_same_story(article, articles[other_index]):
                group.append(articles[other_index])
                used.add(other_index)
        if len(group) > 1:
            merged_count += len(group) - 1
            merged.append(merge_group(group))
        else:
            merged.append(article)
    return merged, merged_count


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    summaries = payload.setdefault("summaries", {})
    raw_articles = [article for article in payload.get("articles") or [] if isinstance(article, dict)]

    summary_cleared = 0
    pruned_sources = 0
    cleaned: list[dict[str, Any]] = []
    for article in raw_articles:
        repaired = deepcopy(article)
        if clear_bad_summary(repaired, summaries):
            summary_cleared += 1
        repaired, removed = prune_sources(repaired)
        pruned_sources += removed
        cleaned.append(repaired)

    merged, merged_topics = merge_articles(cleaned)
    merged.sort(key=lambda article: (int(article.get("quality") or 0), clean(article.get("publishedAt") or article.get("date"))), reverse=True)
    payload["articles"] = merged
    payload["summaries"] = {article["id"]: article.get("summary", "") for article in merged if article.get("id") and clean(article.get("summary"))}
    meta = payload.setdefault("scanMeta", {})
    meta["finalClusterGuard"] = {
        "policy": "title_summary_cluster_guard_v1",
        "inputArticles": len(raw_articles),
        "outputArticles": len(merged),
        "mergedTopics": merged_topics,
        "prunedSources": pruned_sources,
        "clearedSummaries": summary_cleared,
    }
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "final cluster guard: "
        f"input={len(raw_articles)} output={len(merged)} merged={merged_topics} "
        f"pruned_sources={pruned_sources} cleared_summaries={summary_cleared}"
    )


if __name__ == "__main__":
    main()
