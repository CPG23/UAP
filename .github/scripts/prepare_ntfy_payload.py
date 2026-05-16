import json
import os
import urllib.parse

LATEST_FILE = 'latest-news.json'
PAYLOAD_FILE = 'ntfy-payload.json'
APP_URL = 'https://cpg23.github.io/UAP/'
TOPIC = os.environ.get('NTFY_TOPIC', 'UAP-News26').strip() or 'UAP-News26'


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
    print(f'Notification payload prepared from final visible feed: {len(visible)} article(s).')


if __name__ == '__main__':
    main()
