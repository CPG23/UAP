#!/usr/bin/env python3
"""Remove app articles whose underlying source page is unavailable.

The app keeps visible articles for 14 days, but that must not preserve broken
links. This pass removes articles that clearly point to unavailable source pages
and prunes the persistent app archive accordingly.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from enrich_summaries import article_urls, clean_text, fetch_article_text

LATEST_FILE = Path("latest-news.json")
ARCHIVE_FILE = Path("app-feed-archive.json")
HTML_READ_BYTES = 240_000
SOFT_LAUNCH_BAD_RE = re.compile(r"\b2026 alien soft launch\b|\by01qlmdfznb\b", re.I)
VIDEO_ID_TITLE_RE = re.compile(r"\([a-z0-9_-]{10,12}\)\s*$", re.I)
ERROR_PAGE_RE = re.compile(
    r"\b(404|410|page not found|not found|does not exist|content unavailable|video unavailable|"
    r"this video is unavailable|this video isn't available|private video|removed by the uploader|"
    r"account terminated|sorry, this page|something went wrong)\b",
    re.I,
)
LOW_VALUE_SOURCE_RE = re.compile(r"\b(folha do es|youtube|dailymotion|rumble)\b", re.I)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"articles": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"articles": []}
    return data if isinstance(data, dict) else {"articles": []}


def source_key(article: dict[str, Any]) -> str:
    return compact(article.get("link") or article.get("url") or article.get("id") or article.get("title")).lower()


def direct_urls(article: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    for url in article_urls(article):
        if not url or "news.google." in url:
            continue
        if url not in urls:
            urls.append(url)
    return urls[:4]


def fetch_status(url: str) -> tuple[str, int, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=18) as resp:
            body = resp.read(HTML_READ_BYTES).decode(resp.headers.get_content_charset() or "utf-8", errors="replace")
            return resp.geturl(), int(getattr(resp, "status", 200) or 200), body
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read(HTML_READ_BYTES).decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return url, int(exc.code or 0), body
    except Exception:
        return url, 0, ""


def looks_like_error_page(status: int, body: str) -> bool:
    text = clean_text(body)
    if status in {404, 410, 451}:
        return True
    if status >= 500:
        return True
    if status == 200 and len(text) < 260 and ERROR_PAGE_RE.search(text):
        return True
    return False


def has_working_direct_page(article: dict[str, Any]) -> bool:
    urls = direct_urls(article)
    if not urls:
        return False
    for url in urls:
        final_url, status, body = fetch_status(url)
        if status and not looks_like_error_page(status, body):
            print("reachable source:", compact(article.get("title"))[:70], "=>", final_url[:100], status)
            return True
        print("unreachable source:", compact(article.get("title"))[:70], "=>", url[:100], status)
    return False


def explicit_bad_source(article: dict[str, Any]) -> bool:
    title = compact(article.get("title"))
    source = compact(article.get("source"))
    haystack = " ".join([title, source, compact(article.get("link"))]).lower()
    if SOFT_LAUNCH_BAD_RE.search(haystack):
        return True
    return bool(VIDEO_ID_TITLE_RE.search(title) and LOW_VALUE_SOURCE_RE.search(source))


def unreachable_article(article: dict[str, Any]) -> bool:
    if explicit_bad_source(article):
        return True
    urls = direct_urls(article)
    if urls:
        return not has_working_direct_page(article)
    # If Google cannot be decoded, keep established articles unless there is no
    # extractable text and the item looks like a low-value video shell.
    if LOW_VALUE_SOURCE_RE.search(compact(article.get("source"))) and not fetch_article_text(article):
        return True
    return False


def filter_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    articles = [article for article in payload.get("articles") or [] if isinstance(article, dict)]
    removed: list[dict[str, Any]] = []
    kept: list[dict[str, Any]] = []
    for article in articles:
        if unreachable_article(article):
            removed.append(article)
        else:
            kept.append(article)
    removed_keys = {source_key(article) for article in removed}
    payload["articles"] = kept
    if isinstance(payload.get("summaries"), dict):
        active_ids = {compact(article.get("id")) for article in kept if compact(article.get("id"))}
        payload["summaries"] = {key: value for key, value in payload["summaries"].items() if key in active_ids}
    meta = payload.setdefault("scanMeta", {})
    meta["unreachableArticleFilter"] = {
        "policy": "remove_unavailable_source_pages_before_retention_v1",
        "inputArticles": len(articles),
        "removedArticles": len(removed),
        "removedTitles": [compact(article.get("title")) for article in removed[:20]],
    }
    return payload, removed


def prune_archive(removed: list[dict[str, Any]]) -> None:
    if not removed or not ARCHIVE_FILE.exists():
        return
    archive = load(ARCHIVE_FILE)
    removed_keys = {source_key(article) for article in removed}
    removed_titles = {compact(article.get("title")).lower() for article in removed}
    kept = []
    for article in archive.get("articles") or []:
        if not isinstance(article, dict):
            continue
        if source_key(article) in removed_keys or compact(article.get("title")).lower() in removed_titles:
            continue
        kept.append(article)
    archive["articles"] = kept
    ARCHIVE_FILE.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    payload = load(LATEST_FILE)
    payload, removed = filter_payload(payload)
    prune_archive(removed)
    LATEST_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"unreachable article filter: removed={len(removed)}")


if __name__ == "__main__":
    main()
