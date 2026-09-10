from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TrendItem:
    query: str
    geo: str
    traffic: str = ""
    pub_date: str = ""
    source_url: str = ""
    news_titles: list[str] = field(default_factory=list)
    news_snippets: list[str] = field(default_factory=list)
    news_urls: list[str] = field(default_factory=list)
    provider: str = "google_trends"

    def context_line(self) -> str:
        news = "; ".join(self.news_titles[:3]) or "No linked news title"
        return (
            f"[{self.provider}:{self.geo}] {self.query} | "
            f"traffic={self.traffic or 'unknown'} | news={news}"
        )


@dataclass
class TopicSelection:
    topic: str
    angle: str
    reason: str
    source_query: str
    source_url: str
    relevance_score: int
    provider: str
    trend: TrendItem | None = None
    source_provider: str = "google_trends"
    topic_category: str = "trending"


@dataclass
class ResearchContext:
    provider: str
    text: str
    urls: list[str] = field(default_factory=list)


@dataclass
class Article:
    title: str
    slug: str
    excerpt: str
    content: str
    seo_description: str
    image_prompt: str
    provider: str
    language: str = "ur"

    @property
    def word_count(self) -> int:
        return len(self.content.split())


@dataclass
class CoverImage:
    path: Path
    provider: str
    source_url: str | None = None
    attribution: str | None = None
    license: str | None = None


@dataclass
class MediaAsset:
    secure_url: str
    public_id: str
    asset_id: str
    resource_type: str = "image"
    format: str | None = None
    width: int | None = None
    height: int | None = None


@dataclass
class PublishResult:
    post_id: str
    title: str
    slug: str
    url: str
    media: MediaAsset | None
    raw: dict[str, Any]
