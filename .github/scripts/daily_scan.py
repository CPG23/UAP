import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

try:
    import trafilatura
except Exception:
    trafilatura = None

try:
    from googlenewsdecoder import gnewsdecoder
except Exception:
    gnewsdecoder = None

NTFY_TOPIC = os.environ.get('NTFY_TOPIC', '').strip()
SEEN_FILE = '.seen-ids.json'
LATEST_FILE = 'latest-news.json'
NTFY_PAYLOAD_FILE = 'ntfy-payload.json'
TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')
RETENTION_DAYS = 14
MAX_FEED_ARTICLES = 36
SUMMARY_LIMIT = 24

POSITIVE_RE = re.compile(r'\b(uap|ufo|ufos|uaps|aaro|unidentified anomalous|unidentified aerial|pentagon|dod|nasa|congress|senate|disclosure|whistleblower|sighting|crash retrieval|nonhuman|non-human)\b', re.I)
STRONG_RE = re.compile(r'\b(uap|ufo|ufos|uaps|aaro|unidentified anomalous|pentagon|dod|nasa|congress|senate|disclosure|whistleblower|sighting)\b', re.I)
NEGATIVE_RE = re.compile(r'\b(movie|film|trailer|episode|season|series|netflix|hulu|streaming|review|recap|spoiler|actor|actress|anime|manga|comic|marvel|star wars|alienware|gaming|gameplay|video game|fortnite|roblox|pokemon|lego|toy|album|lyrics|horoscope|zodiac|astrology|restaurant|sports|nfl|nba|mlb|ufc)\b', re.I)
STOP = set('a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those uap ufo ufos uaps'.split())
KEY_TERMS = set('trump biden obama pope vatican catholic america congress senate pentagon nasa aaro dod cia fbi disclosure classified declassified whistleblower retrieval crash nonhuman alien extraterrestrial sighting sightings pilot radar navy military hearing government foia orb orbs'.split())
OFFICIAL_TERMS = set('congress senate pentagon nasa aaro dod cia fbi military navy government hearing classified declassified foia whistleblower disclosure'.split())
OFFICIAL_SOURCE_RE = re.compile(r'\b(nasa|pentagon|department of defense|defense\.gov|dod|aaro|congress|senate|house committee|house oversight|dni|odni|cia|fbi|faa|navy|air force|space force|white house|\.gov)\b', re.I)
TRUSTED_SOURCE_RE = re.compile(r'\b(reuters|associated press|\bap\b|bbc|npr|pbs|abc news|cbs news|nbc news|cnn|fox news|the guardian|new york times|washington post|wall street journal|usa today|politico|the hill|newsweek|newsnation|defensescoop|defense one|breaking defense|military\.com|scientific american|time|axios|bloomberg|forbes|u\.s\. news)\b', re.I)
BAD_SUMMARY_RE = re.compile(r'full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a ', re.I)

for path in [NTFY_PAYLOAD_FILE]:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass

try:
    notified_ids = set(json.load(open(SEEN_FILE, encoding='utf-8')))
except Exception:
    notified_ids = set()


def words(text):
    return [w for w in re.sub(r'[^a-z0-9]', ' ', (text or '').lower()).split() if len(w) > 2 and w not in STOP]


def topic_id(title):
    return '-'.join(sorted(set(words(title)))[:10]) or 'untitled'


def clean_text(text):
    text = html.unescape(text or '')
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def clean_title(title):
    return re.sub(r'\s+[-–]\s+[^-–]{2,45}$', '', clean_text(title)).strip()


def source_credibility(source):
    if OFFICIAL_SOURCE_RE.search(source or ''):
        return 14
    if TRUSTED_SOURCE_RE.search(source or ''):
        return 9
    return 0


