import json
import re
from pathlib import Path

LATEST_FILE = Path('latest-news.json')
BAD_SUMMARY_RE = re.compile(
    r'full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a |publisher text could not be safely extracted|the headline states|the headline is treated|the article falls under|available feed metadata|listed headline|matched uap terms|for deeper context|source claim|the scanner connects|uap news does not add details',
    re.I,
)


def is_bad(text):
    return not text or len(text) < 180 or bool(BAD_SUMMARY_RE.search(text))


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
            article['summary'] = ''
            summaries.pop(aid, None)
            article.setdefault('summaryStatus', {})['articleContentSummary'] = 'missing'
            changed = True
        elif summaries.get(aid) != article_summary:
            summaries[aid] = article_summary
            changed = True
    # Do not keep stale summary entries for articles no longer in the retained feed.
    active_ids = {a.get('id') for a in data.get('articles', []) if a.get('id')}
    for key in list(summaries.keys()):
        if key not in active_ids or is_bad(summaries.get(key)):
            del summaries[key]
            changed = True
    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'summary sync complete: {len(data.get("articles", []))} articles')


if __name__ == '__main__':
    main()
