#!/usr/bin/env python3
"""Precompute stable article translations for the UAP app.

The mobile app should not depend on slow or blocked browser-side translation
requests. This script runs in GitHub Actions, translates title and compact
summary once, and stores the prepared text in latest-news.json.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

LATEST_FILE = Path("latest-news.json")
REQUEST_TIMEOUT = 14
USER_AGENT = "UAP-News-Translation/1.0 (+https://github.com/CPG23/UAP)"

GERMAN_MARKERS = re.compile(
    r"[äöüß]|\b(der|die|das|den|dem|des|und|oder|nicht|eine|einer|einen|mit|von|für|über|heute|wird|wurden|nachrichten|quelle|artikel)\b",
    re.IGNORECASE,
)
SENTENCE_RE = re.compile(r"[^.!?]+[.!?]+(?:\s|$)")
WEAK_ENDINGS = {
    "auf", "in", "im", "am", "an", "mit", "von", "für", "über", "und", "oder", "the", "a", "an", "of", "to", "for", "with", "on", "in",
}

TRANSLATION_CACHE: Dict[Tuple[str, str, str], str] = {}


def compact(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def display_summary(text: object) -> str:
    """Keep the app summary compact: important points, not the full article."""
    clean = compact(text)
    if len(clean) <= 380:
        return clean

    sentences = SENTENCE_RE.findall(clean)
    if sentences:
        candidate = compact("".join(sentences[:3]))
        if len(candidate) > 560 and len(sentences) >= 2:
            candidate = compact("".join(sentences[:2]))
        if candidate:
            return candidate

    return clean[:420].replace("\n", " ").rsplit(" ", 1)[0].rstrip(" ,:;") + "."


def source_hash(title: str, summary: str) -> str:
    return hashlib.sha1(f"{title}\n{summary}".encode("utf-8")).hexdigest()


def looks_german(text: str) -> bool:
    return bool(GERMAN_MARKERS.search(text or ""))


def plausible_translation(source: str, translated: str) -> bool:
    source = compact(source)
    translated = compact(translated)
    if not translated:
        return False
    if len(source) > 180 and len(translated) < len(source) * 0.5:
        return False
    last_word = re.sub(r"[^\wäöüß]+", "", translated.split()[-1].lower()) if translated.split() else ""
    if len(source) > 80 and last_word in WEAK_ENDINGS and translated[-1:] not in ".!?…)]}\"”’":
        return False
    return True


def chunks(text: str, max_len: int = 1250) -> Iterable[str]:
    text = compact(text)
    if len(text) <= max_len:
        yield text
        return

    start = 0
    while start < len(text):
        end = min(len(text), start + max_len)
        if end < len(text):
            split_at = max(text.rfind(". ", start, end), text.rfind("; ", start, end), text.rfind(", ", start, end), text.rfind(" ", start, end))
            if split_at > start + 250:
                end = split_at + 1
        yield text[start:end].strip()
        start = end


def request_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return response.read().decode("utf-8", errors="replace")


def translate_google(text: str, target: str, source: str) -> str:
    translated: List[str] = []
    for part in chunks(text, 1200):
        params = urllib.parse.urlencode(
            {
                "client": "gtx",
                "sl": source,
                "tl": target,
                "dt": "t",
                "q": part,
            }
        )
        raw = request_text(f"https://translate.googleapis.com/translate_a/single?{params}")
        data = json.loads(raw)
        translated.append("".join(segment[0] for segment in data[0] if segment and segment[0]))
    return compact(" ".join(translated))


def translate_mymemory(text: str, target: str, source: str) -> str:
    translated: List[str] = []
    langpair = f"{source}|{target}"
    for part in chunks(text, 450):
        params = urllib.parse.urlencode({"q": part, "langpair": langpair})
        raw = request_text(f"https://api.mymemory.translated.net/get?{params}")
        data = json.loads(raw)
        translated_text = data.get("responseData", {}).get("translatedText", "")
        translated.append(html.unescape(translated_text))
    return compact(" ".join(translated))


def translate_pollinations(text: str, target: str) -> str:
    target_name = "English" if target == "en" else "German"
    prompt = (
        f"Translate the following compact news title or summary into {target_name}. "
        "Preserve names, dates, quotes and numbers exactly. Return only the translation, no commentary.\n\n"
        f"{text}"
    )
    url = f"https://text.pollinations.ai/{urllib.parse.quote(prompt)}?model=openai&json=false"
    translated = request_text(url)
    return compact(translated.strip('"'))


def translate_text(text: str, target: str, source: str) -> Tuple[str, str]:
    text = compact(text)
    if not text:
        return "", "empty"

    key = (source, target, text)
    if key in TRANSLATION_CACHE:
        return TRANSLATION_CACHE[key], "cache"

    providers = (
        ("google", translate_google),
        ("mymemory", translate_mymemory),
    )

    last_error: Optional[Exception] = None
    for provider, func in providers:
        try:
            translated = compact(func(text, target, source))
            if translated and plausible_translation(text, translated):
                TRANSLATION_CACHE[key] = translated
                return translated, provider
            last_error = RuntimeError(f"implausible {provider} translation")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
            last_error = exc
            time.sleep(0.3)

    try:
        translated = compact(translate_pollinations(text, target))
        if translated and plausible_translation(text, translated):
            TRANSLATION_CACHE[key] = translated
            return translated, "pollinations"
        last_error = RuntimeError("implausible pollinations translation")
    except (urllib.error.URLError, TimeoutError) as exc:
        last_error = exc

    raise RuntimeError(f"translation failed for {target}: {last_error}")


def existing_is_current(entry: dict, current_hash: str, title_source: str, summary_source: str, translated: bool) -> bool:
    if not (
        isinstance(entry, dict)
        and entry.get("sourceHash") == current_hash
        and bool(compact(entry.get("title")))
        and bool(compact(entry.get("summary")))
    ):
        return False
    if translated:
        return plausible_translation(title_source, entry.get("title", "")) and plausible_translation(summary_source, entry.get("summary", ""))
    return True


def translation_block(title: str, summary: str, current_hash: str) -> dict:
    source_is_de = looks_german(f"{title} {summary}")
    source_lang = "de" if source_is_de else "en"
    target_lang = "en" if source_is_de else "de"

    original = {
        "title": title,
        "summary": summary,
        "sourceHash": current_hash,
        "provider": "original",
    }

    translated_title, title_provider = translate_text(title, target_lang, source_lang)
    translated_summary, summary_provider = translate_text(summary, target_lang, source_lang)
    translated = {
        "title": translated_title,
        "summary": translated_summary,
        "sourceHash": current_hash,
        "provider": title_provider if title_provider == summary_provider else f"{title_provider}/{summary_provider}",
    }

    return {source_lang: original, target_lang: translated}


def main() -> None:
    if not LATEST_FILE.exists():
        raise SystemExit("latest-news.json not found")

    data = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
    articles = data.get("articles") or []
    top_level_translations = data.get("translations") if isinstance(data.get("translations"), dict) else {}

    changed = False
    prepared = 0
    failed = 0
    translations: Dict[str, dict] = {}

    for article in articles:
        if not isinstance(article, dict):
            continue

        article_id = compact(article.get("id"))
        title = compact(article.get("title"))
        summary = display_summary(article.get("summary"))
        if not article_id or not title or not summary:
            continue

        if compact(article.get("summary")) != summary:
            article["summary"] = summary
            changed = True

        current_hash = source_hash(title, summary)
        existing = article.get("translation") if isinstance(article.get("translation"), dict) else {}
        if not existing and isinstance(top_level_translations.get(article_id), dict):
            existing = top_level_translations[article_id]

        current_lang = "de" if looks_german(f"{title} {summary}") else "en"
        target_lang = "en" if current_lang == "de" else "de"

        source_current = existing_is_current(existing.get(current_lang, {}), current_hash, title, summary, translated=False)
        target_current = existing_is_current(existing.get(target_lang, {}), current_hash, title, summary, translated=True)
        if source_current and target_current:
            block = existing
        else:
            try:
                block = translation_block(title, summary, current_hash)
                changed = True
            except RuntimeError as exc:
                print(f"warning: {article_id}: {exc}")
                failed += 1
                block = existing

        if block:
            article["translation"] = block
            translations[article_id] = block
            prepared += 1

    if translations != top_level_translations:
        data["translations"] = translations
        changed = True

    data["translationMeta"] = {
        "prepared": prepared,
        "failed": failed,
        "summary": "compact app summary only",
        "target": "de for English articles, en for German articles",
        "source": "github-actions-precompute",
    }

    if changed:
        LATEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"prepared compact translations for {prepared} articles; failed={failed}; changed={changed}")


if __name__ == "__main__":
    main()
