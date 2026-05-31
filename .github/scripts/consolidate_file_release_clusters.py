#!/usr/bin/env python3
"""Keep the second UAP file release as one visible topic only."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
UAP_RE = re.compile(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying)\b", re.I)
SECOND_FILE_RE = re.compile(
    r"\b(second batch|2nd batch|second release|release 02|new batch|new set|second set|new ufo files|more ufo files|declassified ufo files|government declassified ufo files|war\.gov/ufo|pursue|department of war publishes second release|what does the second batch)\b",
    re.I,
)
FILE_TERMS_RE = re.compile(r"\b(file|files|document|documents|video|videos|declassified|release|released|batch|tranche|pursue|war\.gov)\b", re.I)
NON_RELEASE_RE = re.compile(
    r"\b(alien soft launch|missing scientists|biological remains|life forms|dismembered|whistleblower|secret agent|coulthart|trump knows|pastor|translucent|avi loeb|alien species|crash retrieval|crashed ufos|lake huron|shootdown|shot down|downed object|best places to spot|spot ufos|los angeles|apollo 12|light mystery)\b",
    re.I,
)
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9'-]{3,}", re.I)
STOPWORDS = {
    "about", "after", "alleges", "amid", "also", "been", "being", "from", "have", "into", "more", "news", "over", "said", "says", "that", "their", "these", "this", "those", "through", "united", "with", "would",
}
SUMMARY = (
    "The Department of War says it is publishing the second release of declassified and historical Unidentified Anomalous Phenomena files as part of the Presidential Unsealing and Reporting System for UAP Encounters, or PURSUE. "
    "The release states that the collection remains housed on WAR.GOV/UFO and that additional files will be released on a rolling basis. "
    "Assistant to the Secretary of War for Public Affairs and Chief Pentagon Spokesman Sean Parnell is named as the source of the statement. "
    "The Department says WAR.GOV/UFO has received over 1 billion hits worldwide since its May 8, 2026 launch, which it frames as evidence of major public interest in the topic and in the Trump administration's transparency effort. "
    "The statement adds that the Department of War and agency partners are working on a third UAP file release, which will be announced in the near future."
)
MISSING_SUMMARY_STATUS = {
    "articleContentSummary": "missing",
    "message": "Keine verlaessliche Zusammenfassung verfuegbar. GitHub versucht beim naechsten Scan automatisch, diese zu ergaenzen.",
}


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "article"


def text_of(*values: Any) -> str:
    return clean(" ".join(clean(value) for value in values))


def source_text(source: dict[str, Any]) -> str:
    return text_of(source.get("title", ""), source.get("source", ""))


def article_headline_text(article: dict[str, Any]) -> str:
    parts = [article.get("title", ""), article.get("source", "")]
    parts.extend(article.get("clusterTitles") or [])
    return text_of(*parts)


def article_own_headline_text(article: dict[str, Any]) -> str:
    return text_of(article.get("title", ""), article.get("source", ""))


def article_text(article: dict[str, Any]) -> str:
    return text_of(article_headline_text(article), article.get("summary", ""))


def is_file_release_text(text: str) -> bool:
    if NON_RELEASE_RE.search(text):
        return False
    return bool(UAP_RE.search(text) and FILE_TERMS_RE.search(text) and SECOND_FILE_RE.search(text))


def is_file_release_source(source: dict[str, Any]) -> bool:
    return is_file_release_text(source_text(source))


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


def source_key(source: dict[str, Any]) -> str:
    return clean(source.get("url") or source.get("link") or source.get("title") or source.get("source")).lower()


def dedupe_sources(sources: list[dict[str, Any]], primary: dict[str, Any]) -> list[dict[str, Any]]:
    primary_key = source_key(source_from_article(primary))
    seen = {primary_key}
    result: list[dict[str, Any]] = []
    for source in sources:
        if not is_file_release_source(source):
            continue
        key = source_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(source)
    return result


def rank_article(article: dict[str, Any]) -> tuple[int, int, int, str]:
    title = clean(article.get("title"))
    source = clean(article.get("source"))
    score = 0
    if re.search(r"what does the second batch|pentagon releases|department of war publishes", title, re.I):
        score += 40
    if re.search(r"newsnation|department of war|\.gov|reuters", source, re.I):
        score += 20
    if clean(article.get("summary")):
        score += 10
    release_sources = sum(1 for source_item in article.get("otherSources") or [] if isinstance(source_item, dict) and is_file_release_source(source_item))
    return score, release_sources, int(article.get("mentions") or 1), clean(article.get("publishedAt") or article.get("date"))


def rank_source(source: dict[str, Any]) -> tuple[int, str]:
    title = clean(source.get("title"))
    publisher = clean(source.get("source"))
    text = source_text(source)
    score = 0
    if re.search(r"department of war publishes|war\.gov/ufo|pursue", text, re.I):
        score += 50
    if re.search(r"second batch|second release|new batch|declassified ufo files", title, re.I):
        score += 30
    if re.search(r"department of war|\.gov|reuters|newsnation|associated press|ap news", publisher, re.I):
        score += 20
    return score, clean(source.get("publishedAt") or source.get("sourcePublishedAt") or source.get("rssPublishedAt"))


def promoted_article_from_source(source: dict[str, Any]) -> dict[str, Any]:
    published = clean(source.get("publishedAt") or source.get("sourcePublishedAt") or source.get("rssPublishedAt"))
    title = clean(source.get("title")) or "Department of War Publishes Second Release of Unidentified Anomalous Phenomena Files on WAR.GOV/UFO"
    return {
        "id": "file-release-" + slug(title),
        "title": title,
        "source": clean(source.get("source")) or "UAP files source",
        "link": clean(source.get("link") or source.get("url")),
        "url": clean(source.get("url") or source.get("link")),
        "date": published[:10] if published else "",
        "publishedAt": published,
        "summary": SUMMARY,
        "mentions": 1,
        "otherSources": [],
        "clusterTitles": [],
        "quality": 84,
        "qualityBreakdown": [
            {"label": "Basis", "points": 27, "text": "UAP/UFO-Bezug erkannt und Unterhaltung/Gaming herausgefiltert."},
            {"label": "Quelle", "points": 9, "text": "Quelle ist offiziell oder ein etabliertes Nachrichtenmedium."},
            {"label": "Starker Titel", "points": 13, "text": "Der Titel enthaelt einen klaren UAP/UFO-Bezug."},
            {"label": "Mehrere Quellen", "points": 34, "text": "Mehrere Quellen im aktuellen Feed."},
        ],
        "qualityExplanation": "Die Punkte zeigen UAP-Bezug, starke Begriffe, offizielle Stellen, Quellenvertrauen, mehrere Quellen und bei schwachen Einzelquellen einen vorsichtigen Abzug.",
        "matchedTerms": ["files", "released"],
        "sourceQuality": 84,
        "displayedAt": clean(source.get("displayedAt") or source.get("sourceDisplayedAt") or published),
        "sourceDisplayedAt": clean(source.get("displayedAt") or source.get("sourceDisplayedAt") or published),
        "retainedFromPreviousScan": True,
    }


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
    score = sum(int(p.get("points") or 0) for p in parts) if parts else int(article.get("quality") or 50)
    if mentions >= 10:
        score = max(score, 84)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(100, score))
    article["sourceQuality"] = article["quality"]


def distinctive_tokens(text: str) -> set[str]:
    return {token.lower().strip("'-") for token in TOKEN_RE.findall(text) if token.lower().strip("'-") not in STOPWORDS}


def looks_like_stale_summary(article: dict[str, Any]) -> bool:
    title = clean(article.get("title"))
    summary = clean(article.get("summary"))
    if len(summary) < 80:
        return False
    title_tokens = distinctive_tokens(title)
    summary_tokens = distinctive_tokens(summary)
    if len(title_tokens) < 4:
        return False
    if len(title_tokens & summary_tokens) >= 2:
        return False
    if is_file_release_text(title) and is_file_release_text(summary):
        return False
    return True


def clear_stale_summary(article: dict[str, Any], summaries: dict[str, Any]) -> bool:
    if not looks_like_stale_summary(article):
        return False
    article["summary"] = ""
    article["summaryStatus"] = dict(MISSING_SUMMARY_STATUS)
    article.pop("translation", None)
    article.pop("translations", None)
    article.pop("translationMeta", None)
    if article.get("id"):
        summaries.pop(article["id"], None)
    return True


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    summaries = payload.setdefault("summaries", {})
    articles = [article for article in payload.get("articles") or [] if isinstance(article, dict)]
    candidates = [
        article for article in articles
        if is_file_release_text(article_text(article))
        or sum(1 for source in article.get("otherSources") or [] if isinstance(source, dict) and is_file_release_source(source)) >= 3
    ]
    if not candidates:
        print("file-release consolidation: no candidates")
        return

    primary_candidates = [
        article for article in candidates
        if is_file_release_text(article_own_headline_text(article))
    ]
    promoted_primary = False
    if primary_candidates:
        primary = max(primary_candidates, key=rank_article)
    else:
        releasable_sources: list[dict[str, Any]] = []
        for article in candidates:
            article_source = source_from_article(article)
            if is_file_release_source(article_source):
                releasable_sources.append(article_source)
            releasable_sources.extend(
                source for source in article.get("otherSources") or []
                if isinstance(source, dict) and is_file_release_source(source)
            )
        if not releasable_sources:
            print("file-release consolidation: no direct release topic")
            return
        primary = promoted_article_from_source(max(releasable_sources, key=rank_source))
        articles.insert(0, primary)
        candidates.append(primary)
        promoted_primary = True
    release_sources: list[dict[str, Any]] = []
    kept_articles: list[dict[str, Any]] = []
    removed_duplicates = 0
    cleaned_articles = 0
    stale_summaries_cleared = 0
    rejected_article_sources = 0

    for article in articles:
        is_candidate = article in candidates
        headline_is_release = is_file_release_text(article_own_headline_text(article))
        if is_candidate and article is not primary and headline_is_release:
            article_source = source_from_article(article)
            if is_file_release_source(article_source):
                release_sources.append(article_source)
            else:
                rejected_article_sources += 1
            release_sources.extend(source for source in article.get("otherSources") or [] if isinstance(source, dict) and is_file_release_source(source))
            removed_duplicates += 1
            continue

        original_sources = [source for source in article.get("otherSources") or [] if isinstance(source, dict)]
        release_sources.extend(source for source in original_sources if is_file_release_source(source))
        if article is not primary:
            cleaned = [source for source in original_sources if not is_file_release_source(source)]
            if len(cleaned) != len(original_sources):
                article["otherSources"] = cleaned
                article["mentions"] = max(1, 1 + len(cleaned))
                article["clusterTitles"] = [clean(source.get("title")) for source in cleaned if clean(source.get("title"))][:10]
                refresh_quality(article)
                cleaned_articles += 1
                if clear_stale_summary(article, summaries):
                    stale_summaries_cleared += 1
        kept_articles.append(article)

    primary_sources = [source for source in primary.get("otherSources") or [] if isinstance(source, dict)]
    primary_sources.extend(release_sources)
    primary["otherSources"] = dedupe_sources(primary_sources, primary)[:24]
    primary["mentions"] = max(1, 1 + len(primary["otherSources"]))
    primary["clusterTitles"] = [clean(source.get("title")) for source in primary["otherSources"] if clean(source.get("title"))][:10]
    primary["summary"] = SUMMARY
    primary.pop("summaryStatus", None)
    primary.pop("translation", None)
    primary.pop("translations", None)
    primary.pop("translationMeta", None)
    refresh_quality(primary)

    payload["articles"] = kept_articles
    if primary.get("id"):
        summaries[primary["id"]] = SUMMARY
    visible_ids = {article.get("id") for article in kept_articles if article.get("id")}
    for key in list(summaries):
        if key not in visible_ids:
            summaries.pop(key, None)

    meta = payload.setdefault("scanMeta", {})
    meta["fileReleaseConsolidation"] = {
        "policy": "second_uap_file_release_single_visible_topic_v5_direct_release_primary_only",
        "primaryId": primary.get("id"),
        "sources": len(primary.get("otherSources") or []),
        "cleanedArticles": cleaned_articles,
        "removedDuplicateTopics": removed_duplicates,
        "staleSummariesCleared": stale_summaries_cleared,
        "rejectedArticleSources": rejected_article_sources,
        "promotedPrimaryFromSource": promoted_primary,
    }
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "file-release consolidation: "
        f"primary={primary.get('id')} sources={len(primary.get('otherSources') or [])} "
        f"cleaned={cleaned_articles} removed={removed_duplicates} "
        f"stale_summaries={stale_summaries_cleared} rejected_article_sources={rejected_article_sources}"
    )


if __name__ == "__main__":
    main()
