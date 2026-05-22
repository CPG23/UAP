#!/usr/bin/env python3
"""Synchronize visible article summaries from the canonical summary map.

Late feed steps merge, sort, and compact articles. They must not leave a visible
article with an older or shorter summary when the canonical summaries map already
contains a stronger article-content summary for the same article id.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

LATEST_FILE = Path("latest-news.json")
MIN_SUMMARY_CHARS = 180
BAD_SUMMARY_RE = re.compile(
    r"full article text could not be reliably extracted|"
    r"summary is limited to verified feed metadata|"
    r"the feed lists an article|"
    r"this item tracks a |"
    r"publisher text could not be safely extracted|"
    r"the headline states|"
    r"the headline says|"
    r"the headline is treated|"
    r"based on the headline|"
    r"based only on the headline|"
    r"according to the headline|"
    r"the title states|"
    r"the title suggests|"
    r"the article falls under|"
    r"falls under the uap category|"
    r"categorized as uap|"
    r"uap category|"
    r"the article discusses|"
    r"the article appears to|"
    r"the article is about|"
    r"the piece discusses|"
    r"the piece highlights|"
    r"the story discusses|"
    r"the story highlights|"
    r"the report discusses|"
    r"the report highlights|"
    r"the report appears to|"
    r"available feed metadata|"
    r"listed headline|"
    r"matched uap terms|"
    r"for deeper context|"
    r"source claim|"
    r"the scanner connects|"
    r"uap news does not add details|"
    r"mehrere quellen berichten über die veröffentlichung oder freigabe|"
    r"die ausführliche zusammenfassung wird beim nächsten github-scan|"
    r"der artikel behandelt:",
    re.I,
)
GENERIC_LEAD_RE = re.compile(
    r"^(this|the)\s+(article|piece|story|report|headline|title)\s+"
    r"(states|says|discusses|highlights|appears|covers|focuses|is about|falls under)",
    re.I,
)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_good_summary(value: Any) -> bool:
    text = compact(value)
    if len(text) < MIN_SUMMARY_CHARS:
        return False
    if BAD_SUMMARY_RE.search(text) or GENERIC_LEAD_RE.search(text):
        return False
    if len(re.findall(r"[.!?](?:\s|$)", text)) < 2:
        return False
    return True


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    summaries = data.get("summaries") if isinstance(data.get("summaries"), dict) else {}
    updated = 0
    cleared_translations = 0

    for article in data.get("articles") or []:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        canonical = compact(summaries.get(article_id))
        visible = compact(article.get("summary"))
        if not article_id or not is_good_summary(canonical):
            continue
        if visible == canonical:
            continue
        if not is_good_summary(visible) or len(canonical) >= len(visible) or article.get("summarySource") == "source_page":
            article["summary"] = canonical
            article.pop("summaryStatus", None)
            article.pop("translation", None)
            article.pop("translations", None)
            article.pop("translationMeta", None)
            article["summarySource"] = article.get("summarySource") or "canonical_summary_map"
            updated += 1
            cleared_translations += 1

    if updated:
        meta = data.setdefault("scanMeta", {})
        meta["finalVisibleSummarySync"] = {
            "policy": "canonical_summary_map_over_visible_article_summary_v1",
            "updatedArticles": updated,
            "clearedTranslations": cleared_translations,
        }
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"final visible summary sync: updated={updated}")


if __name__ == "__main__":
    main()
