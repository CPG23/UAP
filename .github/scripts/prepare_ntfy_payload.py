import json
import os
import urllib.parse

LATEST_FILE = 'latest-news.json'
PAYLOAD_FILE = 'ntfy-payload.json'
APP_URL = 'https://cpg23.github.io/UAP/'
TOPIC = os.environ.get('NTFY_TOPIC', 'UAP-News26').strip() or 'UAP-News26'
SEPARATOR = '------------------------------'


def article_count_label(count):
    return f'{count} neuer Artikel' if count == 1 else f'{count} neue Artikel'


def notification_message(articles):
    lines = [article_count_label(len(articles)), '']
    for index, article in enumerate(articles):
        title = str(article.get('title') or 'UAP News').strip()
        lines.append('• ' + title)
        if index < len(articles) - 1:
            lines.append(SEPARATOR)
            lines.append('')
    return '\n'.join(lines).strip()


def main():
    with open(LATEST_FILE, encoding='utf-8') as f:
        feed = json.load(f)

    articles = feed.get('articles') or []
    by_id = {str(article.get('id') or ''): article for article in articles}
    batch_ids = [str(item) for item in ((feed.get('notificationBatch') or {}).get('ids') or [])]
    visible = [by_id[item] for item in batch_ids if item in by_id]

    if not visible:
        if os.path.exists(PAYLOAD_FILE):
            os.remove(PAYLOAD_FILE)
        print('Notification payload removed: no notification articles are visible in final feed.')
        return

    visible = visible[:10]
    count_label = article_count_label(len(visible))
    payload = {
        'topic': TOPIC,
        'title': count_label,
        'message': notification_message(visible),
        'priority': 3,
        'tags': ['flying_saucer'],
        'click': APP_URL,
        'actions': [{'action': 'view', 'label': 'App öffnen', 'url': APP_URL}],
    }

    with open(PAYLOAD_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f'Notification payload prepared from final visible feed: {len(visible)} article(s).')


if __name__ == '__main__':
    main()