def score_parts(article):
    title = article.get('title', '')
    desc = article.get('description', '')
    source = article.get('source', '')
    hay = ' '.join([title, desc, source])
    if not POSITIVE_RE.search(hay):
        return []
    if NEGATIVE_RE.search(hay) and not STRONG_RE.search(title):
        return []
    hay_words = set(words(hay))
    title_words = set(words(title))
    key_hits = sorted(hay_words & KEY_TERMS)
    official_hits = sorted(hay_words & OFFICIAL_TERMS)
    title_hits = sorted(title_words & KEY_TERMS)
    parts = [{'label': 'Basis', 'points': 27, 'text': 'UAP/UFO-Bezug erkannt und Unterhaltung/Gaming herausgefiltert.'}]
    if key_hits:
        parts.append({'label': 'Begriffe', 'points': min(24, len(key_hits) * 3), 'text': ', '.join(k.upper() for k in key_hits[:6]) + ' als relevante Themenbegriffe erkannt.'})
    if official_hits:
        parts.append({'label': 'Offiziell', 'points': min(18, len(official_hits) * 4), 'text': ', '.join(k.upper() for k in official_hits[:5]) + ' als offizieller Kontext erkannt.'})
    if title_hits:
        parts.append({'label': 'Titel', 'points': min(10, len(title_hits) * 2), 'text': 'Relevante Begriffe stehen direkt im Titel.'})
    trust = source_credibility(source)
    if trust:
        parts.append({'label': 'Quelle', 'points': trust, 'text': 'Quelle ist offiziell oder ein etabliertes Nachrichtenmedium.'})
    if STRONG_RE.search(title):
        parts.append({'label': 'Starker Titel', 'points': 13, 'text': 'Der Titel enthält einen klaren UAP/UFO-Bezug.'})
    elif STRONG_RE.search(desc):
        parts.append({'label': 'Starker Text', 'points': 6, 'text': 'Der Beschreibungstext enthält einen klaren UAP/UFO-Bezug.'})
    if re.search(r'\b(unidentified anomalous phenomena|crash retrieval|non-human|nonhuman|whistleblower|hearing|disclosure)\b', hay, re.I):
        parts.append({'label': 'Kernaussage', 'points': 7, 'text': 'Ein besonders relevantes UAP-Thema wird erkannt.'})
    if re.search(r'\b(pentagon|aaro|nasa|congress|senate)\b', title, re.I):
        parts.append({'label': 'Behörde im Titel', 'points': 6, 'text': 'Eine wichtige offizielle Stelle steht direkt im Titel.'})
    return parts


def score(article):
    parts = score_parts(article)
    if not parts:
        return 0
    return max(35, min(100, sum(p['points'] for p in parts)))


def similarity(a, b):
    aw = set(words(a.get('title', '') + ' ' + a.get('description', '')))
    bw = set(words(b.get('title', '') + ' ' + b.get('description', '')))
    if not aw or not bw:
        return 0
    return min(1, len(aw & bw) / min(len(aw), len(bw)) + len((aw & bw) & KEY_TERMS) * 0.08)


