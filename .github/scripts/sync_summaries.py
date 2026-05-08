import json
import re
from pathlib import Path

LATEST_FILE = Path('latest-news.json')
BAD_SUMMARY_RE = re.compile(
    r'full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a |publisher text could not be safely extracted',
    re.I,
)


def is_bad(text):
    return not text or len(text) < 140 or bool(BAD_SUMMARY_RE.search(text))


def clean_metadata_summary(article):
    title = article.get('title') or 'this UAP-related report'
    source = article.get('source') or 'the listed source'
    date = article.get('date') or 'the listed date'
    terms = article.get('matchedTerms') or []
    clusters = article.get('clusterTitles') or []
    sources = [source] + [s.get('source', '') for s in article.get('otherSources', []) if isinstance(s, dict)]
    sources = [s for i, s in enumerate(sources) if s and s.lower() not in [x.lower() for x in sources[:i]]]
    parts = [
        f'{source} lists a UAP-related report dated {date} under the headline "{title}".',
        'The headline is treated as the source claim, and UAP News does not add details that are not present in the available feed metadata.',
    ]
    if terms:
        parts.append('The topic is connected with ' + ', '.join(terms[:5]) + ' in the feed metadata.')
    if len(sources) > 1:
        parts.append('The same topic is also represented by ' + ', '.join(sources[1:5]) + '.')
    if clusters:
        parts.append('Related headlines in the same topic cluster mention: ' + '; '.join(clusters[:3]) + '.')
    return ' '.join(parts)


def main():
    data = json.loads(LATEST_FILE.read_text(encoding='utf-8'))
    summaries = data.setdefault('summaries', {})
    changed = False
    for article in data.get('articles', []):
        aid = article.get('id')
        if not aid:
            continue
        article_summary = article.get('summary') or ''
        map_summary = summaries.get(aid) or ''
        if is_bad(article_summary) and not is_bad(map_summary):
            article['summary'] = map_summary
            article_summary = map_summary
            changed = True
        if is_bad(article_summary):
            article_summary = clean_metadata_summary(article)
            article['summary'] = article_summary
            changed = True
        if summaries.get(aid) != article_summary:
            summaries[aid] = article_summary
            changed = True
    # Do not keep stale summary entries for articles no longer in the retained feed.
    active_ids = {a.get('id') for a in data.get('articles', []) if a.get('id')}
    for key in list(summaries.keys()):
        if key not in active_ids:
            del summaries[key]
            changed = True
    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'summary sync complete: {len(data.get("articles", []))} articles')


if __name__ == '__main__':
    main()
