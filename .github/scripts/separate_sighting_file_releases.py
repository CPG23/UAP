#!/usr/bin/env python3
"""Prevent sighting-report stories from absorbing file-release coverage."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
SIGHTING_RE = re.compile(r"\b(sighting|sightings|orbs?|objects?|lights?|swarming|encounter|encounters|spotted|seen)\b", re.I)
FILE_RELEASE_RE = re.compile(r"\b(pursue|war\.gov|department of war|declassified|document|documents|file|files|batch|tranche|release 02|second release|second batch|new batch|transparency directive)\b", re.I)
SIGHTING_REPORT_RE = re.compile(r"\b(sighting reports?|reports?\s+.*\b(orbs?|objects?|sightings?)\b|orbs? swarming)\b", re.I)
WAR_SUMMARY_RE = re.compile(r"^the department of war says it is publishing the second release", re.I)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def combined_text(*values: Any) -> str:
    return clean(" ".join(clean(value) for value in values))


def is_sighting_article(article: dict[str, Any]) -> bool:
    title = clean(article.get("title"))
    summary = clean(article.get("summary"))
    text = combined_text(title, article.get("source", ""))
    if SIGHTING_REPORT_RE.search(text):
        return True
    if SIGHTING_RE.search(text) and not re.search(r"\b(pursue|war\.gov|department of war|second batch|new batch|tranche)\b", text, re.I):
        return True
    return bool(SIGHTING_RE.search(title) and not FILE_RELEASE_RE.search(title) and not WAR_SUMMARY_RE.search(summary))


def is_file_release_source(source: dict[str, Any]) -> bool:
    text = combined_text(source.get("title", ""), source.get("source", ""))
    if SIGHTING_REPORT_RE.search(text):
        return False
    return bool(FILE_RELEASE_RE.search(text))


def reset_bad_summary(article: dict[str, Any], summaries: dict[str, Any]) -> None:
    if WAR_SUMMARY_RE.search(clean(article.get("summary"))):
        article["summary"] = ""
        article["summaryStatus"] = {
            "articleContentSummary": "missing",
            "message": "Keine verlaessliche Zusammenfassung verfuegbar. GitHub versucht beim naechsten Scan automatisch, diese zu ergaenzen.",
        }
        if article.get("id"):
            summaries.pop(article["id"], None)
        article.pop("translation", None)
        article.pop("translations", None)
        article.pop("translationMeta", None)


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    summaries = payload.setdefault("summaries", {})
    changed = 0
    for article in payload.get("articles") or []:
        if not isinstance(article, dict) or not is_sighting_article(article):
            continue
        before_sources = len(article.get("otherSources") or [])
        kept = [source for source in article.get("otherSources") or [] if isinstance(source, dict) and not is_file_release_source(source)]
        if len(kept) != before_sources:
            article["otherSources"] = kept
            article["mentions"] = max(1, 1 + len(kept))
            article["clusterTitles"] = [clean(source.get("title")) for source in kept if clean(source.get("title"))][:10]
            changed += 1
        before_summary = clean(article.get("summary"))
        reset_bad_summary(article, summaries)
        if clean(article.get("summary")) != before_summary:
            changed += 1
    if changed:
        meta = payload.setdefault("scanMeta", {})
        meta["sightingFileReleaseSeparation"] = {
            "policy": "keep_sighting_reports_separate_from_document_file_releases_v1",
            "updatedArticles": changed,
        }
        NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"sighting/file-release separation: updated={changed}")


if __name__ == "__main__":
    main()