def parse_pub_date(value):
    try:
        dt = parsedate_to_datetime(value or '')
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def parse_article_date(value):
    try:
        return datetime.fromisoformat(str(value)[:10]).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def load_existing_feed():
    try:
        data = json.load(open(LATEST_FILE, encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def recent_enough(article):
    dt = parse_article_date(article.get('date'))
    return not dt or dt >= datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)


def fetch_rss(query, cutoff=None):
    url = 'https://news.google.com/rss/search?q=' + urllib.parse.quote(query) + '&hl=en-US&gl=US&ceid=US:en'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    out = []
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            root = ET.fromstring(r.read().decode('utf-8', errors='replace'))
        for item in root.findall('.//item'):
            title_el = item.find('title')
            if title_el is None or not title_el.text:
                continue
            published = parse_pub_date((item.findtext('pubDate') or '').strip())
            if cutoff and published and published < cutoff:
                continue
            article = {
                'title': clean_title(title_el.text),
                'source': clean_text(item.findtext('source') or '') or 'UAP News',
                'link': (item.findtext('link') or '').strip(),
                'description': clean_text(item.findtext('description') or ''),
                'date': published.strftime('%Y-%m-%d') if published else TODAY,
            }
            article['quality'] = score(article)
            if article['title'] and article['quality'] >= 35:
                out.append(article)
    except Exception as exc:
        print(f'RSS error for {query}: {exc}')
    return out


def group_articles(articles):
    groups = []
    for article in sorted(articles, key=lambda a: a.get('quality', 0), reverse=True):
        best_i, best = -1, 0
        for i, group in enumerate(groups):
            s = similarity(article, group['primary'])
            if s > best:
                best_i, best = i, s
        if best_i >= 0 and best >= 0.34:
            groups[best_i]['items'].append(article)
            if article.get('quality', 0) > groups[best_i]['primary'].get('quality', 0):
                groups[best_i]['primary'] = article
        else:
            groups.append({'primary': article, 'items': [article]})

    out = []
    for group in groups:
        primary = dict(group['primary'])
        sources, seen_sources, dates = [], set(), []
        for item in group['items']:
            source = item.get('source') or 'UAP News'
            if item.get('date'):
                dates.append(item['date'])
            if source.lower() not in seen_sources:
                seen_sources.add(source.lower())
                sources.append({'source': source, 'link': item.get('link', ''), 'title': item.get('title', '')})
        source_bonus = min(28, max(0, len(sources) - 1) * 7)
        quality_parts = score_parts(primary)
        quality_parts.append({'label': 'Mehrere Quellen', 'points': source_bonus, 'text': f'{len(sources)} Quelle(n) im aktuellen Feed.' if len(sources) > 1 else 'Nur eine Quelle im aktuellen Feed, daher kein Quellenbonus.'})
        primary.update({
            'id': topic_id(primary['title']),
            'date': min(dates) if dates else primary.get('date', TODAY),
            'mentions': len(sources),
            'otherSources': sources[1:],
            'clusterTitles': [i['title'] for i in group['items'] if i.get('title') and i.get('title') != primary['title']],
            'matchedTerms': sorted({w.upper() for w in words(primary['title'] + ' ' + primary.get('description', '')) if w in KEY_TERMS})[:8],
            'qualityBreakdown': quality_parts,
            'quality': min(100, max(35, sum(p['points'] for p in quality_parts))),
            'qualityExplanation': 'Die Punkte zeigen UAP-Bezug, starke Begriffe, offizielle Stellen, Quellenvertrauen und mehrere Quellen.',
        })
        out.append(primary)
    return sorted(out, key=lambda a: (a.get('quality', 0), a.get('mentions', 1)), reverse=True)


def decode_google_news_url(url):
    if not url or 'news.google.' not in url:
        return url or ''
    if gnewsdecoder:
        for candidate in [url, url.replace('/rss/articles/', '/read/')]:
            try:
                decoded = gnewsdecoder(candidate, interval=0.2)
                if isinstance(decoded, dict) and decoded.get('status') and decoded.get('decoded_url'):
                    return decoded['decoded_url']
            except Exception:
                pass
    return url


def resolve_article_url(url):
    decoded = decode_google_news_url(url)
    if decoded and 'news.google.' not in decoded:
        return decoded
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as r:
            final = r.geturl()
        if final and 'news.google.' not in final:
            return final
    except Exception:
        pass
    return decoded or url


def clean_article_text(text):
    text = re.sub(r'(?im)^(title|url source|published time):.*$', '', text or '')
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if re.search(r'google news|enable javascript|access denied|just a moment|captcha', text, re.I):
        return ''
    return text


def fetch_with_trafilatura(url):
    if not trafilatura or not url or 'news.google.' in url:
        return ''
    try:
        downloaded = trafilatura.fetch_url(url, no_ssl=True)
        if not downloaded:
            return ''
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False, favor_recall=True)
        text = clean_article_text(text)
        return text if len(text) >= 650 else ''
    except Exception:
        return ''


def fetch_with_jina(url):
    if not url or 'news.google.' in url:
        return ''
    try:
        clean = url.replace('https://', '').replace('http://', '')
        req = urllib.request.Request('https://r.jina.ai/http://' + clean, headers={'User-Agent': 'UAP-News-Bot/1.0'})
        with urllib.request.urlopen(req, timeout=25) as r:
            text = r.read(180000).decode('utf-8', errors='replace')
        text = clean_article_text(text)
        return text[:12000] if len(text) >= 650 else ''
    except Exception:
        return ''


