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

NTFY_TOPIC = os.environ.get('NTFY_TOPIC', '').strip()
SEEN_FILE = '.seen-ids.json'
TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

try:
    with open(SEEN_FILE, encoding='utf-8') as f:
        notified_ids = set(json.load(f))
except Exception:
    notified_ids = set()

POSITIVE_RE = re.compile(r'\b(uap|ufo|ufos|uaps|aaro|unidentified anomalous|unidentified aerial|pentagon|dod|nasa|congress|senate|disclosure|whistleblower|sighting|crash retrieval|nonhuman|non-human)\b', re.I)
STRONG_RE = re.compile(r'\b(uap|ufo|ufos|uaps|aaro|unidentified anomalous|pentagon|dod|nasa|congress|senate|disclosure|whistleblower|sighting)\b', re.I)
NEGATIVE_RE = re.compile(r'\b(movie|film|trailer|episode|season|series|netflix|hulu|streaming|review|recap|spoiler|actor|actress|anime|manga|comic|marvel|star wars|alienware|gaming|gameplay|video game|fortnite|roblox|pokemon|lego|toy|album|lyrics|horoscope|zodiac|astrology|restaurant|sports|nfl|nba|mlb|ufc)\b', re.I)
STOP = set('a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those uap ufo ufos uaps'.split())
KEY_TERMS = set('trump biden obama pope vatican catholic america congress senate pentagon nasa aaro dod cia fbi disclosure classified declassified whistleblower retrieval crash nonhuman alien extraterrestrial sighting sightings pilot radar navy military hearing government foia orb orbs'.split())


def words(text):
    return [w for w in re.sub(r'[^a-z0-9]', ' ', (text or '').lower()).split() if len(w) > 2 and w not in STOP]


def topic_id(title):
    ws = sorted(set(words(title)))
    return '-'.join(ws[:10]) or 'untitled'


def clean_text(text):
    text = html.unescape(text or '')
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def clean_title(title):
    title = clean_text(title)
    return re.sub(r'\s+[-–]\s+[^-–]{2,45}$', '', title).strip()


def score(article):
    hay = ' '.join([article.get('title', ''), article.get('description', ''), article.get('source', '')])
    if not POSITIVE_RE.search(hay):
        return 0
    if NEGATIVE_RE.search(hay) and not STRONG_RE.search(article.get('title', '')):
        return 0
    value = 20
    value += min(35, len(set(words(hay)) & KEY_TERMS) * 5)
    if STRONG_RE.search(article.get('title', '')):
        value += 20
    if re.search(r'\b(pentagon|aaro|nasa|congress|senate|whistleblower|disclosure|sighting)\b', article.get('title', ''), re.I):
        value += 15
    return min(100, value)


def similarity(a, b):
    aw = set(words(a.get('title', '') + ' ' + a.get('description', '')))
    bw = set(words(b.get('title', '') + ' ' + b.get('description', '')))
    if not aw or not bw:
        return 0
    overlap = len(aw & bw) / min(len(aw), len(bw))
    shared_terms = len((aw & bw) & KEY_TERMS)
    return min(1, overlap + shared_terms * 0.08)


def fetch_rss(query, cutoff=None):
    url = 'https://news.google.com/rss/search?q=' + urllib.parse.quote(query) + '&hl=en-US&gl=US&ceid=US:en'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    results = []
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            root = ET.fromstring(r.read().decode('utf-8', errors='replace'))
        for item in root.findall('.//item'):
            title_el = item.find('title')
            if title_el is None or not title_el.text:
                continue
            if cutoff is not None:
                pd_el = item.find('pubDate')
                if pd_el is not None and pd_el.text:
                    try:
                        published = parsedate_to_datetime(pd_el.text.strip())
                        if published.tzinfo is None:
                            published = published.replace(tzinfo=timezone.utc)
                        if published < cutoff:
                            continue
                    except Exception:
                        pass
            source_el = item.find('source')
            link_el = item.find('link')
            desc_el = item.find('description')
            article = {
                'title': clean_title(title_el.text),
                'source': clean_text(source_el.text if source_el is not None else '') or 'UAP News',
                'link': (link_el.text or '').strip() if link_el is not None else '',
                'description': clean_text(desc_el.text if desc_el is not None else ''),
                'date': TODAY,
            }
            article['quality'] = score(article)
            if article['title'] and article['quality'] >= 35:
                results.append(article)
    except Exception as exc:
        print(f'RSS error for {query}: {exc}')
    return results


