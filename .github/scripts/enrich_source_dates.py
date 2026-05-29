#!/usr/bin/env python3
"""Add publisher-page publication dates without changing scan freshness dates.

Google News RSS dates can be crawl/update times. The app should show the
publisher's own publication date when it can be read from reliable source-page
metadata, while keeping RSS/display timestamps for new markers, sorting, and
retention. The extractor is intentionally conservative: old dates from related
articles, archives, comments, scripts, or page boilerplate must not replace the
visible article date.
"""

from __future__ import annotations

import html
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

try:
    import trafilatura
except Exception:  # pragma: no cover - optional in local environments
    trafilatura = None

try:
    from enrich_summaries import decode_url
except Exception:
    def decode_url(url: str) -> str:
        return url or ""

LATEST_FILE = Path("latest-news.json")
HTML_READ_BYTES = 900_000
NOW = datetime.now(timezone.utc)
MIN_DATE = datetime(2020, 1, 1, tzinfo=timezone.utc)
MAX_DATE = NOW + timedelta(days=1)
MAX_SOURCE_AGE_BEFORE_RSS_DAYS = 60
MAX_SOURCE_AGE_AFTER_RSS_DAYS = 2

JSON_LD_RE = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', re.I)
META_RE = re.compile(r'<meta\s+([^>]+)>', re.I)
ATTR_RE = re.compile(r'([\w:-]+)\s*=\s*(["\'])(.*?)\2', re.I | re.S)
TIME_RE = re.compile(r'<time\b([^>]*)>', re.I)
TAG_RE = re.compile(r'<[^>]+>')
MONTH_RE = re.compile(
    r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+'
    r'(\d{1,2}),\s*(20\d{2})\b',
    re.I,
)
ISO_RE = re.compile(r'\b(20\d{2}-\d{2}-\d{2})(?:[T\s][0-2]\d:[0-5]\d(?::[0-5]\d)?(?:\.\d+)?(?:Z|[+-][0-2]\d:?\d{2})?)?\b')
PUBLISHED_KEYS = {
    'article:published_time', 'article:published', 'og:published_time',
    'datepublished', 'publishdate', 'pubdate', 'pub_date', 'published-date',
    'sailthru.date', 'parsely-pub-date', 'dc.date.issued', 'dcterms.issued',
    'citation_publication_date', 'publish_date', 'datecreated', 'created',
}
TIME_ITEMPROPS = {'datepublished', 'datecreated'}
MONTHS = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10,
    'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
}


def compact(value: Any) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def slugify(value: Any) -> str:
    text = compact(value).lower()
    text = text.replace('u.s.', 'us')
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


