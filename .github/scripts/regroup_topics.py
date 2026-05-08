#!/usr/bin/env python3
"""Regroup closely related UAP news topics after the scan.

The RSS scan can find the same story through different headlines. This pass
merges topics that clearly refer to the same official UFO/UAP file-release story
and keeps all sources on one card.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

LATEST_FILE = Path("latest-news.json")

STOP = set(
    "a an the to of for in on at by with from and or is are was were be been has have had will would could should may might new latest update report reports news says said about into after before over under this that these those uap ufo ufos uaps unidentified anomalous phenomena".split()
)
KEY_TERMS = set(
    "trump white house pentagon department war dod aaro nasa fbi odni dni congress senate luna patel hegseth files file records documents archive archives photos images videos release releases released releasing declassify declassified classified disclosure transparency unseal unsealing public batch tranche drop".split()
)

UAP_RE = re.compile(r"\b(uap|ufo|ufos|unidentified anomalous|unidentified aerial)\b", re.I)
FILE_RE = re.compile(r"\b(file|files|record|records|document|documents|archive|archives|photo|photos|image|images|video|videos|footage)\b", re.I)
RELEASE_RE = re.compile(r"\b(release|releases|released|releasing|declassif|unseal|publish|public|transparency|drop|batch|tranche|available)\b", re.I)
OFFICIAL_RE = re.compile(r"\b(pentagon|department of war|dod|white house|trump|fbi|odni|dni|nasa|aaro|congress|luna|patel|hegseth|government|federal)\b", re.I)


def clean(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def words(text: str) -> List[str]:
    return [w for w in re.sub(r"[^a-z0-9]", " ", text.lower()).split() if len(w) > 2 and w not in STOP]


def text_blob(article: dict) -> str:
    parts = [article.get("title", ""), article.get("summary", ""), article.get("source", "")]
    parts.extend(article.get("clusterTitles") or [])
    for source in article.get("otherSources") or []:
        if isinstance(source, dict):
            parts.append(source.get("title", ""))
            parts.append(source.get("source", ""))
    return clean(" ".join(parts))


def topic_theme(article: dict) -> str:
    blob = text_blob(article)
    if UAP_RE.search(blob) and FILE_RE.search(blob) and RELEASE_RE.search(blob) and OFFICIAL_RE.search(blob):
        return "official-uap-file-release"
    return ""


def similarity(a: dict, b: dict) -> float:
    aw = set(words(text_blob(a)))
    bw = set(words(text_blob(b)))
    if not aw or not bw:
        return 0.0
    overlap = len(aw & bw) / min(len(aw), len(bw))
    key_bonus = len((aw & bw) & KEY_TERMS) * 0.07
    return min(1.0, overlap + key_bonus)


def same_topic(a: dict, b: dict) -> bool:
    theme_a = topic_theme(a)
    theme_b = topic_theme(b)
    if theme_a and theme_a == theme_b:
        return True
    return similarity(a, b) >= 0.42


def all_sources(article: dict) -> List[dict]:
    sources: List[dict] = []
    if article.get("link"):
        sources.append({"source": article.get("source") or "Quelle", "link": article.get("link", ""), "title": article.get("title", "")})
    for source in article.get("otherSources") or []:
        if isinstance(source, dict) and (source.get("link") or source.get("title")):
            sources.append({"source": source.get("source") or "Quelle", "link": source.get("link", ""), "title": source.get("title", "")})
    return sources


def unique_sources(items: Iterable[dict]) -> List[dict]:
    out: List[dict] = []
    seen_names = set()
    seen_links = set()
    for article in items:
        for source in all_sources(article):
            name_key = clean(source.get("source", "")).lower()
            link_key = clean(source.get("link", "")).lower()
            if link_key and link_key in seen_links:
                continue
            if name_key and name_key in seen_names:
                continue
            if link_key:
                seen_links.add(link_key)
            if name_key:
                seen_names.add(name_key)
            out.append(source)
    return out


def article_score(article: dict) -> Tuple[int, int, int]:
    source_count = 1 + len(article.get("otherSources") or [])
    return (int(article.get("quality") or 0), source_count, len(clean(article.get("summary"))))


def normalize_id(title: str) -> str:
    tokens = sorted(set(words(title)))[:10]
    return "-".join(tokens) or "untitled"


def merge_quality(primary: dict, source_count: int) -> None:
    rows = [dict(row) for row in primary.get("qualityBreakdown") or [] if not re.search(r"mehrere\s+quellen", row.get("label", ""), re.I)]
    source_bonus = min(28, max(0, source_count - 1) * 7)
    rows.append({
        "label": "Mehrere Quellen",
        "points": source_bonus,
        "text": f"{source_count} Quelle(n) im aktuellen Feed." if source_count > 1 else "Nur eine Quelle im aktuellen Feed, daher kein Quellenbonus.",
    })
    primary["qualityBreakdown"] = rows
    primary["quality"] = min(100, max(35, sum(int(row.get("points") or 0) for row in rows)))


def merge_group(items: List[dict]) -> dict:
    primary = dict(sorted(items, key=article_score, reverse=True)[0])
    sources = unique_sources([primary] + [item for item in items if item is not primary])
    primary_link = clean(primary.get("link", "")).lower()
    primary_source = clean(primary.get("source", "")).lower()

    other_sources = []
    for source in sources:
        if clean(source.get("link", "")).lower() == primary_link:
            continue
        if not primary_link and clean(source.get("source", "")).lower() == primary_source:
            continue
        other_sources.append(source)

    titles = []
    seen_titles = {clean(primary.get("title", "")).lower()}
    for item in items:
        for title in [item.get("title", "")] + list(item.get("clusterTitles") or []):
            title_key = clean(title).lower()
            if title_key and title_key not in seen_titles:
                seen_titles.add(title_key)
                titles.append(clean(title))

    dates = [clean(item.get("date")) for item in items if clean(item.get("date"))]
    primary["date"] = max(dates) if dates else primary.get("date")
    primary["mentions"] = len(sources)
    primary["otherSources"] = other_sources
    primary["clusterTitles"] = titles[:40]
    primary["id"] = normalize_id(primary.get("title", ""))
    primary.pop("translation", None)
    merge_quality(primary, len(sources))
    return primary


def regroup(articles: List[dict]) -> List[dict]:
    groups: List[List[dict]] = []
    for article in sorted(articles, key=article_score, reverse=True):
        target = None
        for group in groups:
            if any(same_topic(article, existing) for existing in group):
                target = group
                break
        if target is None:
            groups.append([article])
        else:
            target.append(article)

    merged = [merge_group(group) if len(group) > 1 else dict(group[0]) for group in groups]
    return sorted(merged, key=lambda a: (int(a.get("quality") or 0), int(a.get("mentions") or 1), clean(a.get("date"))), reverse=True)


def remap_notification(data: dict, old_to_new: Dict[str, str], articles_by_id: Dict[str, dict]) -> None:
    batch = data.get("notificationBatch")
    if not isinstance(batch, dict):
        return
    ids = []
    for old_id in batch.get("ids") or []:
        new_id = old_to_new.get(old_id, old_id)
        if new_id not in ids:
            ids.append(new_id)
    batch["ids"] = ids
    batch["articles"] = [
        {"id": aid, "title": articles_by_id.get(aid, {}).get("title", aid), "source": articles_by_id.get(aid, {}).get("source", "UAP News")}
        for aid in ids
    ]


def main() -> None:
    if not LATEST_FILE.exists():
        raise SystemExit("latest-news.json not found")

    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    articles = data.get("articles") if isinstance(data.get("articles"), list) else []
    if not articles:
        print("No articles to regroup")
        return

    old_ids = [article.get("id") for article in articles]
    merged = regroup(articles)

    old_to_new: Dict[str, str] = {}
    for original in articles:
        for merged_article in merged:
            if original is merged_article:
                old_to_new[original.get("id", "")] = merged_article.get("id", "")
                break
            if same_topic(original, merged_article) or original.get("title") == merged_article.get("title"):
                old_to_new[original.get("id", "")] = merged_article.get("id", "")
                break

    data["articles"] = merged
    data["summaries"] = {article["id"]: article.get("summary", "") for article in merged if article.get("id")}
    data.pop("translations", None)
    data.pop("translationMeta", None)
    articles_by_id = {article.get("id", ""): article for article in merged}
    remap_notification(data, old_to_new, articles_by_id)
    data.setdefault("scanMeta", {})["regroupedTopics"] = len(articles) - len(merged)
    data.setdefault("scanMeta", {})["regroupedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if [article.get("id") for article in merged] != old_ids or len(merged) != len(articles):
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Regrouped {len(articles)} articles into {len(merged)} topics")
    else:
        print(f"No regrouping needed for {len(articles)} topics")


if __name__ == "__main__":
    main()
