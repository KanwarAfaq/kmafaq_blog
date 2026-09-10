from __future__ import annotations

import logging
from typing import Any

import requests

from .config import Settings
from .models import ResearchContext, TopicSelection, TrendItem

LOGGER = logging.getLogger(__name__)
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"


def _trend_text(selection: TopicSelection) -> str:
    if not selection.trend:
        return ""
    trend = selection.trend
    lines = [
        f"Trend query: {trend.query}",
        f"Market: {trend.geo}",
        f"Approx traffic: {trend.traffic or 'unknown'}",
    ]
    for idx, title in enumerate(trend.news_titles[:5], 1):
        snippet = trend.news_snippets[idx - 1] if idx - 1 < len(trend.news_snippets) else ""
        url = trend.news_urls[idx - 1] if idx - 1 < len(trend.news_urls) else ""
        lines.append(f"{idx}. {title}\n   {snippet}\n   {url}")
    return "\n".join(lines)


def _tavily(settings: Settings, query: str) -> ResearchContext | None:
    if not settings.tavily_api_key:
        return None
    response = requests.post(
        TAVILY_SEARCH_URL,
        headers={
            "Authorization": f"Bearer {settings.tavily_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "search_depth": "basic",
            "topic": "general",
            "time_range": "month",
            "max_results": settings.research_max_results,
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
        },
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    results = response.json().get("results") or []
    if not results:
        return None
    lines: list[str] = []
    urls: list[str] = []
    for idx, row in enumerate(results[: settings.research_max_results], 1):
        title = str(row.get("title") or "").strip()
        content = str(row.get("content") or "").strip()
        url = str(row.get("url") or "").strip()
        if url:
            urls.append(url)
        lines.append(f"{idx}. {title}\n{content}\nSource: {url}")
    return ResearchContext(provider="tavily", text="\n\n".join(lines), urls=urls)


def _brave(settings: Settings, query: str) -> ResearchContext | None:
    if not settings.brave_search_api_key:
        return None
    response = requests.get(
        BRAVE_SEARCH_URL,
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": settings.brave_search_api_key,
        },
        params={
            "q": query,
            "count": settings.research_max_results,
            "country": "PK",
            "search_lang": "en",
            "safesearch": "strict",
            "freshness": "pm",
            "extra_snippets": "true",
        },
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    results = ((response.json().get("web") or {}).get("results") or [])
    if not results:
        return None
    lines: list[str] = []
    urls: list[str] = []
    for idx, row in enumerate(results[: settings.research_max_results], 1):
        title = str(row.get("title") or "").strip()
        description = str(row.get("description") or "").strip()
        snippets = row.get("extra_snippets") or []
        url = str(row.get("url") or "").strip()
        if url:
            urls.append(url)
        extra = " ".join(str(x) for x in snippets[:2])
        lines.append(f"{idx}. {title}\n{description} {extra}\nSource: {url}")
    return ResearchContext(provider="brave", text="\n\n".join(lines), urls=urls)


def research_topic(settings: Settings, selection: TopicSelection) -> ResearchContext:
    """Use Google Trends context, enrich with Tavily, and fall back to Brave."""
    trend_context = _trend_text(selection)
    query = f"{selection.topic} {selection.angle}".strip()

    for provider_name, func in (("tavily", _tavily), ("brave", _brave)):
        try:
            result = func(settings, query)
            if result:
                combined = trend_context
                if combined:
                    combined += "\n\nAdditional current web research:\n"
                combined += result.text
                return ResearchContext(
                    provider=f"google_trends+{provider_name}" if trend_context else provider_name,
                    text=combined,
                    urls=result.urls,
                )
        except Exception as exc:
            LOGGER.warning("%s research failed; trying fallback: %s", provider_name, exc)

    return ResearchContext(
        provider="google_trends",
        text=trend_context or "No additional web research was available.",
        urls=list(selection.trend.news_urls[:5]) if selection.trend else [],
    )


def discover_search_candidates(settings: Settings) -> list[TrendItem]:
    """Fallback topic discovery when Google Trends returns no usable candidates."""
    query = (
        "latest breaking news Pakistan world politics economy business sports cricket football "
        "technology AI cybersecurity war conflict science space climate health"
    )

    try:
        result = _tavily(settings, query)
        if result:
            rows: list[TrendItem] = []
            for block, url in zip(result.text.split("\n\n"), result.urls):
                first = block.splitlines()[0]
                title = first.split(". ", 1)[-1].strip()
                if title:
                    rows.append(TrendItem(query=title, geo="SEARCH", source_url=url, provider="tavily"))
            if rows:
                LOGGER.info("Tavily fallback discovery: %d candidates", len(rows))
                return rows
    except Exception as exc:
        LOGGER.warning("Tavily fallback discovery failed: %s", exc)

    try:
        result = _brave(settings, query)
        if result:
            rows = []
            for block, url in zip(result.text.split("\n\n"), result.urls):
                first = block.splitlines()[0]
                title = first.split(". ", 1)[-1].strip()
                if title:
                    rows.append(TrendItem(query=title, geo="SEARCH", source_url=url, provider="brave"))
            if rows:
                LOGGER.info("Brave fallback discovery: %d candidates", len(rows))
                return rows
    except Exception as exc:
        LOGGER.warning("Brave fallback discovery failed: %s", exc)

    return []