def group_articles(articles):
    groups = []
    for article in sorted(articles, key=lambda a: a.get('quality', 0), reverse=True):
        best_i, best_score = -1, 0
        for i, group in enumerate(groups):
            s = similarity(article, group['primary'])
            if s > best_score:
                best_i, best_score = i, s
        if best_i >= 0 and best_score >= 0.34:
            groups[best_i]['items'].append(article)
            if article.get('quality', 0) > groups[best_i]['primary'].get('quality', 0):
                groups[best_i]['primary'] = article
        else:
            groups.append({'primary': article, 'items': [article]})

    output = []
    for group in groups:
        primary = dict(group['primary'])
        seen_sources = set()
        sources = []
        for item in group['items']:
            source = item.get('source') or 'UAP News'
            key = source.lower()
            if key in seen_sources:
                continue
            seen_sources.add(key)
            sources.append({'source': source, 'link': item.get('link', ''), 'title': item.get('title', '')})
        source_boost = min(25, max(0, len(sources) - 1) * 6)
        primary['id'] = topic_id(primary['title'])
        primary['mentions'] = len(sources)
        primary['otherSources'] = sources[1:]
        primary['clusterTitles'] = [i.get('title', '') for i in group['items'] if i.get('title') and i.get('title') != primary['title']]
        primary['matchedTerms'] = sorted({w.upper() for w in words(primary['title'] + ' ' + primary.get('description', '')) if w in KEY_TERMS})[:8]
        primary['quality'] = min(100, primary.get('quality', 0) + source_boost)
        primary['qualityExplanation'] = 'Bewertet nach UAP-Relevanz, offiziellen Begriffen/Institutionen, Quellenanzahl und Themenbündelung.'
        output.append(primary)
    return sorted(output, key=lambda a: (a.get('quality', 0), a.get('mentions', 1)), reverse=True)


def fetch_article_text(url):
    if not url:
        return ''
    try:
        req = urllib.request.Request('https://r.jina.ai/' + url, headers={'User-Agent': 'UAP-News-Bot/1.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read(140000).decode('utf-8', errors='replace')
        text = re.sub(r'(?im)^(title|url source|published time):.*$', '', text)
        text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) >= 700 and not re.search(r'google news|enable javascript|access denied|just a moment', text, re.I):
            return text[:10000]
    except Exception:
        return ''
    return ''


def ai_summary(title, text, source_count):
    if not text or len(text) < 700:
        return ''
    prompt = (
        'Summarize ONLY the article text below in 6 factual sentences. Do not add facts, dates, names, claims, or context that are not explicitly present. '
        'Include the concrete actors, decisions, claims, evidence, and uncertainty that the article itself states. '
        'If the text is insufficient, return exactly: INSUFFICIENT_SOURCE_TEXT. Plain English, no markdown. '
        f'This topic is covered by {source_count} source(s).\n\n{text[:8000]}'
    )
    payload = json.dumps({
        'model': 'openai',
        'messages': [
            {'role': 'system', 'content': 'Return only what is asked. Plain text, no markdown.'},
            {'role': 'user', 'content': prompt},
        ],
        'max_tokens': 950,
        'temperature': 0.2,
    }).encode('utf-8')
    try:
        req = urllib.request.Request('https://text.pollinations.ai/openai', data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'UAP-News-Bot/1.0'}, method='POST')
        with urllib.request.urlopen(req, timeout=35) as r:
            data = json.loads(r.read())
        summary = (((data.get('choices') or [{}])[0].get('message') or {}).get('content') or '').strip()
        if summary == 'INSUFFICIENT_SOURCE_TEXT' or len(summary) < 180:
            return ''
        return summary
    except Exception as exc:
        print(f'AI summary failed for {title[:50]}: {exc}')
        return ''


broad_queries = [
    'UAP UFO 2026',
    'UFO sighting 2026',
    'UAP disclosure 2026',
    'UAP whistleblower 2026',
    'UAP government Pentagon 2026',
    'UAP AARO NASA Congress 2026',
    'UFO crash retrieval nonhuman 2026',
    'unidentified anomalous phenomena hearing 2026',
]
notification_queries = [
    'UAP UFO 2026',
    'UFO sighting 2026',
    'UAP disclosure 2026',
    'UAP Pentagon whistleblower 2026',
]

