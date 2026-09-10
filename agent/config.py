from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Load website settings first, then optional agent-only overrides.
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(PROJECT_ROOT / ".env.agent", override=True)
load_dotenv(PROJECT_ROOT / "agent" / ".env", override=True)


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


def _csv(name: str, default: str) -> tuple[str, ...]:
    raw = os.getenv(name, default)
    return tuple(item.strip() for item in raw.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    site_url: str = os.getenv("SITE_URL", "https://kmafaq.online").rstrip("/")
    line_public_base_url: str = os.getenv("LINE_PUBLIC_BASE_URL", "").rstrip("/")

    # Text generation: Groq -> Gemini -> OpenRouter Free by default.
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_text_model: str = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.8-flash")
    gemini_image_model: str = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openrouter/free")
    llm_primary: str = os.getenv("LLM_PRIMARY", "groq").strip().lower()

    # Trend discovery + web research.
    trend_geos: tuple[str, ...] = _csv("TREND_GEOS", "US,PK,IN,GB,CA")
    trend_keywords: tuple[str, ...] = _csv(
        "TREND_KEYWORDS",
        "AI,artificial intelligence,ChatGPT,Gemini,Groq,automation,agent,technology,tech,software,"
        "coding,developer,cybersecurity,freelance,earning,earn,online income,remote work,SEO,digital marketing,startup,"
        "business,economy,market,inflation,interest rate,politics,election,government,policy,president,prime minister,parliament,"
        "war,conflict,ceasefire,military,diplomacy,cricket,football,soccer,F1,tennis,world cup,sports,breaking news,science,space,climate,health",
    )
    max_trends: int = _int("MAX_TRENDS", 40)
    min_trend_relevance: int = _int("MIN_TREND_RELEVANCE", 45)
    request_timeout: int = _int("REQUEST_TIMEOUT_SECONDS", 20)
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    brave_search_api_key: str = os.getenv("BRAVE_SEARCH_API_KEY", os.getenv("BRAVE_API_KEY", ""))
    research_max_results: int = _int("RESEARCH_MAX_RESULTS", 5)

    # Cover image fallbacks: Gemini -> Pexels -> Pixabay -> Openverse.
    pexels_api_key: str = os.getenv("PEXELS_API_KEY", "")
    pixabay_api_key: str = os.getenv("PIXABAY_API_KEY", "")
    image_download_max_mb: int = _int("IMAGE_DOWNLOAD_MAX_MB", 15)

    # Publishing policy: at most 5 posts/language/Pakistan day.
    daily_post_limit_per_language: int = _int("DAILY_POST_LIMIT_PER_LANGUAGE", 5)
    publish_timezone: str = os.getenv("PUBLISH_TIMEZONE", "Asia/Karachi")

    # Supabase server-side credentials. Never expose SERVICE_ROLE to browser code.
    supabase_url: str = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", ""))
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    agent_author_id: str | None = os.getenv("AGENT_AUTHOR_ID") or None
    post_status: str = os.getenv("AGENT_POST_STATUS", "published")
    duplicate_window_days: int = _int("DUPLICATE_WINDOW_DAYS", 3)

    # Cloudinary server-side credentials.
    cloudinary_cloud_name: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    cloudinary_api_key: str = os.getenv("CLOUDINARY_API_KEY", "")
    cloudinary_api_secret: str = os.getenv("CLOUDINARY_API_SECRET", "")
    cloudinary_folder: str = os.getenv("CLOUDINARY_AGENT_FOLDER", "km-afaq/blog")

    # Owner LINE summary.
    line_channel_access_token: str = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
    line_user_id: str = os.getenv("LINE_USER_ID", "")
    line_daily_summary_required: bool = _bool(
        "LINE_DAILY_SUMMARY_REQUIRED",
        _bool("NOTIFY_REQUIRED", False),  # backward-compatible env name
    )

    # Reader email digests via SMTP.
    smtp_host: str = os.getenv("SMTP_HOST", os.getenv("SMTP_SERVER", ""))
    smtp_port: int = _int("SMTP_PORT", 587)
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", os.getenv("SENDER_EMAIL", os.getenv("SMTP_USERNAME", "")))
    smtp_use_tls: bool = _bool("SMTP_USE_TLS", True)
    smtp_use_ssl: bool = _bool("SMTP_USE_SSL", False)
    smtp_test_to: str = os.getenv("SMTP_TO", "")

    # If false, all image sources must fail before the post is aborted.
    allow_publish_without_image: bool = _bool("ALLOW_PUBLISH_WITHOUT_IMAGE", False)

    def provider_order(self) -> tuple[str, ...]:
        available = ["groq", "gemini", "openrouter"]
        primary = self.llm_primary if self.llm_primary in available else "groq"
        return tuple([primary, *[name for name in available if name != primary]])

    def validate_for_run(self, *, publish: bool, generate_image: bool) -> list[str]:
        missing: list[str] = []
        if not (self.groq_api_key or self.gemini_api_key or self.openrouter_api_key):
            missing.append("GROQ_API_KEY or GEMINI_API_KEY or OPENROUTER_API_KEY")

        if publish:
            for name, value in (
                ("SUPABASE_URL", self.supabase_url),
                ("SUPABASE_SERVICE_ROLE_KEY", self.supabase_service_role_key),
            ):
                if not value:
                    missing.append(name)

        # Every successful image (generated or fetched) is copied to Cloudinary.
        if publish and generate_image:
            for name, value in (
                ("CLOUDINARY_CLOUD_NAME", self.cloudinary_cloud_name),
                ("CLOUDINARY_API_KEY", self.cloudinary_api_key),
                ("CLOUDINARY_API_SECRET", self.cloudinary_api_secret),
            ):
                if not value:
                    missing.append(name)

        if publish and self.line_daily_summary_required:
            if not self.line_channel_access_token:
                missing.append("LINE_CHANNEL_ACCESS_TOKEN")
            if not self.line_user_id:
                missing.append("LINE_USER_ID")
        return missing

    @staticmethod
    def pretty_missing(items: Iterable[str]) -> str:
        return ", ".join(sorted(set(items)))
