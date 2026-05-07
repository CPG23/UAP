import json, re, urllib.request, urllib.parse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

POS = re.compile(r'\b(uap|ufo|ufos|uaps|aaro|pentagon|nasa|congress|senate|disclosure|whistleblower|unidentified anomalous|unidentified aerial|sighting|sightings)\b', re.I)
NEG = re.compile(r'\b(movie|film|trailer|episode|season|netflix|review|game|gaming|fortnite|roblox|anime|manga|lyrics|sports|ufc|nfl|nba|astrology|horoscope)\b', re.I)
TERMS = ['uap','ufo','aaro','pentagon','nasa','congress','senate','disclosure','whistleblower','sighting']
STOP = set('a an the to of for in on at by with from and or is are was were be been has have had new latest report reports news says said uap ufo ufos uaps'.split())

def words(text):
    return [w for w in re.sub(r'[^a-z0-9]', ' ', (text or '').lower()).split() if len(w) > 2 and w not in STOP]

def topic_id(title):
    return '-'.join(sorted(set(words(title)))[:8]) or 'untitled'

def clean(text):
    text = re.sub(r'<!\[CDATA\[|\]\]>', '', text or '')
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def clean_title(title):
    title = clean(title)
    title = re.sub(r'\s+[-–]\s+[^-–]{2,80}$', '', title).strip()
    return title

def score(item):
    hay = ' '.join([item.get('title',''), item.get('description',''), item.get('source','')])
    if not POS.search(hay): return 0
    if NEG.search(hay) and not re.search(r'pentagon|aaro|nasa|congress|senate|disclosure|whistleblower', hay, re.I): return 0
    s = 20
    for term in TERMS:
        if re.search(r'\b' + re.escape(term) + r'\b', hay, re.I): s += 10
    if item.get('link'): s += 5
    return min(100, s)

def matched(text):
    out = []
    low = (text or '').lower()
    for term in TERMS:
        if term in low: out.append(term.upper())
    return out[:5]

def fetch_rss(query):
    rss = 'https://news.google.com/rss/search?q=' + urllib.parse.quote(query) + '&hl=en-US&gl=US&ceid=US:en'
    req = urllib.request.Request(rss, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        xml = r.read().decode('utf-8', errors='replace')
    root = ET.fromstring(xml)
    out = []
    for item in root.findall('.//item'):
        title = clean_title(item.findtext('title') or '')
        if not title: continue
        source = clean(item.findtext('source') or 'Google News')
        link = clean(item.findtext('link') or '')
        desc = clean(item.findtext('description') or '')
        date = item.findtext('pubDate') or ''
        try:
            date_out = parsedate_to_datetime(date).date().isoformat() if date else datetime.now(timezone.utc).date().isoformat()
        except Exception:
            date_out = datetime.now(timezone.utc).date().isoformat()
        art = {'title':title,'source':source,'link':link,'description':desc,'date':date_out}
        art['quality'] = score(art)
        if art['quality'] >= 25: out.append(art)
    return out

def similar(a,b):
    aw, bw = set(words(a.get('title','') + ' ' + a.get('description',''))), set(words(b.get('title','') + ' ' + b.get('description','')))
    if not aw or not bw: return 0
    return len(aw & bw) / min(len(aw), len(bw))

def group(items):
    groups=[]
    for it in sorted(items, key=lambda x:x.get('quality',0), reverse=True):
        best=None; bs=0
        for g in groups:
            s=similar(it,g['primary'])
            if s>bs: best=g; bs=s
        if best and bs>=0.34:
            best['others'].append(it)
        else:
            groups.append({'primary':it,'others':[]})
    articles=[]
    for g in groups:
        p=dict(g['primary'])
        seen={p.get('source')}
        others=[]
        for o in g['others']:
            if o.get('source') in seen: continue
            seen.add(o.get('source'))
            others.append({'source':o.get('source') or 'UAP News','link':o.get('link',''),'title':o.get('title','')})
        p['id']=topic_id(p['title'])
        p['mentions']=1+len(others)
        p['otherSources']=others
        p['matchedTerms']=matched(p['title']+' '+p.get('description',''))
        summary = p.get('description','')
        if summary == p['title'] or len(summary) < 80: summary = ''
        p['summary']=summary[:520]
        articles.append(p)
    return articles[:12]

queries = [
 'UAP OR UFO when:30d',
 'AARO Pentagon UAP OR UFO when:60d',
 'UFO disclosure congress senate when:60d',
 'unidentified anomalous phenomena NASA when:90d',
 'UFO sighting military pilot when:60d'
]
all_items=[]
for q in queries:
    try:
        got=fetch_rss(q)
        print(q, len(got))
        all_items.extend(got)
    except Exception as e:
        print('ERR', q, e)

seen=set(); unique=[]
for item in all_items:
    k=item['title'].lower()
    if k in seen: continue
    seen.add(k); unique.append(item)
arts=group(unique)
print('topics', len(arts))

data={
 'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
 'articles': [
   {k:a.get(k) for k in ['id','title','source','link','date','summary','mentions','otherSources','quality','matchedTerms']}
   for a in arts
 ],
 'summaries': {a['id']: a.get('summary','') for a in arts if a.get('summary')},
 'scanMeta': {'broadArticles':len(unique),'broadTopics':len(arts),'source':'fast GitHub refresh'}
}
with open('latest-news.json','w',encoding='utf-8') as f:
    json.dump(data,f,ensure_ascii=False,indent=2)
if not arts:
    raise SystemExit('No topics found')