def fetch_article_text(article):
    urls = []
    for source in [article.get('link', '')] + [s.get('link', '') for s in article.get('otherSources', []) if isinstance(s, dict)]:
        resolved = resolve_article_url(source)
        for candidate in [resolved, source]:
            if candidate and candidate not in urls:
                urls.append(candidate)
    for url in urls[:4]:
        text = fetch_with_trafilatura(url) or fetch_with_jina(url)
        if text:
            print('Article text extracted:', article.get('title', '')[:70], '=>', url[:90])
            return text
    return ''


def fallback_summary(article):
    terms = article.get('matchedTerms') or []
    pieces = [
        f'This item tracks a {article.get("source", "listed source")} report dated {article.get("date", TODAY)}.',
        f'The listed headline centers on: "{article.get("title", "this report")}".',
    ]
    if terms:
        pieces.append('The scanner connects the topic with ' + ', '.join(terms[:4]) + ' based on the headline and feed text.')
    if article.get('clusterTitles'):
        pieces.append('Related feed headlines mention: ' + '; '.join(article['clusterTitles'][:3]) + '.')
    pieces.append('The publisher text could not be safely extracted during this scan, so no unsupported details were added.')
    return ' '.join(pieces)


def ai_summary(article, text):
    if not text or len(text) < 650:
        return ''
    prompt = (
        'Summarize only the article text below in English in 5 to 7 factual sentences. '
        'Do not invent facts, dates, names, evidence, quotes, or connections. Use only claims explicitly present in the text. '
        'Mention concrete actors, decisions, claims, evidence, and uncertainty when present. '
        'If the text is not sufficient, answer exactly: INSUFFICIENT_SOURCE_TEXT. No markdown.\n\n'
        f'Title: {article.get("title", "")}\nSource: {article.get("source", "")}\n\n{text[:9000]}'
    )
    payload = json.dumps({
        'model': 'openai',
        'messages': [
            {'role': 'system', 'content': 'Reply only with the requested English summary. No markdown.'},
            {'role': 'user', 'content': prompt},
        ],
        'max_tokens': 950,
        'temperature': 0.15,
    }).encode('utf-8')
    try:
        req = urllib.request.Request('https://text.pollinations.ai/openai', data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'UAP-News-Bot/1.0'}, method='POST')
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read())
        summary = (((data.get('choices') or [{}])[0].get('message') or {}).get('content') or '').strip()
        return '' if summary == 'INSUFFICIENT_SOURCE_TEXT' or len(summary) < 180 else summary
    except Exception as exc:
        print(f'AI summary failed for {article.get("title", "")[:50]}: {exc}')
        return ''


def article_identity(article):
    return article.get('id') or topic_id(article.get('title', ''))


def merge_articles(*lists):
    merged, seen = [], set()
    for items in lists:
        for article in items or []:
            if not article or not article.get('title'):
                continue
            if not recent_enough(article):
                continue
            article = dict(article)
            aid = article_identity(article)
            if aid in seen:
                continue
            article['id'] = aid
            merged.append(article)
            seen.add(aid)
            if len(merged) >= MAX_FEED_ARTICLES:
                return merged
    return merged


def is_good_summary(text):
    return bool(text and len(text) > 180 and not BAD_SUMMARY_RE.search(text))


def payload_article(article, summaries):
    aid = article_identity(article)
    summary = summaries.get(aid) or article.get('summary') or fallback_summary(article)
    return {
        'id': aid,
        'title': article['title'],
        'source': article.get('source', 'UAP News'),
        'link': article.get('link', ''),
        'date': article.get('date', TODAY),
        'summary': summary,
        'mentions': article.get('mentions', 1),
        'otherSources': article.get('otherSources', []),
        'clusterTitles': article.get('clusterTitles', []),
        'quality': article.get('quality', 0),
        'qualityBreakdown': article.get('qualityBreakdown', []),
        'qualityExplanation': article.get('qualityExplanation', 'Die Punkte zeigen UAP-Bezug, starke Begriffe, offizielle Stellen, Quellenvertrauen und mehrere Quellen.'),
        'matchedTerms': article.get('matchedTerms', []),
    }


