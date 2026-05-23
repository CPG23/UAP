#!/usr/bin/env python3
"""Backfill missing same-story sources after the visible feed is finalized.

The earlier clustering stages intentionally keep the app feed compact. This pass
adds narrowly verified source candidates for already visible stories so major
same-event coverage is not lost before display. It runs after the final integrity
pruning and before New markers/translations are rebuilt.
"""
from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[a-z0-9]+")
UAP_RE = re.compile(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying)\b", re.I)
FILE_RE = re.compile(r"\b(file|files|document|documents|record|records|archive|archives|video|videos|photo|photos|batch|tranche|release|released|publishes|published|declassified|unsealed|pursue|war\.gov)\b", re.I)
US_RE = re.compile(r"\b(us|u\.s\.|united states|pentagon|department of war|department of defense|defense department|dod|war\.gov|federal|trump|reuters|newsnation|live science|ntd|fox)\b", re.I)
SECOND_RELEASE_RE = re.compile(r"\b(second|2nd|release 02|new batch|new tranche|new set|second batch|second release|more than 40|162 declassified|war\.gov/ufo)\b", re.I)
UNRELATED_RE = re.compile(
    r"\b(pastor|pastors|translucent beings|avi loeb|harvard astrophysicist|moon lights|sleeping dog|corbell|bob lazar|alien species|biological remains|dismembered gray|ufo festival|arizona|smoking gun|whistleblower|missing scientists|soft launch|ukraine advisor|longmont|morning news brief|news brief|sergeant|reinstatement|phoenix)\b",
    re.I,
)
STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "new latest update report reports news says said about into this that these those watch video "
    "uap uaps ufo ufos unidentified anomalous aerial flying phenomena"
    .split()
)
MAX_QUERIES_PER_ARTICLE = 8
MAX_SOURCES_PER_ARTICLE = 18
USER_AGENT = "UAP-News-Bot/1.0 (+https://github.com/CPG23/UAP)"


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def words(value: Any) -> set[str]:
    return {word for word in WORD_RE.findall(clean(value).lower()) if len(word) > 2 and word not in STOP}


def parse_date(value: Any) -> str:
    text = clean(value)
    if not text:
        return ""
    try:
        return parsedate_to_datetime(text).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        pass
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return text


def date_day(value: Any) -> str:
    text = parse_date(value)
    return text[:10] if len(text) >= 10 else ""


def clean_google_title(value: Any, source: str = "") -> str:
    title = html.unescape(clean(value))
    source = clean(source)
    if source and title.lower().endswith(f" - {source}".lower()):
        title = title[: -(len(source) + 3)].strip()
    return title


def article_text(article: dict[str, Any]) -> str:
    parts = [
        article.get("title", ""),
        article.get("summary", ""),
        article.get("description", ""),
        article.get("source", ""),
        " ".join(clean(t) for t in article.get("clusterTitles") or []),
    ]
    return clean(" ".join(parts))


def source_text(source: dict[str, Any]) -> str:
    return clean(" ".join([source.get("title", ""), source.get("source", "")]))


def is_us_uap_file_release(text: str) -> bool:
    return bool(UAP_RE.search(text) and FILE_RE.search(text) and US_RE.search(text))


def is_second_us_file_release(text: str, published_at: Any = "") -> bool:
    if not is_us_uap_file_release(text):
        return False
    if SECOND_RELEASE_RE.search(text):
        return True
    day = date_day(published_at)
    return day >= "2026-05-22" if day else False


def article_kind(article: dict[str, Any]) -> str:
    text = article_text(article)
    if is_second_us_file_release(text, article.get("publishedAt") or article.get("date")):
        return "us-uap-file-release-second"
    if is_us_uap_file_release(text):
        return "us-uap-file-release"
    return ""


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = clean(value).lower()
        if key and key not in seen:
            seen.add(key)
            result.append(clean(value))
    return result


def query_candidates(article: dict[str, Any]) -> list[str]:
    title = clean(article.get("title"))
    queries = [f'"{title}"'] if title else []
    kind = article_kind(article)
    if kind.startswith("us-uap-file-release"):
        queries.extend([
            '"Pentagon releases new batch of UFO files"',
            '"second batch" "UFO files" Pentagon',
            '"second batch" "UAP files"',
            '"WAR.GOV/UFO" "Release 02"',
            '"second release" "Unidentified Anomalous Phenomena" "Department of War"',
            '"US releases second batch" "government declassified UFO files"',
        ])
    return unique(queries)[:MAX_QUERIES_PER_ARTICLE]


def fetch_rss(query: str) -> list[dict[str, Any]]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            xml = response.read()
    except Exception as exc:
        print(f"backfill source query failed: {query}: {exc}")
        return []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    results: list[dict[str, Any]] = []
    for item in root.findall(".//item"):
        source_node = item.find("source")
        source_name = clean(source_node.text if source_node is not None else "Google News")
        published_at = parse_date(item.findtext("pubDate"))
        results.append({
            "title": clean_google_title(item.findtext("title"), source_name),
            "source": source_name or "Google News",
            "link": clean(item.findtext("link")),
            "url": clean(item.findtext("link")),
            "publishedAt": published_at,
        })
    return results


