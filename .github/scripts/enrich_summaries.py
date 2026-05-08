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
    r'full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a ',
    re.I,
)


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
    text = re.sub(r'(?im)^(title|url source|published time):.*$', '', text or '')
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if re.search(r'google news|enable javascript|access denied|just a moment|captcha', text, re.I):
        return ''
    return text


def fetch_trafilatura(url):
    if not trafilatura or not url or 'news.google.' in url:
        return ''
    try:
        downloaded = trafilatura.fetch_url(url, no_ssl=True)
        if not downloaded:
            return ''
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False, favor_recall=True)
        text = clean_text(text)
        return text if len(text) >= 650 else ''
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
                text = resp.read(180000).decode('utf-8', errors='replace')
            text = clean_text(text)
            if len(text) >= 650:
                return text[:12000]
        except Exception:
            pass
    return ''


def article_urls(article):
    urls = []
    for item in [article] + [s for s in article.get('otherSources', []) if isinstance(s, dict)]:
        raw = item.get('link', '')
        decoded = decode_url(raw)
        for value in [decoded, raw]:
            if value and value not in urls:
                urls.append(value)
    return urls[:6]


def fetch_article_text(article):
    for url in article_urls(article):
        text = fetch_trafilatura(url) or fetch_jina(url)
        if text:
            print('extracted article text:', article.get('title', '')[:70], '=>', url[:100])
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
    if len(text) < 650:
        return ''
    prompt = (
        'Summarize only the article text below in English in 5 to 7 factual sentences. '
        'Do not invent facts, dates, names, evidence, quotes, or connections. Use only claims explicitly present in the text. '
        'Mention concrete actors, decisions, claims, evidence, and uncertainty when present. '
        'If the text is not sufficient, answer exactly: INSUFFICIENT_SOURCE_TEXT. No markdown.\n\n'
        f'Title: {article.get("title", "")}\nSource: {article.get("source", "")}\n\n{text[:9000]}'
    )
    try:
        summary = call_ai([
            {'role': 'system', 'content': 'Reply only with the requested English summary. No markdown.'},
            {'role': 'user', 'content': prompt},
        ])
        if summary and summary != 'INSUFFICIENT_SOURCE_TEXT' and len(summary) >= 180:
            return summary
    except Exception as exc:
        print('article summary failed:', article.get('title', '')[:60], str(exc)[:120])
    return ''


def summarize_metadata(article):
    sources = [article.get('source') or 'the listed source'] + [s.get('source', '') for s in article.get('otherSources', []) if isinstance(s, dict)]
    sources = [s for i, s in enumerate(sources) if s and s.lower() not in [x.lower() for x in sources[:i]]]
    clusters = article.get('clusterTitles') or []
    terms = article.get('matchedTerms') or []
    prompt = (
        'Write an English UAP news brief in 4 to 5 factual sentences using ONLY this feed metadata. '
        'Do not add facts that are not present here. Do not say that article extraction failed. '
        'If a claim is only in the headline, phrase it as the headline/report says or claims. No markdown.\n\n'
        f'Headline: {article.get("title", "")}\n'
        f'Source: {article.get("source", "")}\n'
        f'Date: {article.get("date", "")}\n'
        f'Available description: {article.get("description", "")}\n'
        f'Related headlines: {"; ".join(clusters[:4])}\n'
        f'Sources in cluster: {", ".join(sources[:6])}\n'
        f'Matched UAP terms: {", ".join(terms[:8])}'
    )
    try:
        summary = call_ai([
            {'role': 'system', 'content': 'You write careful, source-grounded English news briefs. No markdown.'},
            {'role': 'user', 'content': prompt},
        ], max_tokens=650, temperature=0.2)
        if summary and len(summary) >= 180 and not BAD_SUMMARY_RE.search(summary):
            return summary
    except Exception as exc:
        print('metadata summary failed:', article.get('title', '')[:60], str(exc)[:120])
    return deterministic_metadata_summary(article)


def deterministic_metadata_summary(article):
    title = article.get('title') or 'this UAP-related report'
    source = article.get('source') or 'the listed source'
    date = article.get('date') or 'the listed date'
    terms = article.get('matchedTerms') or []
    clusters = article.get('clusterTitles') or []
    parts = [
        f'{source} lists a UAP-related report dated {date} under the headline "{title}".',
        'The headline is treated as the source claim, and the app does not add details that are not present in the feed metadata.',
    ]
    if terms:
        parts.append('The feed metadata connects the topic with ' + ', '.join(terms[:5]) + '.')
    if clusters:
        parts.append('Related headlines in the same topic cluster mention: ' + '; '.join(clusters[:3]) + '.')
    parts.append('For deeper context, use the linked sources below the article card.')
    return ' '.join(parts)


def main():
    data = json.loads(LATEST_FILE.read_text(encoding='utf-8'))
    summaries = data.setdefault('summaries', {})
    changed = False
    repaired = 0
    for article in data.get('articles', [])[:24]:
        aid = article.get('id')
        current = article.get('summary') or summaries.get(aid)
        if not is_bad_summary(current):
            continue
        text = fetch_article_text(article)
        summary = summarize_article_text(article, text) or summarize_metadata(article)
        if summary:
            article['summary'] = summary
            if aid:
                summaries[aid] = summary
            changed = True
            repaired += 1
            time.sleep(1)
    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'enriched summaries: {repaired}')


if __name__ == '__main__':
    main()
