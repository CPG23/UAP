#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

NEWS_PATH = Path("latest-news.json")
SPACE_RE = re.compile(r"\s+")


def clean(value: Any) -> str:
    return SPACE_RE.sub(" ", str(value or "")).strip()


def title_key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean(title).lower()).strip()


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


def dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        key = source_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(source)
    return result


def merge_article(target: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    incoming_sources = [source_from_article(incoming)] + [s for s in incoming.get("otherSources") or [] if isinstance(s, dict)]
    sources = dedupe_sources((target.get("otherSources") or []) + incoming_sources)
    target["otherSources"] = [source for source in sources if title_key(source.get("title", "")) != title_key(target.get("title", ""))]
    target["mentions"] = max(int(target.get("mentions") or 1), int(incoming.get("mentions") or 1), 1 + len(target["otherSources"]))
    target["clusterTitles"] = [clean(source.get("title")) for source in target["otherSources"] if clean(source.get("title"))][:10]
    if len(clean(incoming.get("summary"))) > len(clean(target.get("summary"))):
        target["summary"] = incoming.get("summary", "")
    target["quality"] = max(int(target.get("quality") or 0), int(incoming.get("quality") or 0))
    target["sourceQuality"] = max(int(target.get("sourceQuality") or 0), int(incoming.get("sourceQuality") or 0), int(target.get("quality") or 0))
    return target


def main() -> None:
    payload = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    by_title: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for article in payload.get("articles") or []:
        if not isinstance(article, dict):
            continue
        key = title_key(article.get("title", ""))
        if not key:
            continue
        if key not in by_title:
            by_title[key] = article
            order.append(key)
        else:
            merge_article(by_title[key], article)
    payload["articles"] = [by_title[key] for key in order]
    payload["summaries"] = {a["id"]: a.get("summary", "") for a in payload["articles"] if a.get("id")}
    meta = payload.setdefault("scanMeta", {})
    meta["dedupedTitles"] = "normalized_title_v1"
    NEWS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("deduped feed titles")


if __name__ == "__main__":
    main()