def write_notification_payload(new_articles):
    if not new_articles or not NTFY_TOPIC:
        return
    articles = new_articles[:10]
    ids = [a['id'] for a in articles]
    message = '\n'.join(f'{i + 1}. {a["title"]}' for i, a in enumerate(articles))
    click = 'https://cpg23.github.io/UAP/?notif=1&ids=' + urllib.parse.quote(','.join(ids), safe=',')
    payload = {
        'topic': NTFY_TOPIC,
        'title': f'UAP News - {len(articles)} new report{"s" if len(articles) > 1 else ""}',
        'message': message,
        'priority': 3,
        'tags': ['flying_saucer'],
        'click': click,
        'attach': 'https://cpg23.github.io/UAP/latest-news.json',
        'actions': [{'action': 'view', 'label': 'Open articles', 'url': click}],
    }
    json.dump(payload, open(NTFY_PAYLOAD_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


existing = load_existing_feed()
existing_articles = existing.get('articles') or []
existing_summaries = existing.get('summaries') or {}

broad_queries = [
    'UAP UFO 2026', 'UFO sighting 2026', 'UAP disclosure 2026', 'UAP whistleblower 2026',
    'UAP government Pentagon 2026', 'UAP AARO NASA Congress 2026',
    'UFO crash retrieval nonhuman 2026', 'unidentified anomalous phenomena hearing 2026',
]
notification_queries = ['UAP UFO 2026', 'UFO sighting 2026', 'UAP disclosure 2026', 'UAP Pentagon whistleblower 2026']

all_articles, seen_titles = [], set()
for query in broad_queries:
    for article in fetch_rss(query):
        key = article['title'].lower()
        if key not in seen_titles:
            all_articles.append(article)
            seen_titles.add(key)

grouped_all = group_articles(all_articles)
print(f'Broad scan: {len(all_articles)} articles, {len(grouped_all)} grouped topics')

cutoff = datetime.now(timezone.utc) - timedelta(hours=25)
notif_articles, notif_titles = [], set()
for query in notification_queries:
    for article in fetch_rss(query, cutoff=cutoff):
        key = article['title'].lower()
        if key not in notif_titles:
            notif_articles.append(article)
            notif_titles.add(key)

grouped_notif = group_articles(notif_articles)
new_articles = [a for a in grouped_notif if a['id'] not in notified_ids]
notification_articles = new_articles[:10]

fresh = merge_articles(new_articles[:10], grouped_notif[:10], grouped_all)
retained = merge_articles(fresh, existing_articles)
print(f'Notification: {len(notif_articles)} articles, {len(grouped_notif)} topics, {len(new_articles)} new')
print(f'App feed topics after retention: {len(retained)}')

summaries = {k: v for k, v in existing_summaries.items()} if isinstance(existing_summaries, dict) else {}
for article in retained[:SUMMARY_LIMIT]:
    aid = article_identity(article)
    if is_good_summary(summaries.get(aid)):
        continue
    text = fetch_article_text(article)
    summaries[aid] = ai_summary(article, text) or fallback_summary(article)
    time.sleep(1)

article_payloads = [payload_article(article, summaries) for article in retained]
summaries = {a['id']: a['summary'] for a in article_payloads}

latest = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'articles': article_payloads,
    'summaries': summaries,
    'notificationBatch': {
        'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'ids': [a['id'] for a in notification_articles],
        'articles': [{'id': a['id'], 'title': a['title'], 'source': a.get('source', 'UAP News')} for a in notification_articles],
    },
    'scanMeta': {
        'broadArticles': len(all_articles),
        'broadTopics': len(grouped_all),
        'notificationArticles': len(notif_articles),
        'notificationTopics': len(grouped_notif),
        'newNotificationTopics': len(new_articles),
        'appTopics': len(article_payloads),
        'retentionDays': RETENTION_DAYS,
        'filters': 'UAP relevance plus entertainment/gaming/fiction exclusion',
        'quality': 'Exact point breakdown per article: UAP relevance, official institutions, source trust, independent source count, topic clustering',
    },
}
json.dump(latest, open(LATEST_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'latest-news.json: {len(article_payloads)} app topics, {len(summaries)} summary keys')

if new_articles:
    new_ids = list(notified_ids | {a['id'] for a in new_articles})[-500:]
    json.dump(new_ids, open(SEEN_FILE, 'w', encoding='utf-8'))
    write_notification_payload(new_articles)

if not new_articles:
    print('No new topics - app feed still updated, notification skipped.')
