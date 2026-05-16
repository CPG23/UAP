import json
import os

LATEST_FILE = 'latest-news.json'
PAYLOAD_FILE = 'ntfy-payload.json'
SEEN_FILE = '.seen-ids.json'
APP_URL = 'https://cpg23.github.io/UAP/'
TOPIC = os.environ.get('NTFY_TOPIC', 'UAP-News26').strip() or 'UAP-News26'


def load_seen():
    try:
        with open(SEEN_FILE, encoding='utf-8') as f:
            data = json.load(f)
        return [str(item) for item in data if str(item).strip()]
    except Exception:
        return []


def save_seen(ids):
    compact = []
    seen = set()
    for item in ids:
        item = str(item).strip()
        if item and item not in seen:
            compact.append(item)
            seen.add(item)
    with open(SEEN_FILE, 'w', encoding='utf-8') as f:
        json.dump(compact[-500:], f, ensure_ascii=False)


def main():
    if not os.path.exists(PAYLOAD_FILE):
        return

    with open(LATEST_FILE, encoding='utf-8') as f:
        feed = json.load(f)

    articles = feed.get('articles') or []
    by_id = {str(article.get('id') or ''): article for article in articles}
    batch_ids = [str(item) for item in ((feed.get('notificationBatch') or {}).get('ids') or [])]
    visible = [by_id[item] for item in batch_ids if item in by_id]

    if not visible:
        os.remove(PAYLOAD_FILE)
        print('Notification payload removed: no notification articles are visible in final feed.')
        return

    visible = visible[:10]
    message = '\n'.join(f'{i + 1}. {article.get("title", "UAP News")}' for i, article in enumerate(visible))
    payload = {
        'topic': TOPIC,
        'title': f'UAP News - {len(visible)} new report{"s" if len(visible) != 1 else ""}',
        'message': message,
        'priority': 3,
        'tags': ['flying_saucer'],
        'click': APP_URL,
        'actions': [{'action': 'view', 'label': 'Open app', 'url': APP_URL}],
    }

    with open(PAYLOAD_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    pushed_ids = [str(article.get('id') or '') for article in visible if article.get('id')]
    save_seen(load_seen() + pushed_ids)
    print(f'Notification payload prepared from final visible feed: {len(visible)} article(s).')
    print(f'Marked {len(pushed_ids)} visible notification article(s) as pushed.')


if __name__ == '__main__':
    main()
