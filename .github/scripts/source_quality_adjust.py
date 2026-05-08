import json
import re
from pathlib import Path

LATEST_FILE = Path('latest-news.json')
LOW_TRUST_SOURCE_RE = re.compile(
    r'\b(bollywoodshaadis|latestly|daily mail|tmz|the sun|mirror|express|radaronline|marca|meaww|unilad|ladbible)\b',
    re.I,
)
PENALTY_LABEL = 'Quellenrisiko'
PENALTY_POINTS = -8


def has_penalty(parts):
    return any((p.get('label') or '') == PENALTY_LABEL for p in parts if isinstance(p, dict))


def source_names(article):
    names = [article.get('source') or '']
    names.extend(s.get('source', '') for s in article.get('otherSources', []) if isinstance(s, dict))
    return [n for n in names if n]


def should_penalize(article):
    names = source_names(article)
    if not names:
        return False
    # If the same topic is also covered by a stronger independent source, do not penalize the whole cluster.
    if len(names) > 1:
        return False
    return bool(LOW_TRUST_SOURCE_RE.search(' '.join(names)))


def main():
    data = json.loads(LATEST_FILE.read_text(encoding='utf-8'))
    changed = False
    for article in data.get('articles', []):
        parts = article.setdefault('qualityBreakdown', [])
        parts = [p for p in parts if isinstance(p, dict) and (p.get('label') or '') != PENALTY_LABEL]
        if should_penalize(article):
            parts.append({
                'label': PENALTY_LABEL,
                'points': PENALTY_POINTS,
                'text': 'Abzug, weil die einzige Quelle in diesem Themencluster eher Boulevard, Clickbait oder Unterhaltung ist.',
            })
        article['qualityBreakdown'] = parts
        score = sum(int(p.get('points') or 0) for p in parts)
        article['quality'] = max(20, min(100, score))
        article['qualityExplanation'] = 'Die Punkte zeigen UAP-Bezug, starke Begriffe, offizielle Stellen, Quellenvertrauen, mehrere Quellen und bei schwachen Einzelquellen einen vorsichtigen Abzug.'
        changed = True
    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print('source quality adjustment complete')


if __name__ == '__main__':
    main()
