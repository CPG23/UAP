#!/usr/bin/env python3
"""Shared validation for visible article summaries."""

from __future__ import annotations

import re
from typing import Any

WORD_RE = re.compile(r"[a-z0-9]+", re.I)
SPACE_RE = re.compile(r"\s+")
EXTRACTION_GARBAGE_RE = re.compile(
    r"markdown content:|"
    r"warning:\s*target url returned error|"
    r"incompatible browser extension|"
    r"security verification process|"
    r"cloudflare(?:'s)? troubleshooting|"
    r":::title:::|:::description:::|:::itemcount:::|"
    r"\babout us\b.{0,120}\bworld news\b|"
    r"\bdistrict court\b.{0,120}\bfitness\b|"
    r"\bprivacy\b.{0,80}\bterms\b.{0,80}\bcontact us\b",
    re.I | re.S,
)
MENU_NOISE_RE = re.compile(
    r"(?:\*\s*[A-Z][^*]{1,45}){8,}|"
    r"(?:English|Deutsch|Espa(?:n|ñ)ol|Fran(?:c|ç)ais|Italiano|Polski|Portugu(?:e|ê)s)"
    r"(?:.{0,80}(?:English|Deutsch|Espa(?:n|ñ)ol|Fran(?:c|ç)ais|Italiano|Polski|Portugu(?:e|ê)s)){3,}",
    re.I | re.S,
)
GENERIC_WORDS = set(
    "a an the to of for in on at by with from and or is are was were be been has have had "
    "will would could should may might this that these those article report reports story stories "
    "piece headline title news new latest update says said according about into after before over "
    "under more amid as what why how who where when publishes published publishing release released "
    "releases show shows showing video videos website page live".split()
)
TOPIC_WORDS = set(
    "uap uaps ufo ufos alien aliens extraterrestrial unidentified anomalous phenomena flying object "
    "disclosure declassification declassified sighting sightings".split()
)


def compact(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def words(value: Any) -> set[str]:
    return {
        word.lower()
        for word in WORD_RE.findall(compact(value))
        if len(word) > 2 and word.lower() not in GENERIC_WORDS
    }


def distinctive_title_words(title: Any) -> set[str]:
    return words(title) - TOPIC_WORDS


def has_extraction_garbage(summary: Any) -> bool:
    text = compact(summary)
    if EXTRACTION_GARBAGE_RE.search(text) or MENU_NOISE_RE.search(text):
        return True
    return text.count("*") >= 10


def summary_matches_article(summary: Any, article: dict[str, Any]) -> bool:
    """Reject clear mismatches while allowing genuinely paraphrased summaries."""
    text = compact(summary)
    if not text or has_extraction_garbage(text):
        return False

    title_words = distinctive_title_words(article.get("title"))
    if not title_words:
        return True

    overlap = title_words & words(text)
    if len(overlap) >= 2:
        return True
    if len(title_words) <= 3 and overlap:
        return True
    if len(title_words) >= 4 and not overlap:
        return False
    if len(title_words) >= 7 and len(overlap) < 2:
        return False
    return True
