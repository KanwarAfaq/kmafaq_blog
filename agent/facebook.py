from __future__ import annotations

import logging
from dataclasses import dataclass

import requests

from .config import Settings

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class FacebookPublishResult:
    status: str
    facebook_post_id: str | None = None
    error: str | None = None


def build_caption(title: str, excerpt: str, url: str) -> str:
    parts = [title.strip()]
    if excerpt.strip():
        parts.append(excerpt.strip())
    parts.append(url.strip())
    return "\n\n".join(part for part in parts if part)


def publish_photo(
    settings: Settings,
    *,
    title: str,
    excerpt: str,
    article_url: str,
    image_url: str | None,
) -> FacebookPublishResult:
    """Publish the website post to the configured Facebook Page.

    This function never raises for Facebook API errors. Website publishing must
    remain independent from Facebook availability.
    """
    if not settings.facebook_posting_enabled:
        return FacebookPublishResult(status="disabled")

    if not settings.facebook_page_id or not settings.facebook_page_access_token:
        return FacebookPublishResult(status="misconfigured", error="Missing Facebook Page credentials")

    if not image_url:
        return FacebookPublishResult(status="skipped-no-image", error="Post has no cover image")

    endpoint = (
        f"https://graph.facebook.com/{settings.facebook_api_version}/"
        f"{settings.facebook_page_id}/photos"
    )
    payload = {
        "url": image_url,
        "caption": build_caption(title, excerpt, article_url),
        "access_token": settings.facebook_page_access_token,
    }

    try:
        response = requests.post(endpoint, data=payload, timeout=settings.request_timeout)
        data = response.json() if response.content else {}
        response.raise_for_status()
        post_id = str(data.get("post_id") or data.get("id") or "") or None
        LOGGER.info("Facebook publish complete: %s", post_id or "success")
        return FacebookPublishResult(status="published", facebook_post_id=post_id)
    except Exception as exc:
        error = str(exc)
        try:
            body = response.json()  # type: ignore[possibly-undefined]
            fb_message = ((body.get("error") or {}).get("message") or "").strip()
            if fb_message:
                error = fb_message
        except Exception:
            pass
        LOGGER.exception("Facebook publish failed: %s", error)
        return FacebookPublishResult(status="failed", error=error)