seen_titles = set()
all_articles = []
for query in broad_queries:
    for article in fetch_rss(query):
        key = article['title'].lower()
        if key not in seen_titles:
            seen_titles.add(key)
            all_articles.append(article)

grouped_all = group_articles(all_articles)
print(f'Broad scan: {len(all_articles)} articles, {len(grouped_all)} grouped topics')

cutoff = datetime.now(timezone.utc) - timedelta(hours=25)
notif_titles = set()
notif_articles = []
for query in notification_queries:
    for article in fetch_rss(query, cutoff=cutoff):
        key = article['title'].lower()
        if key not in notif_titles:
            notif_titles.add(key)
            notif_articles.append(article)

grouped_notif = group_articles(notif_articles)
new_articles = [a for a in grouped_notif if a['id'] not in notified_ids]
display_articles = (new_articles[:10] or grouped_notif[:10] or grouped_all[:12])
print(f'Notification: {len(notif_articles)} articles, {len(grouped_notif)} topics, {len(new_articles)} new')
print(f'App feed topics: {len(display_articles)}')

summaries = {}
for index, article in enumerate(display_articles[:12]):
    text = fetch_article_text(article.get('link', ''))
    summary = ai_summary(article['title'], text, article.get('mentions', 1)) if text else ''
    if summary:
        summaries[article['id']] = summary
    if index < len(display_articles[:12]) - 1:
        time.sleep(1)

latest = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'articles': [
        {
            'id': article['id'],
            'title': article['title'],
            'source': article.get('source', 'UAP News'),
            'link': article.get('link', ''),
            'date': article.get('date', TODAY),
            'summary': summaries.get(article['id'], ''),
            'mentions': article.get('mentions', 1),
            'otherSources': article.get('otherSources', []),
            'clusterTitles': article.get('clusterTitles', []),
            'quality': article.get('quality', 0),
            'qualityExplanation': article.get('qualityExplanation', 'Bewertet nach UAP-Relevanz, offiziellen Begriffen/Institutionen, Quellenanzahl und Themenbündelung.'),
            'matchedTerms': article.get('matchedTerms', []),
        }
        for article in display_articles[:12]
    ],
    'summaries': summaries,
    'scanMeta': {
        'broadArticles': len(all_articles),
        'broadTopics': len(grouped_all),
        'notificationArticles': len(notif_articles),
        'notificationTopics': len(grouped_notif),
        'appTopics': len(display_articles),
        'filters': 'UAP relevance plus entertainment/gaming/fiction exclusion',
        'quality': 'UAP relevance, official terms/institutions, independent source count, topic clustering',
    },
}

with open('latest-news.json', 'w', encoding='utf-8') as f:
    json.dump(latest, f, ensure_ascii=False, indent=2)
print(f'latest-news.json: {len(display_articles[:12])} app topics, {len(summaries)} summary keys')

if new_articles:
    new_ids = list(notified_ids | {a['id'] for a in new_articles})[-500:]
    with open(SEEN_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_ids, f)
    print(f'Saved seen IDs: {len(new_ids)}')

if not new_articles:
    print('No new topics - app feed still updated, notification skipped.')
    raise SystemExit(0)

if not NTFY_TOPIC:
    print('No NTFY_TOPIC - notification skipped.')
    raise SystemExit(0)

count = min(len(new_articles), 10)
payload = json.dumps({
    'topic': NTFY_TOPIC,
    'title': f'UAP NEWS - {count} neue Meldung{"en" if count > 1 else ""}',
    'message': new_articles[0]['title'] + (f'\n+ {count - 1} weitere Themen' if count > 1 else ''),
    'priority': 3,
    'tags': ['flying_saucer'],
    'click': 'https://cpg23.github.io/UAP/?notif=1',
}).encode('utf-8')
try:
    req = urllib.request.Request('https://ntfy.sh', data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'UAP-News-Bot/1.0'}, method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        print(f'Notification sent (HTTP {r.status})')
except Exception as exc:
    print(f'ntfy error, scan remains successful: {exc}')
