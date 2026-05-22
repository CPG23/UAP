import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import trafilatura
except Exception:
    trafilatura = None

try:
    from googlenewsdecoder import gnewsdecoder
except Exception:
    gnewsdecoder = None

LATEST_FILE = Path('latest-news.json')
BAD_SUMMARY_RE = re.compile(
    r'full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a |publisher text could not be safely extracted|the headline states|the headline is treated|the article falls under|available feed metadata|listed headline|matched uap terms|for deeper context',
    re.I,
)
BLOCK_TAG_RE = re.compile(r'</?(?:article|main|section|div|p|br|h1|h2|h3|li|blockquote|figcaption)[^>]*>', re.I)
SCRIPT_STYLE_RE = re.compile(r'<(script|style|noscript|svg|iframe|video|form|button)[\s\S]*?</\1>', re.I)
COMMENT_RE = re.compile(r'<!--[\s\S]*?-->')
TAG_RE = re.compile(r'<[^>]+>')
JSON_LD_RE = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', re.I)
META_RE = re.compile(r'<meta\s+([^>]+)>', re.I)
ATTR_RE = re.compile(r'([\w:-]+)\s*=\s*(["\'])(.*?)\2', re.I | re.S)
WORD_RE = re.compile(r'[a-z0-9]+', re.I)
BOILERPLATE_RE = re.compile(
    r'^(advertisement|sponsored|subscribe|sign up|log in|cookie|cookies|privacy|terms|share|follow us|watch live|read more|related|recommended|caption|image source|skip to|enable javascript|newsletter|up next)\b',
    re.I,
)
UAP_RE = re.compile(r'\b(uap|ufo|ufos|uaps|unidentified anomalous|unidentified aerial|unidentified flying|alien|pentagon|aaro|nasa|congress|disclosure|whistleblower|sighting|orb|orbs|war\.gov|pursue)\b', re.I)
STOP_WORDS = set(
    'a an the to of for in on at by with from and or is are was were be been has have had will would could should may might this that these those article report story piece headline title about into after before over under'.split()
)
MIN_EXTRACT_CHARS = 450
STRONG_EXTRACT_CHARS = 650
HTML_READ_BYTES = 1_600_000


def is_bad_summary(text):
    return not text or len(text) < 180 or bool(BAD_SUMMARY_RE.search(text))


def google_id(url):
    match = re.search(r'/(?:rss/articles|articles|read)/([^?]+)', url or '')
    return match.group(1) if match else ''


def walk(value):
    if isinstance(value, str):
        yield value
        if ('garturlres' in value or 'http' in value) and (value.startswith('[') or value.startswith('{')):
            try:
                yield from walk(json.loads(value))
            except Exception:
                pass
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk(item)


def clean_url(url):
    url = html.unescape(url or '').replace('\\/', '/')
    try:
        url = bytes(url, 'utf-8').decode('unicode_escape')
    except Exception:
        pass
    return url.strip()


