#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")
LOW_TRUST_RE = re.compile(r"\b(tmz|daily mail|the sun|latestly|bollywoodshaadis|stupiddope|mashable india)\b", re.I)


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def all_text(article: dict[str, Any]) -> str:
    return clean(" ".join([
        article.get("title", ""),
        article.get("summary", ""),
        " ".join(article.get("clusterTitles") or []),
        " ".join(clean(source.get("title")) for source in article.get("otherSources") or [] if isinstance(source, dict)),
    ])).lower()


def event_type(article: dict[str, Any]) -> str:
    raw = all_text(article)
    has_uap = bool(re.search(r"\b(uap|uaps|ufo|ufos|unidentified anomalous|unidentified aerial|unidentified flying|alien)\b", raw))
    has_files = bool(re.search(r"\b(file|files|record|records|archive|archives|document|documents|transcript|transcripts|video|videos|photo|photos|material|materials)\b", raw))
    has_release = bool(re.search(r"\b(release|released|releases|releasing|declassif|unseal|unsealed|publish|published|posting|posted|drops?|opens?|transparency|public archive)\b", raw))
    has_film = bool(re.search(r"\b(film|movie|documentary|sleeping dog|trailer|director|hollywood)\b", raw))
    has_program = bool(re.search(r"\b(program|tracking|monitoring|studying|study|directive|advisor|ministry|minister)\b", raw))
    has_sighting = bool(re.search(r"\b(sighting|sightings|spotted|seen|encounter|encountered|lights|orbs|object|objects)\b", raw))
    if has_uap and has_files and has_release:
        return "file-release"
    if has_uap and has_program:
        return "program"
    if has_uap and has_film:
        return "film"
    if has_uap and has_sighting:
        return "sighting"
    return ""


def source_points(mentions: int) -> int:
    if mentions >= 20:
        return 40
    if mentions >= 10:
        return 34
    if mentions >= 5:
        return 24
    return max(0, (mentions - 1) * 5)


def cap_for(article: dict[str, Any], mentions: int, typ: str) -> int:
    if typ == "film":
        return 76
    if mentions <= 1 and LOW_TRUST_RE.search(clean(article.get("source"))):
        return 72
    if mentions <= 1:
        return 84
    return 100


def base_score(article: dict[str, Any]) -> int:
    parts = [p for p in article.get("qualityBreakdown") or [] if isinstance(p, dict) and p.get("label") != "Mehrere Quellen"]
    score = sum(int(p.get("points") or 0) for p in parts)
    return score or int(article.get("quality") or article.get("sourceQuality") or 50)


def normalize(article: dict[str, Any]) -> dict[str, Any]:
    mentions = max(1, int(article.get("mentions") or 1))
    typ = event_type(article)
    parts = [p for p in article.get("qualityBreakdown") or [] if isinstance(p, dict) and p.get("label") != "Mehrere Quellen"]
    points = source_points(mentions)
    if points:
        parts.append({"label": "Mehrere Quellen", "points": points, "text": f"{mentions} Quellen im aktuellen Feed."})
    score = base_score(article) + points
    if typ == "file-release" and mentions >= 20:
        score = max(score, 90)
    elif typ == "file-release" and mentions >= 10:
        score = max(score, 86)
    elif typ == "program" and mentions >= 3:
        score = max(score, 78)
    article["qualityBreakdown"] = parts
    article["quality"] = max(20, min(cap_for(article, mentions, typ), score))
    article["sourceQuality"] = article["quality"]
    return article


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    payload["articles"] = [normalize(article) for article in payload.get("articles") or [] if isinstance(article, dict)]
    payload["articles"].sort(key=lambda article: (int(article.get("quality") or 0), clean(article.get("publishedAt") or article.get("date"))), reverse=True)
    payload["summaries"] = {a["id"]: a.get("summary", "") for a in payload["articles"] if a.get("id")}
    meta = payload.setdefault("scanMeta", {})
    meta["qualityBalance"] = "source_strength_event_type_v1"
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("balanced feed quality scores")


if __name__ == "__main__":
    main()
