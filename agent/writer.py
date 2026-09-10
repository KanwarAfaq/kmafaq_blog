from __future__ import annotations

import json
import logging

from .config import Settings
from .llm import FallbackLLM
from .models import Article, ResearchContext, TopicSelection, TrendItem
from .utils import ensure_slug

LOGGER = logging.getLogger(__name__)

TOPIC_CATEGORIES = ("ai-tech", "business", "politics", "world", "sports", "science", "health", "trending")


def infer_topic_category(text: str, suggested: str | None = None) -> str:
    haystack = text.casefold()
    rules = (
        ("sports", ("cricket", "football", "soccer", "f1", "formula 1", "tennis", "world cup", "premier league", "nba", "fifa", "match", "tournament")),
        ("politics", ("election", "politic", "government", "parliament", "president", "prime minister", "minister", "senate", "policy", "pti", "pml", "ppp")),
        ("world", ("war", "conflict", "ceasefire", "military", "missile", "ukraine", "gaza", "israel", "iran", "geopolit", "diplomacy", "nato", "united nations")),
        ("health", ("health", "medical", "hospital", "snakebite", "anti-venom", "antivenom", "vaccine", "cancer", "disease", "virus", "doctor", "medicine")),
        ("science", ("science", "space", "nasa", "climate", "earthquake", "research", "astronomy", "moon", "mars", "satellite")),
        ("business", ("business", "economy", "economic", "market", "inflation", "interest rate", "stock", "finance", "freelance", "earning", "income", "startup", "crypto", "xrp", "bitcoin")),
        ("ai-tech", (" ai ", "artificial intelligence", "chatgpt", "gemini", "groq", "automation", "agent", "technology", "tech", "software", "coding", "developer", "cyber", "iphone", "android", "chip", "intel", "nvidia", "apple", "google", "microsoft")),
    )
    padded = f" {haystack} "
    for category, keywords in rules:
        if any(keyword in padded for keyword in keywords):
            return category
    return suggested if suggested in TOPIC_CATEGORIES else "trending"

TOPIC_SYSTEM = """You are the editorial trend selector for KM Afaq, a current-affairs and practical information blog. Select only from the supplied current candidates.

Allowed categories include:
- AI, technology, software, cybersecurity and automation
- freelancing, online earning, business and the economy
- politics, elections, government and public policy
- international relations, geopolitics, wars and conflicts
- sports
- breaking news, major public events and other genuinely hot topics
- science, consumer technology and major social trends

Prefer timely topics with clear public interest, especially when relevant to Pakistan/South Asia or globally significant. Avoid clickbait, unsupported rumors, graphic sensationalism, hate, propaganda, or partisan advocacy.

CRITICAL: choose exactly ONE supplied candidate by its candidate_index. The article topic and angle must directly describe that selected candidate. Never combine one candidate's index with another candidate's story. Return valid JSON only."""

ARTICLE_SYSTEMS = {
    "ur": """You are KM Afaq's senior Urdu editor for technology, business, sports and current affairs. Write accurate, useful, original Urdu in a natural Pakistani style. English names/product/model names may stay in English. Do not fabricate statistics, quotes, prices, scores, election results, casualty figures, release dates, capabilities, or claims not supported by the supplied research. For politics, wars, conflicts and breaking news, stay neutral, distinguish confirmed facts from claims or uncertainty, and avoid partisan advocacy or graphic sensationalism. Return valid JSON only. The article body must be Markdown and must not contain raw HTML.""",
    "en": """You are KM Afaq's senior English editor for technology, business, sports and current affairs. Write accurate, useful, original English for Pakistani/South Asian and international readers. Do not fabricate statistics, quotes, prices, scores, election results, casualty figures, release dates, capabilities, or claims not supported by the supplied research. For politics, wars, conflicts and breaking news, stay neutral, distinguish confirmed facts from claims or uncertainty, and avoid partisan advocacy or graphic sensationalism. Return valid JSON only. The article body must be Markdown and must not contain raw HTML.""",
}


def _language_name(language: str) -> str:
    return "Urdu" if language == "ur" else "English"


def select_topic(llm: FallbackLLM, trends: list[TrendItem], settings: Settings, *, language: str = "ur") -> TopicSelection:
    """Select one exact trend candidate by index so source metadata can never drift."""
    if not trends:
        raise RuntimeError("No unused current candidates were available. Use --topic to test manually.")

    lines = [f"{index + 1}. {row.context_line()}" for index, row in enumerate(trends)]
    language_name = _language_name(language)
    prompt = f"""
Choose the single best current topic for a {language_name} KM Afaq article.

You may choose from:
AI/technology, cybersecurity, freelancing/online earning, business/economy,
politics/elections/public policy, geopolitics/war/conflict, sports,
breaking news/current events, science, consumer tech, or another major hot topic.

Editorial priorities:
1. It is genuinely current and supported by the supplied candidate/news context.
2. It can become a useful, factual, non-clickbait article.
3. Prefer Pakistan/South Asian relevance when reasonable, but major global stories are also valid.
4. For politics/war/breaking news, prefer topics with enough context to report responsibly.
5. The topic and angle MUST describe the SAME candidate you select.
6. Do not invent or rewrite a source query. Select by candidate_index only.

Current candidates:
{chr(10).join(lines)}

Return exactly this JSON shape:
{{
  "candidate_index": 1,
  "topic": "clear article topic directly about that candidate",
  "angle": "specific useful angle directly about that candidate",
  "reason": "why this current topic is worth covering",
  "category": "one of: ai-tech, business, politics, world, sports, science, health, trending",
  "relevance_score": 0
}}

candidate_index is 1-based and must point to one candidate above.
relevance_score must be an integer from 0 to 100.
"""
    data, provider = llm.generate_json(system=TOPIC_SYSTEM, prompt=prompt, max_output_tokens=1200)

    try:
        candidate_index = int(data.get("candidate_index"))
    except (TypeError, ValueError):
        raise RuntimeError("Topic selector returned an invalid candidate_index; refusing to publish a mismatched topic.")

    if candidate_index < 1 or candidate_index > len(trends):
        raise RuntimeError(
            f"Topic selector candidate_index {candidate_index} is outside 1..{len(trends)}; refusing to publish."
        )

    match = trends[candidate_index - 1]
    source_query = match.query.strip()
    score = max(0, min(100, int(data.get("relevance_score", 0) or 0)))
    if score < settings.min_trend_relevance:
        raise RuntimeError(
            f"No candidate met the editorial relevance threshold "
            f"({score} < {settings.min_trend_relevance}). Skipping this run is safer than publishing a weak post."
        )

    topic = str(data.get("topic") or source_query).strip()
    angle = str(data.get("angle") or f"Current {language_name} explainer").strip()
    category = infer_topic_category(
        f"{source_query} {topic} {angle}",
        str(data.get("category") or "").strip(),
    )

    return TopicSelection(
        topic=topic,
        angle=angle,
        reason=str(data.get("reason") or "Selected from current trend/search data").strip(),
        source_query=source_query,
        source_url=match.source_url,
        relevance_score=score,
        provider=provider,
        trend=match,
        source_provider=match.provider,
        topic_category=category,
    )