def official_sources(article: dict[str, Any]) -> list[dict[str, Any]]:
    if not article_kind(article).startswith("us-uap-file-release"):
        return []
    return [
        {
            "title": "Department of War Publishes Second Release of Unidentified Anomalous Phenomena Files on WAR.GOV/UFO",
            "source": "U.S. Department of War (.gov)",
            "link": "https://www.war.gov/News/Releases/Release/Article/4499305/department-of-war-publishes-second-release-of-unidentified-anomalous-phenomena/",
            "url": "https://www.war.gov/News/Releases/Release/Article/4499305/department-of-war-publishes-second-release-of-unidentified-anomalous-phenomena/",
            "publishedAt": "2026-05-22T00:00:00Z",
        },
        {
            "title": "Presidential Unsealing and Reporting System for UAP Encounters (PURSUE) - Release 02",
            "source": "U.S. Department of War (.gov)",
            "link": "https://www.war.gov/ufo/?releaseDate=Release+02",
            "url": "https://www.war.gov/ufo/?releaseDate=Release+02",
            "publishedAt": "2026-05-22T00:00:00Z",
        },
    ]


def title_overlap_same_story(article: dict[str, Any], source: dict[str, Any]) -> bool:
    article_words = words(article.get("title", ""))
    source_words = words(source.get("title", ""))
    if not article_words or not source_words:
        return False
    shared = article_words & source_words
    return len(shared) >= 4 and len(shared) / min(len(article_words), len(source_words)) >= 0.45


def same_story_source(article: dict[str, Any], source: dict[str, Any]) -> bool:
    text = source_text(source)
    if not clean(source.get("title")) or UNRELATED_RE.search(text):
        return False
    kind = article_kind(article)
    if kind.startswith("us-uap-file-release"):
        return is_second_us_file_release(text, source.get("publishedAt"))
    return title_overlap_same_story(article, source)


def source_key(source: dict[str, Any]) -> str:
    value = clean(source.get("url") or source.get("link") or source.get("title") or source.get("source"))
    return value.lower()


def primary_source_key(article: dict[str, Any]) -> str:
    return source_key({"url": article.get("url") or article.get("link"), "title": article.get("title"), "source": article.get("source")})


def dedupe_sources(article: dict[str, Any], sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = {primary_source_key(article)}
    result: list[dict[str, Any]] = []
    primary_title = clean(article.get("title")).lower()
    for source in sources:
        key = source_key(source)
        title_key = clean(source.get("title")).lower()
        if not key or key in seen or (primary_title and title_key == primary_title):
            continue
        seen.add(key)
        result.append(source)
    return result


def source_rank(source: dict[str, Any]) -> tuple[int, str, int]:
    text = source_text(source)
    trusted = 2 if re.search(r"\b(\.gov|reuters|associated press|ap news|newsnation|live science|ntd|fox)\b", text, re.I) else 0
    official = 1 if re.search(r"\b(war\.gov|department of war|department of defense|pentagon)\b", text, re.I) else 0
    return trusted + official, clean(source.get("publishedAt")), len(clean(source.get("title")))


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
    base = sum(int(p.get("points") or 0) for p in parts) if parts else int(article.get("quality") or 50)
    if article_kind(article).startswith("us-uap-file-release") and mentions >= 5:
        base = max(base, 84)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(100, base))
    article["sourceQuality"] = article["quality"]


def collect_candidates(article: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    candidates.extend(official_sources(article))
    for query in query_candidates(article):
        candidates.extend(fetch_rss(query))
    return candidates


def backfill_article(article: dict[str, Any]) -> int:
    existing = [
        source
        for source in article.get("otherSources") or []
        if isinstance(source, dict) and same_story_source(article, source)
    ]
    candidates = [source for source in collect_candidates(article) if same_story_source(article, source)]
    combined = dedupe_sources(article, existing + candidates)
    combined.sort(key=source_rank, reverse=True)
    limited = combined[:MAX_SOURCES_PER_ARTICLE]
    added = max(0, len(limited) - len(existing))
    article["otherSources"] = limited
    article["mentions"] = max(1, 1 + len(limited))
    article["clusterTitles"] = [clean(source.get("title")) for source in limited if clean(source.get("title"))][:10]
    article.pop("translation", None)
    article.pop("translations", None)
    article.pop("translationMeta", None)
    refresh_quality(article)
    return added


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    articles = [article for article in payload.get("articles") or [] if isinstance(article, dict)]
    updated_topics = 0
    added_sources = 0
    for article in articles:
        before = len(article.get("otherSources") or [])
        added = backfill_article(article)
        after = len(article.get("otherSources") or [])
        if after != before:
            updated_topics += 1
            added_sources += added
    meta = payload.setdefault("scanMeta", {})
    meta["relatedSourceBackfill"] = {
        "policy": "same_story_google_news_and_official_source_backfill_v2_strict_existing_sources",
        "updatedTopics": updated_topics,
        "addedSources": added_sources,
        "maxSourcesPerArticle": MAX_SOURCES_PER_ARTICLE,
    }
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"related source backfill: updated={updated_topics} added={added_sources}")


if __name__ == "__main__":
    main()
