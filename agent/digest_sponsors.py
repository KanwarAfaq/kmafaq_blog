from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from supabase import Client

from .config import Settings

LOGGER = logging.getLogger(__name__)


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def active_digest_sponsor(client: Client, channel: str, now: datetime | None = None) -> dict[str, Any] | None:
    now = now or datetime.now(UTC)
    response = (
        client.table("digest_sponsor_campaigns")
        .select("id,sponsor_name,headline,body,cta_label,cta_url,channels,starts_at,ends_at,status")
        .eq("status", "active")
        .lte("starts_at", now.isoformat())
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    for row in list(getattr(response, "data", None) or []):
        if channel not in list(row.get("channels") or []):
            continue
        ends_at = _parse_timestamp(row.get("ends_at"))
        if ends_at and ends_at <= now:
            continue
        return row
    return None


def sponsor_click_url(settings: Settings, sponsor: dict[str, Any], channel: str) -> str:
    base_url = (settings.line_public_base_url or settings.site_url).rstrip("/")
    query = urlencode({"id": sponsor["id"], "channel": channel})
    return f"{base_url}/api/go?type=sponsor&{query}"


def record_sponsor_impression(client: Client, sponsor: dict[str, Any] | None) -> None:
    if not sponsor:
        return
    try:
        client.rpc("increment_digest_sponsor_impression", {"target_campaign_id": sponsor["id"]}).execute()
    except Exception:
        LOGGER.exception("Could not increment sponsor impression for %s", sponsor.get("id"))