def manual_topic(topic: str, *, language: str = "ur") -> TopicSelection:
    return TopicSelection(
        topic=topic.strip(),
        angle=f"Practical {_language_name(language)} explainer",
        reason="Manual topic override for local testing",
        source_query=topic.strip(),
        source_url="",
        relevance_score=100,
        provider="manual",
        trend=None,
        source_provider="manual",
        topic_category=infer_topic_category(topic),
    )


def generate_article(
    llm: FallbackLLM,
    selection: TopicSelection,
    *,
    language: str = "ur",
    research: ResearchContext | None = None,
) -> Article:
    if language not in ARTICLE_SYSTEMS:
        raise ValueError("language must be 'ur' or 'en'")

    language_name = _language_name(language)
    language_rules = (
        "Write the title, excerpt, meta description and article body in natural Urdu script. English product/model names may stay in English."
        if language == "ur"
        else "Write the title, excerpt, meta description and article body in clear natural English."
    )
    research_text = research.text if research else "No additional research context available."
    research_provider = research.provider if research else "none"

    prompt = f"""
Write a roughly 1,000-word {language_name} blog article for https://kmafaq.online.

Selected topic: {selection.topic}
Editorial angle: {selection.angle}
Source query: {selection.source_query}
Source provider: {selection.source_provider}
Research provider: {research_provider}

Research context — use this as factual grounding and do not invent beyond it:
{research_text}

Requirements:
- {language_rules}
- Aim for 900-1,150 whitespace-separated words in the Markdown body.
- Start with a concise introduction, then use useful ## headings and bullet lists where natural.
- Prefer bullet lists over tables. If a table is genuinely useful, use valid GitHub-Flavored Markdown with EVERY table row on its own line; never compress multiple rows into one line.
- Explain practical implications, risks/limitations, and actionable next steps when appropriate.
- For politics, elections, wars, conflicts or breaking news: stay neutral, separate verified facts from allegations/claims, and say when details are still developing.
- For sports: use only scores/results/fixtures supported by the research context.
- For finance/economy/earning topics: no fake earnings promises and no guaranteed financial outcomes.
- Do not copy source wording or news headlines verbatim except proper names.
- End with a short conclusion.
- image_prompt must be English, concise, visual-only, 16:9 blog cover direction, no logos, no readable text in image.
- slug must be lowercase English ASCII words separated by hyphens.

Return exactly:
{{
  "title": "{language_name} SEO title",
  "slug": "english-seo-slug",
  "excerpt": "2-3 sentence {language_name} excerpt",
  "seo_description": "{language_name} meta description, ideally <= 160 characters",
  "content": "Markdown article",
  "image_prompt": "English image-generation/search prompt"
}}
"""
    system = ARTICLE_SYSTEMS[language]
    data, provider = llm.generate_json(system=system, prompt=prompt, temperature=0.55, max_output_tokens=9000)
    content = str(data.get("content", "")).strip()
    if not content:
        raise RuntimeError("The model returned an empty article body")

    if len(content.split()) < 850:
        LOGGER.warning("Draft is short (%d words); requesting one expansion pass", len(content.split()))
        repair_prompt = f"""
Expand and improve this {language_name} article to approximately 900-1,150 words without inventing facts.
Keep the same topic, title intent, SEO fields, language, and Markdown style. Return the same JSON object shape.

Current JSON:
{json.dumps(data, ensure_ascii=False)}
"""
        repaired, repair_provider = llm.generate_json(
            system=system,
            prompt=repair_prompt,
            temperature=0.45,
            max_output_tokens=9500,
        )
        repaired_content = str(repaired.get("content", "")).strip()
        if len(repaired_content.split()) > len(content.split()):
            data = repaired
            content = repaired_content
            provider = repair_provider

    slug = ensure_slug(str(data.get("slug", "")), selection.topic)
    return Article(
        title=str(data.get("title") or selection.topic).strip(),
        slug=slug,
        excerpt=str(data.get("excerpt") or "").strip(),
        content=content,
        seo_description=str(data.get("seo_description") or "").strip()[:180],
        image_prompt=str(data.get("image_prompt") or f"Technology editorial image about {selection.topic}").strip(),
        provider=provider,
        language=language,
    )
