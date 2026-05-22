#!/usr/bin/env python3
"""Repair weak summaries after clustering and rating.

This late pass fetches text from the article's own source page and keeps a
summary when it reads like real article content. It deliberately does not run a
second topic-classification check against the summary: once the text came from
the selected source page, the summary should not be rejected for using wording
that differs from the feed headline.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from enrich_summaries import fetch_article_text, summarize_article_text

LATEST_FILE = Path("latest-news.json")
MAX_REPAIR_ARTICLES = 36
MAX_REPAIR_ATTEMPTS = 18

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
WORD_RE = re.compile(r"[a-z0-9]+", re.I)
STOP_WORDS = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might this that these those article report story piece headline title "
    "uap uaps ufo ufos news new latest update says said about into after before over under"
    .split()
)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def words(value: Any) -> set[str]:
    return {
        word.lower()
        for word in WORD_RE.findall(compact(value))
        if len(word) > 2 and word.lower() not in STOP_WORDS
    }


def sentence_count(text: str) -> int:
    return len(re.findall(r"[.!?](?:\s|$)", text))


def title_echo(summary: str, title: str) -> bool:
    summary_words = words(summary)
    title_words = words(title)
    if not summary_words or not title_words:
        return False
    overlap = len(summary_words & title_words) / max(1, min(len(summary_words), len(title_words)))
    return overlap >= 0.82 and len(summary_words) < 42


def is_good_summary(value: Any, article: dict[str, Any]) -> bool:
    text = compact(value)
    if len(text) < 180:
        return False
    if BAD_SUMMARY_RE.search(text) or GENERIC_LEAD_RE.search(text):
        return False
    if sentence_count(text) < 2:
        return False
    if title_echo(text, compact(article.get("title"))):
        return False
    return True


def mark_source_grounded(article: dict[str, Any]) -> None:
    article["summarySource"] = "source_page"
    article["summaryPolicy"] = "source_page_article_text"


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    summaries = data.setdefault("summaries", {})
    repaired = 0
    missing = 0
    attempts = 0
    changed = False

    for article in data.get("articles", [])[:MAX_REPAIR_ARTICLES]:
        if not isinstance(article, dict):
            continue
        article_id = compact(article.get("id"))
        current = article.get("summary") or summaries.get(article_id)
        if is_good_summary(current, article):
            article["summary"] = compact(current)
            if article.get("summarySource") == "source_page":
                mark_source_grounded(article)
            if article_id:
                summaries[article_id] = article["summary"]
            continue
        if attempts >= MAX_REPAIR_ATTEMPTS:
            continue

        attempts += 1
        text = fetch_article_text(article)
        summary = summarize_article_text(article, text)
        if is_good_summary(summary, article):
            article["summary"] = compact(summary)
            mark_source_grounded(article)
            article.pop("summaryStatus", None)
            if article_id:
                summaries[article_id] = article["summary"]
            repaired += 1
        else:
            article["summary"] = ""
            article.pop("summarySource", None)
            article.pop("summaryPolicy", None)
            if article_id:
                summaries.pop(article_id, None)
            article.setdefault("summaryStatus", {})["articleContentSummary"] = "missing"
            missing += 1
        changed = True
        time.sleep(1)

    active_ids = {compact(article.get("id")) for article in data.get("articles", []) if isinstance(article, dict)}
    for key in list(summaries.keys()):
        if key not in active_ids:
            summaries.pop(key, None)
            changed = True

    meta = data.setdefault("scanMeta", {})
    meta["summaryRepair"] = {
        "policy": "repair_after_cluster_normalization_v4_mark_source_grounded",
        "attempts": attempts,
        "repaired": repaired,
        "missing": missing,
    }

    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"summary repair after clustering: attempts={attempts}; repaired={repaired}; missing={missing}")


if __name__ == "__main__":
    main()
