from __future__ import annotations

import logging
from typing import Any

import requests

from .config import Settings

LOGGER = logging.getLogger(__name__)
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


def send_line(settings: Settings, message: str) -> str:
    if not settings.line_channel_access_token or not settings.line_user_id:
        LOGGER.info("LINE notification skipped: credentials are not configured")
        return "skipped"
    response = requests.post(
        LINE_PUSH_URL,
        headers={
            "Authorization": f"Bearer {settings.line_channel_access_token}",
            "Content-Type": "application/json",
        },
        json={"to": settings.line_user_id, "messages": [{"type": "text", "text": message}]},
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    return "sent"


def _title_lines(posts: list[dict[str, Any]], language: str) -> list[str]:
    rows = [row for row in posts if row.get("language") == language]
    lines: list[str] = []
    for index, row in enumerate(rows, 1):
        title = " ".join(str(row.get("title") or "Untitled").split())
        if len(title) > 130:
            title = title[:127].rstrip() + "…"
        lines.append(f"{index}. {title}")
    return lines


def build_daily_summary(
    *,
    publish_date: str,
    urdu: int,
    english: int,
    target_each: int,
    site_url: str,
    posts: list[dict[str, Any]],
) -> str:
    total = urdu + english
    target_total = target_each * 2
    urdu_titles = _title_lines(posts, "ur")
    english_titles = _title_lines(posts, "en")

    sections = [
        "✅ KM Afaq — Daily Publishing Complete",
        f"Date: {publish_date} (PKT)",
        f"Total: {total}/{target_total}",
        "",
        f"🇵🇰 Urdu {urdu}/{target_each}",
        *(urdu_titles or ["No Urdu titles found"]),
        "",
        f"🌐 English {english}/{target_each}",
        *(english_titles or ["No English titles found"]),
        "",
        f"Read: {site_url}/blog",
    ]
    # LINE text messages allow far more than this in normal use, but keep a safe cap.
    return "\n".join(sections)[:4500]


def maybe_send_daily_summary(settings: Settings, repo: Any, *, force: bool = False) -> dict[str, Any]:
    """Send exactly one LINE summary after both language targets are complete."""
    counts = repo.daily_post_counts()
    publish_date = repo.local_publish_date()
    target = settings.daily_post_limit_per_language
    complete = counts["ur"] >= target and counts["en"] >= target

    if not complete and not force:
        return {"status": "pending", "date": publish_date, "counts": counts}

    if repo.daily_summary_sent(publish_date):
        return {"status": "already-sent", "date": publish_date, "counts": counts}

    posts = repo.today_agent_posts()
    message = build_daily_summary(
        publish_date=publish_date,
        urdu=counts["ur"],
        english=counts["en"],
        target_each=target,
        site_url=settings.site_url,
        posts=posts,
    )
    status = send_line(settings, message)
    if status == "sent":
        repo.mark_daily_summary_sent(publish_date)
    elif settings.line_daily_summary_required:
        raise RuntimeError("Daily LINE summary was required but could not be sent")
    return {"status": status, "date": publish_date, "counts": counts, "titles": len(posts)}