def decode_batchexecute(url):
    gid = google_id(url)
    if not gid:
        return ''
    inner = [
        'garturlreq',
        [[
            'en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], None, None,
            1, 1, 'US:en', None, 180, None, None, None, None, None,
            0, None, None, [1608992183, 723341000]
        ], 'en-US', 'US', 1, [2, 3, 4, 8], 1, 0, '655000234', 0, 0, None, 0],
        gid,
    ]
    outer = [[['Fbv4je', json.dumps(inner, separators=(',', ':')), None, 'generic']]]
    body = ('f.req=' + urllib.parse.quote(json.dumps(outer, separators=(',', ':')))).encode('utf-8')
    req = urllib.request.Request(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
        data=body,
        headers={
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            'Referer': 'https://news.google.com/',
            'User-Agent': 'Mozilla/5.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode('utf-8', errors='replace')
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith('['):
                continue
            try:
                parsed = json.loads(line)
            except Exception:
                continue
            for candidate in walk(parsed):
                candidate = clean_url(candidate)
                if candidate.startswith('http') and 'news.google.' not in candidate:
                    return candidate
        for pattern in [
            r'"garturlres","(https?:\\/\\/.*?)(?=",)',
            r'\\"garturlres\\",\\"(https?:.*?)(?=\\")',
            r'(https?:\\/\\/[^"\\]+)',
        ]:
            match = re.search(pattern, text)
            if match:
                candidate = clean_url(match.group(1))
                if candidate.startswith('http') and 'news.google.' not in candidate:
                    return candidate
    except Exception as exc:
        print('batchexecute decode failed:', str(exc)[:120])
    return ''


def decode_url(url):
    if not url or 'news.google.' not in url:
        return url or ''
    for candidate in [url, url.replace('/rss/articles/', '/read/')]:
        if gnewsdecoder:
            try:
                result = gnewsdecoder(candidate, interval=0.2)
                if isinstance(result, dict) and result.get('status') and result.get('decoded_url'):
                    return result['decoded_url']
            except Exception:
                pass
        decoded = decode_batchexecute(candidate)
        if decoded:
            return decoded
    return url


def clean_text(text):
    text = html.unescape(text or '')
    text = re.sub(r'(?im)^(title|url source|published time):.*$', '', text)
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if re.search(r'google news|enable javascript|access denied|just a moment|captcha', text, re.I):
        return ''
    return text


def words(value):
    return {
        word.lower()
        for word in WORD_RE.findall(str(value or ''))
        if len(word) > 2 and word.lower() not in STOP_WORDS
    }


def title_overlap(line, article):
    title_words = words(article.get('title', ''))
    line_words = words(line)
    if not title_words or not line_words:
        return 0
    return len(title_words & line_words) / max(1, min(len(title_words), len(line_words)))


def useful_line(line, article):
    line = clean_text(line)
    if len(line) < 55 or BOILERPLATE_RE.search(line):
        return False
    line_words = words(line)
    if len(line_words) < 8:
        return False
    if re.search(r'\b(video|watch|listen)\b', line, re.I) and len(line) < 120:
        return False
    return bool(UAP_RE.search(line)) or title_overlap(line, article) >= 0.14 or len(line) >= 120


def clean_html_for_lines(raw_html):
    doc = COMMENT_RE.sub(' ', raw_html or '')
    doc = SCRIPT_STYLE_RE.sub(' ', doc)
    doc = BLOCK_TAG_RE.sub('\n', doc)
    doc = TAG_RE.sub(' ', doc)
    doc = html.unescape(doc)
    return [clean_text(line) for line in doc.splitlines()]


def extract_meta_descriptions(raw_html):
    snippets = []
    for match in META_RE.finditer(raw_html or ''):
        attrs = {name.lower(): html.unescape(value).strip() for name, _, value in ATTR_RE.findall(match.group(1))}
        key = (attrs.get('name') or attrs.get('property') or '').lower()
        if key in {'description', 'og:description', 'twitter:description'} and attrs.get('content'):
            snippets.append(clean_text(attrs['content']))
    return snippets


def jsonld_values(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from jsonld_values(item)
    elif isinstance(value, dict):
        for key in ['articleBody', 'description', 'abstract']:
            if value.get(key):
                yield from jsonld_values(value[key])
        for key in ['mainEntity', 'mainEntityOfPage', '@graph']:
            if value.get(key):
                yield from jsonld_values(value[key])


def extract_jsonld_text(raw_html):
    snippets = []
    for match in JSON_LD_RE.finditer(raw_html or ''):
        payload = html.unescape(match.group(1)).strip()
        try:
            parsed = json.loads(payload)
        except Exception:
            continue
        for value in jsonld_values(parsed):
            text = clean_text(value)
            if len(text) >= 80:
                snippets.append(text)
    return snippets


def best_contiguous_text(lines, article):
    runs = []
    current = []
    for line in lines:
        if useful_line(line, article):
            current.append(line)
            continue
        if current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    if not runs:
        return ''
    best = max(runs, key=lambda run: (sum(len(line) for line in run), len(run)))
    return clean_text(' '.join(best))


def paragraph_fallback(raw_html, article):
    if not raw_html:
        return ''
    jsonld = extract_jsonld_text(raw_html)
    long_jsonld = [text for text in jsonld if len(text) >= MIN_EXTRACT_CHARS]
    if long_jsonld:
        return clean_text(' '.join(long_jsonld))[:12000]

    lines = clean_html_for_lines(raw_html)
    picked = []
    seen = set()
    for line in lines:
        key = line.lower()
        if key in seen or not useful_line(line, article):
            continue
        seen.add(key)
        picked.append(line)
        if len(' '.join(picked)) >= 2200 or len(picked) >= 18:
            break
    text = clean_text(' '.join(picked))
    if len(text) >= MIN_EXTRACT_CHARS:
        return text[:12000]

    contiguous = best_contiguous_text(lines, article)
    if len(contiguous) >= MIN_EXTRACT_CHARS:
        return contiguous[:12000]

    meta = [item for item in extract_meta_descriptions(raw_html) + jsonld if useful_line(item, article) or len(item) >= 90]
    meta_text = clean_text(' '.join(dict.fromkeys(meta)))
    if len(meta_text) >= 180:
        return meta_text[:4000]
    return ''


def fetch_html_fallback(url, article):
    if not url or 'news.google.' in url:
        return ''
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read(HTML_READ_BYTES).decode(resp.headers.get_content_charset() or 'utf-8', errors='replace')
        text = paragraph_fallback(raw, article)
        return text if len(text) >= 180 else ''
    except Exception:
        return ''


def fetch_trafilatura(url, article=None):
    if not trafilatura or not url or 'news.google.' in url:
        return ''
    try:
        downloaded = trafilatura.fetch_url(url, no_ssl=True)
        if not downloaded:
            return ''
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False, favor_recall=True)
        text = clean_text(text)
        if len(text) >= STRONG_EXTRACT_CHARS:
            return text
        fallback = paragraph_fallback(downloaded, article or {})
        return fallback if len(fallback) >= MIN_EXTRACT_CHARS else ''
    except Exception:
        return ''


def fetch_jina(url):
    if not url or 'news.google.' in url:
        return ''
    variants = []
    no_scheme = re.sub(r'^https?://', '', url)
    variants.append('https://r.jina.ai/http://' + no_scheme)
    variants.append('https://r.jina.ai/http://https://' + no_scheme)
    for reader_url in variants:
        try:
            req = urllib.request.Request(reader_url, headers={'User-Agent': 'UAP-News-Bot/1.0'})
            with urllib.request.urlopen(req, timeout=25) as resp:
                text = resp.read(HTML_READ_BYTES).decode('utf-8', errors='replace')
            text = clean_text(text)
            if len(text) >= MIN_EXTRACT_CHARS:
                return text[:12000]
        except Exception:
            pass
    return ''


def publisher_direct_urls(article):
    title = clean_text(article.get('title', '')).lower()
    source = clean_text(article.get('source', '')).lower()
    urls = []
    if 'department of war' in source or 'war.gov' in source or 'department of war publishes' in title:
        if 'second release' in title and 'unidentified anomalous phenomena' in title:
            urls.append('https://www.war.gov/News/Releases/Release/Article/4499305/department-of-war-publishes-second-release-of-unidentified-anomalous-phenomena/')
    return urls


def article_urls(article):
    urls = []
    for value in publisher_direct_urls(article):
        if value and value not in urls:
            urls.append(value)
    for item in [article] + [s for s in article.get('otherSources', []) if isinstance(s, dict)]:
        raw = item.get('link', '') or item.get('url', '')
        decoded = decode_url(raw)
        for value in [decoded, raw]:
            if value and value not in urls:
                urls.append(value)
    return urls[:10]


def fetch_article_text(article):
    for url in article_urls(article):
        text = fetch_trafilatura(url, article) or fetch_html_fallback(url, article) or fetch_jina(url)
        if text:
            print('extracted article text:', article.get('title', '')[:70], '=>', url[:100], 'chars=', len(text))
            return text
    print('no article text:', article.get('title', '')[:90])
    return ''


def call_ai(messages, max_tokens=950, temperature=0.15):
    payload = json.dumps({
        'model': 'openai',
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature,
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://text.pollinations.ai/openai',
        data=payload,
        headers={'Content-Type': 'application/json', 'User-Agent': 'UAP-News-Bot/1.0'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read())
    return (((data.get('choices') or [{}])[0].get('message') or {}).get('content') or '').strip()


def summarize_article_text(article, text):
    if len(text) < 180:
        return ''
    prompt = (
        'Summarize only the article text below in English in 3 to 5 compact factual sentences for a mobile news app. '
        'Do not invent facts, dates, names, evidence, quotes, or connections. Use only claims explicitly present in the text. '
        'Focus on what happened, who is involved, what evidence or statements are described, and what remains uncertain. '
        'If the source text is short because only meta description or JSON-LD was available, summarize only that limited content without adding context. '
        'Do not mention metadata, categories, extraction, the scanner, the headline as headline, or the app. '
        'If the text is not sufficient, answer exactly: INSUFFICIENT_SOURCE_TEXT. No markdown.\n\n'
        f'Title: {article.get("title", "")}\nSource: {article.get("source", "")}\n\n{text[:9000]}'
    )
    try:
        summary = call_ai([
            {'role': 'system', 'content': 'Reply only with the requested article-content summary. No markdown.'},
            {'role': 'user', 'content': prompt},
        ])
        if summary and summary != 'INSUFFICIENT_SOURCE_TEXT' and not is_bad_summary(summary):
            return summary
    except Exception as exc:
        print('article summary failed:', article.get('title', '')[:60], str(exc)[:120])
    return ''


def main():
    data = json.loads(LATEST_FILE.read_text(encoding='utf-8'))
    summaries = data.setdefault('summaries', {})
    changed = False
    repaired = 0
    failed = 0
    for article in data.get('articles', [])[:24]:
        aid = article.get('id')
        current = article.get('summary') or summaries.get(aid)
        if not is_bad_summary(current):
            continue
        text = fetch_article_text(article)
        summary = summarize_article_text(article, text)
        if summary:
            article['summary'] = summary
            article.pop('summaryStatus', None)
            if aid:
                summaries[aid] = summary
            repaired += 1
        else:
            article['summary'] = ''
            if aid and aid in summaries:
                summaries.pop(aid, None)
            article.setdefault('summaryStatus', {})['articleContentSummary'] = 'missing'
            failed += 1
        changed = True
        time.sleep(1)
    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'enriched article-content summaries: repaired={repaired}; failed={failed}')


if __name__ == '__main__':
    main()