def parse_time(value: Any) -> datetime | None:
    text = html.unescape(compact(value))
    if not text:
        return None
    text = text.replace('Z', '+00:00') if text.endswith('Z') else text
    for candidate in [text, text[:10]]:
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(timezone.utc)
            return dt if MIN_DATE <= dt <= MAX_DATE else None
        except Exception:
            pass
    try:
        dt = parsedate_to_datetime(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
        return dt if MIN_DATE <= dt <= MAX_DATE else None
    except Exception:
        return None


def iso_date(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def rss_time(item: dict[str, Any]) -> datetime | None:
    return parse_time(item.get('rssPublishedAt') or item.get('publishedAt') or item.get('rssDate') or item.get('date'))


def plausible_source_date(dt: datetime, item: dict[str, Any]) -> bool:
    rss = rss_time(item)
    if not rss:
        return True
    earliest = rss - timedelta(days=MAX_SOURCE_AGE_BEFORE_RSS_DAYS)
    latest = rss + timedelta(days=MAX_SOURCE_AGE_AFTER_RSS_DAYS)
    return earliest <= dt <= latest


def walk_json_published(value: Any):
    if isinstance(value, dict):
        for key, item in value.items():
            low = str(key).lower()
            if low in {'datepublished', 'datecreated', 'publisheddate'}:
                yield item
            elif isinstance(item, (dict, list)):
                yield from walk_json_published(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_json_published(item)


def metadata_dates(raw_html: str) -> list[datetime]:
    dates: list[datetime] = []

    for match in JSON_LD_RE.finditer(raw_html or ''):
        payload = html.unescape(match.group(1)).strip()
        try:
            parsed = json.loads(payload)
        except Exception:
            continue
        for value in walk_json_published(parsed):
            dt = parse_time(value)
            if dt:
                dates.append(dt)

    for match in META_RE.finditer(raw_html or ''):
        attrs = {name.lower(): html.unescape(value).strip() for name, _, value in ATTR_RE.findall(match.group(1))}
        key = (attrs.get('property') or attrs.get('name') or attrs.get('itemprop') or '').lower()
        if key in PUBLISHED_KEYS:
            dt = parse_time(attrs.get('content'))
            if dt:
                dates.append(dt)

    for match in TIME_RE.finditer(raw_html or ''):
        attrs = {name.lower(): html.unescape(value).strip() for name, _, value in ATTR_RE.findall(match.group(1))}
        itemprop = (attrs.get('itemprop') or '').lower()
        class_name = (attrs.get('class') or '').lower()
        if itemprop in TIME_ITEMPROPS or 'publish' in class_name or 'date-published' in class_name:
            dt = parse_time(attrs.get('datetime') or attrs.get('title'))
            if dt:
                dates.append(dt)

    return dates


def visible_header_dates(raw_html: str, item: dict[str, Any]) -> list[datetime]:
    text = html.unescape(TAG_RE.sub(' ', raw_html or ''))
    title = compact(item.get('title'))
    title_pos = text.lower().find(title.lower()[:80]) if title else -1
    if title_pos >= 0:
        window = text[title_pos:title_pos + 5000]
    else:
        window = text[:8000]

    dates: list[datetime] = []
    for match in MONTH_RE.finditer(window):
        month = MONTHS.get(match.group(1).lower()[:3])
        if not month:
            continue
        try:
            dt = datetime(int(match.group(3)), month, int(match.group(2)), tzinfo=timezone.utc)
            if plausible_source_date(dt, item):
                dates.append(dt)
        except Exception:
            pass
    for match in ISO_RE.finditer(window):
        dt = parse_time(match.group(0))
        if dt and plausible_source_date(dt, item):
            dates.append(dt)
    return dates


def best_source_date(raw_html: str, item: dict[str, Any]) -> datetime | None:
    candidates = [dt for dt in metadata_dates(raw_html) if plausible_source_date(dt, item)]
    if not candidates:
        candidates = visible_header_dates(raw_html, item)
    if not candidates:
        return None
    rss = rss_time(item)
    if not rss:
        return min(candidates)
    return min(candidates, key=lambda dt: abs((rss - dt).total_seconds()))


def fetch_html(url: str) -> str:
    if not url or 'news.google.' in url:
        return ''
    if trafilatura:
        try:
            downloaded = trafilatura.fetch_url(url, no_ssl=True)
            if downloaded:
                return downloaded[:HTML_READ_BYTES]
        except Exception:
            pass
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=18) as resp:
            return resp.read(HTML_READ_BYTES).decode(resp.headers.get_content_charset() or 'utf-8', errors='replace')
    except Exception:
        return ''


def publisher_url(item: dict[str, Any]) -> str:
    source = compact(item.get('source')).lower()
    title = compact(item.get('title'))
    if 'usa herald' in source and title:
        return 'https://usaherald.com/' + slugify(title) + '/'
    return ''


def source_urls(item: dict[str, Any]) -> list[str]:
    raw = compact(item.get('link') or item.get('url'))
    urls: list[str] = []
    direct = publisher_url(item)
    if direct:
        urls.append(direct)
    try:
        decoded = decode_url(raw)
    except Exception:
        decoded = raw
    for candidate in (decoded, raw):
        if candidate and 'news.google.' not in candidate and candidate not in urls:
            urls.append(candidate)
    return urls


def apply_source_date(item: dict[str, Any], dt: datetime | None) -> bool:
    current = parse_time(item.get('sourcePublishedAt'))
    if current and plausible_source_date(current, item) and dt is None:
        return False
    if dt is None:
        changed = False
        for key in ('sourcePublishedAt', 'sourceDate', 'publisherPublishedAt', 'publisherDate'):
            if key in item:
                item.pop(key, None)
                changed = True
        return changed

    value = iso_date(dt)
    if item.get('sourcePublishedAt') == value:
        return False
    if item.get('publishedAt') and not item.get('rssPublishedAt'):
        item['rssPublishedAt'] = item.get('publishedAt')
    if item.get('date') and not item.get('rssDate'):
        item['rssDate'] = item.get('date')
    item['sourcePublishedAt'] = value
    return True


def enrich_item(item: dict[str, Any], cache: dict[str, datetime | None]) -> bool:
    if item.get('sourcePublishedAt') and not plausible_source_date(parse_time(item.get('sourcePublishedAt')) or datetime(1900, 1, 1, tzinfo=timezone.utc), item):
        return apply_source_date(item, None)

    for url in source_urls(item):
        if url not in cache:
            raw = fetch_html(url)
            cache[url] = best_source_date(raw, item) if raw else None
        if cache[url]:
            return apply_source_date(item, cache[url])
    return apply_source_date(item, None)


def main() -> None:
    data = json.loads(LATEST_FILE.read_text(encoding='utf-8'))
    cache: dict[str, datetime | None] = {}
    changed = 0
    checked = 0

    for article in data.get('articles') or []:
        if not isinstance(article, dict):
            continue
        checked += 1
        if enrich_item(article, cache):
            changed += 1
        for source in article.get('otherSources') or []:
            if isinstance(source, dict):
                checked += 1
                if enrich_item(source, cache):
                    changed += 1

    meta = data.setdefault('scanMeta', {})
    meta['sourceDateEnrichment'] = {
        'policy': 'publisher_sourcePublishedAt_from_structured_or_header_date_with_rss_plausibility_window',
        'checkedSources': checked,
        'updatedSources': changed,
        'maxSourceAgeBeforeRssDays': MAX_SOURCE_AGE_BEFORE_RSS_DAYS,
    }

    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'source dates enriched: updated={changed}; checked={checked}')


if __name__ == '__main__':
    main()
