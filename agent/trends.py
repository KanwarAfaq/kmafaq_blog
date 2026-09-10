from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from .config import Settings
from .models import TrendItem

LOGGER = logging.getLogger(__name__)
TRENDS_RSS = "https://trends.google.com/trending/rss?geo={geo}"


def _text_by_suffix(parent: ET.Element, suffix: str) -> str:
    for child in parent.iter():
        if child.tag.endswith(suffix) and child.text:
            return child.text.strip()
    return ""


def _all_news(item: ET.Element) -> tuple[list[str], list[str], list[str]]:
    titles: list[str] = []
    snippets: list[str] = []
    urls: list[str] = []
    for node in item.iter():
        if not node.tag.endswith("news_item"):
            continue
        title = _text_by_suffix(node, "news_item_title")
        snippet = _text_by_suffix(node, "news_item_snippet")
        url = _text_by_suffix(node, "news_item_url")
        if title:
            titles.append(title)
        if snippet:
            snippets.append(snippet)
        if url:
            urls.append(url)
    return titles[:5], snippets[:5], urls[:5]


def fetch_geo_trends(geo: str, timeout: int) -> list[TrendItem]:
    url = TRENDS_RSS.format(geo=geo.upper())
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "KM-Afaq-Agent/0.2 (+https://kmafaq.online)"},
    )
    response.raise_for_status()
    root = ET.fromstring(response.content)
    rows: list[TrendItem] = []
    for item in root.findall("./channel/item"):
        query = (item.findtext("title") or "").strip()
        if not query:
            continue
        titles, snippets, urls = _all_news(item)
        rows.append(
            TrendItem(
                query=query,
                geo=geo.upper(),
                traffic=_text_by_suffix(item, "approx_traffic"),
                pub_date=(item.findtext("pubDate") or "").strip(),
                source_url=((item.findtext("link") or "").strip() or (urls[0] if urls else "")),
                news_titles=titles,
                news_snippets=snippets,
                news_urls=urls,
                provider="google_trends",
            )
        )
    return rows


def collect_trends(settings: Settings) -> list[TrendItem]:
    """Google Trends first; search APIs are used only if Trends yields nothing."""
    collected: list[TrendItem] = []
    with ThreadPoolExecutor(max_workers=min(5, len(settings.trend_geos))) as executor:
        future_map = {
            executor.submit(fetch_geo_trends, geo, settings.request_timeout): geo
            for geo in settings.trend_geos
        }
        for future in as_completed(future_map):
            geo = future_map[future]
            try:
                rows = future.result()
                LOGGER.info("Google Trends %s: %d items", geo, len(rows))
                collected.extend(rows)
            except Exception as exc:
                LOGGER.warning("Google Trends %s failed: %s", geo, exc)

    seen: set[str] = set()
    unique: list[TrendItem] = []
    keywords = tuple(k.casefold() for k in settings.trend_keywords)

    def relevance(row: TrendItem) -> int:
        haystack = " ".join([row.query, *row.news_titles, *row.news_snippets]).casefold()
        return sum(1 for keyword in keywords if keyword in haystack)

    for row in sorted(collected, key=relevance, reverse=True):
        key = row.query.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= settings.max_trends:
            break

    if unique:
        return unique

    from .research import discover_search_candidates

    LOGGER.warning("Google Trends returned no candidates; using Tavily/Brave discovery fallback")
    return discover_search_candidates(settings)
