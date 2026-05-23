#!/usr/bin/env python3
"""Keep the Department of War/PURSUE release summary tied to the release page."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
TITLE_RE = re.compile(
    r"(department of war publishes second release of unidentified anomalous phenomena|presidential unsealing and reporting system for uap encounters|pursue)",
    re.I,
)
SUMMARY = (
    "The Department of War says it is publishing the second release of declassified and historical Unidentified Anomalous Phenomena files as part of the Presidential Unsealing and Reporting System for UAP Encounters, or PURSUE. "
    "The release states that the collection remains housed on WAR.GOV/UFO and that additional files will be released on a rolling basis. "
    "Assistant to the Secretary of War for Public Affairs and Chief Pentagon Spokesman Sean Parnell is named as the source of the statement. "
    "The Department says WAR.GOV/UFO has received over 1 billion hits worldwide since its May 8, 2026 launch, which it frames as evidence of major public interest in the topic and in the Trump administration's transparency effort. "
    "The statement adds that the Department of War and agency partners are working on a third UAP file release, which will be announced in the near future."
)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def official_release_topic(article: dict[str, Any]) -> bool:
    title = clean(article.get("title"))
    source = clean(article.get("source"))
    text = clean(" ".join([title, source, article.get("summary", "")]))
    if TITLE_RE.search(text) and re.search(r"\b(war\.gov|department of war|u\.s\. department of war|pursue)\b", text, re.I):
        return True
    for source_item in article.get("otherSources") or []:
        if isinstance(source_item, dict) and TITLE_RE.search(clean(" ".join([source_item.get("title", ""), source_item.get("source", "")]))):
            return True
    return False


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    summaries = data.setdefault("summaries", {})
    changed = 0
    for article in data.get("articles") or []:
        if not isinstance(article, dict) or not official_release_topic(article):
            continue
        article["summary"] = SUMMARY
        article.pop("summaryStatus", None)
        article.pop("translation", None)
        article.pop("translations", None)
        article.pop("translationMeta", None)
        if article.get("id"):
            summaries[article["id"]] = SUMMARY
        changed += 1
    if changed:
        meta = data.setdefault("scanMeta", {})
        meta["warReleaseSummaryGuard"] = {
            "policy": "department_of_war_pursue_release_summary_from_release_page_v2",
            "updatedArticles": changed,
        }
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"war release summary guard: updated={changed}")


if __name__ == "__main__":
    main()
