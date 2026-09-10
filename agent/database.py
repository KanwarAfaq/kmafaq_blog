from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client, create_client

from . import __version__
from .config import Settings
from .models import Article, CoverImage, MediaAsset, PublishResult, TopicSelection
from .utils import utc_now_iso


class PostRepository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _local_day_bounds_utc(self) -> tuple[str, str]:
        zone = ZoneInfo(self.settings.publish_timezone)
        now_local = datetime.now(zone)
        start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(days=1)
        return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()

    def local_publish_date(self) -> str:
        return datetime.now(ZoneInfo(self.settings.publish_timezone)).date().isoformat()

    def count_today_agent_posts(self, language: str) -> int:
        start_utc, end_utc = self._local_day_bounds_utc()
        response = (
            self.client.table("posts")
            .select("id")
            .eq("status", "published")
            .eq("is_ai_generated", True)
            .eq("language", language)
            .gte("created_at", start_utc)
            .lt("created_at", end_utc)
            .execute()
        )
        return len(response.data or [])

    def daily_post_counts(self) -> dict[str, int]:
        return {
            "ur": self.count_today_agent_posts("ur"),
            "en": self.count_today_agent_posts("en"),
        }

    def today_agent_posts(self) -> list[dict[str, Any]]:
        """Return today's AI posts for the LINE summary, oldest first."""
        start_utc, end_utc = self._local_day_bounds_utc()
        response = (
            self.client.table("posts")
            .select("title,slug,language,topic_category,created_at")
            .eq("status", "published")
            .eq("is_ai_generated", True)
            .gte("created_at", start_utc)
            .lt("created_at", end_utc)
            .order("created_at", desc=False)
            .execute()
        )
        return list(getattr(response, "data", None) or [])

    def today_source_topics(self) -> set[str]:
        start_utc, end_utc = self._local_day_bounds_utc()
        response = (
            self.client.table("posts")
            .select("source_topic")
            .eq("status", "published")
            .eq("is_ai_generated", True)
            .gte("created_at", start_utc)
            .lt("created_at", end_utc)
            .execute()
        )
        return {
            str(row.get("source_topic") or "").strip().casefold()
            for row in (response.data or [])
            if row.get("source_topic")
        }

    def recent_source_topics(self, language: str) -> set[str]:
        cutoff = (datetime.now(UTC) - timedelta(days=self.settings.duplicate_window_days)).isoformat()
        response = (
            self.client.table("posts")
            .select("source_topic")
            .eq("status", "published")
            .eq("is_ai_generated", True)
            .eq("language", language)
            .gte("created_at", cutoff)
            .execute()
        )
        return {
            str(row.get("source_topic") or "").strip().casefold()
            for row in (response.data or [])
            if row.get("source_topic")
        }

    def find_recent_topic(self, topic: str, language: str) -> dict[str, Any] | None:
        cutoff = (datetime.now(UTC) - timedelta(days=self.settings.duplicate_window_days)).isoformat()
        response = (
            self.client.table("posts")
            .select(
                "id,title,slug,language,cover_image_url,cover_image_public_id,cover_image_asset_id,"
                "ai_provider,image_provider,created_at,status"
            )
            .eq("source_topic", topic)
            .eq("language", language)
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def slug_exists(self, slug: str) -> bool:
        response = self.client.table("posts").select("id").eq("slug", slug).limit(1).execute()
        return bool(response.data)

    def unique_slug(self, slug: str) -> str:
        if not self.slug_exists(slug):
            return slug
        suffix = datetime.now(UTC).strftime("%Y%m%d-%H%M")
        candidate = f"{slug[:70]}-{suffix}"
        if not self.slug_exists(candidate):
            return candidate
        return f"{candidate}-{datetime.now(UTC).strftime('%S')}"

    def publish(
        self,
        article: Article,
        selection: TopicSelection,
        media: MediaAsset | None,
        cover: CoverImage | None,
        *,
        research_provider: str | None,
    ) -> PublishResult:
        article.slug = self.unique_slug(article.slug)
        row: dict[str, Any] = {
            "title": article.title,
            "slug": article.slug,
            "content": article.content,
            "excerpt": article.excerpt,
            "seo_description": article.seo_description,
            "language": article.language,
            "author_id": self.settings.agent_author_id,
            "status": self.settings.post_status,
            "source_topic": selection.source_query,
            "topic_category": selection.topic_category,
            "source_url": selection.source_url or None,
            "source_provider": selection.source_provider,
            "research_provider": research_provider,
            "ai_provider": article.provider,
            "image_provider": cover.provider if cover else None,
            "is_ai_generated": True,
            "agent_version": __version__,
        }
        if media:
            row.update(
                {
                    "cover_image_url": media.secure_url,
                    "cover_image_public_id": media.public_id,
                    "cover_image_asset_id": media.asset_id,
                    "cover_image_source_url": cover.source_url if cover else None,
                    "cover_image_attribution": cover.attribution if cover else None,
                    "cover_image_license": cover.license if cover else None,
                }
            )
        response = self.client.table("posts").insert(row).execute()
        if not response.data:
            raise RuntimeError("Supabase insert returned no post row")
        inserted = response.data[0]
        return PublishResult(
            post_id=str(inserted["id"]),
            title=inserted["title"],
            slug=inserted["slug"],
            url=f"{self.settings.site_url}/blog/{inserted['slug']}",
            media=media,
            raw=inserted,
        )

    def daily_summary_sent(self, publish_date: str) -> bool:
        """Return True only when today's LINE summary has already been sent.

        Use a normal select+limit instead of maybe_single(), because some
        supabase-py/PostgREST versions can return None when no row exists.
        """
        response = (
            self.client.table("agent_daily_status")
            .select("line_summary_sent_at")
            .eq("publish_date", publish_date)
            .limit(1)
            .execute()
        )

        data = getattr(response, "data", None) or []
        if not data:
            return False

        row = data[0] if isinstance(data, list) else data
        return bool(row.get("line_summary_sent_at"))

    def mark_daily_summary_sent(self, publish_date: str) -> None:
        now = utc_now_iso()
        self.client.table("agent_daily_status").upsert(
            {
                "publish_date": publish_date,
                "line_summary_sent_at": now,
                "updated_at": now,
            },
            on_conflict="publish_date",
        ).execute()
