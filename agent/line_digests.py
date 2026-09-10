from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from supabase import Client, create_client

from .config import Settings
from .digest_sponsors import active_digest_sponsor, record_sponsor_impression, sponsor_click_url
from .user_digests import _lookback_days, _parse_iso, _period_key, _post_url, _title, next_digest_at

LOGGER = logging.getLogger(__name__)
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


def build_line_subscriber_digest(settings: Settings, posts: list[dict[str, Any]], sponsor: dict[str, Any] | None = None) -> str:
    base_url = settings.line_public_base_url or settings.site_url
    lines = ["📰 KM Afaq — Your Digest", f"{len(posts)} new post{'s' if len(posts) != 1 else ''} based on your interests", ""]
    for index, row in enumerate(posts[:10], 1):
        title = _title(row)
        if len(title) > 115:
            title = title[:112].rstrip() + "…"
        lines.append(f"{index}. {title}")
        lines.append(f"{base_url}/blog/{row['slug']}")
    if len(posts) > 10:
        lines.extend(["", f"+ {len(posts) - 10} more posts"])
    if sponsor:
        lines.extend(["", f"Sponsored by {sponsor.get('sponsor_name') or 'Partner'}", str(sponsor.get("headline") or "Partner message")])
        if sponsor.get("body"):
            lines.append(str(sponsor["body"])[:360])
        lines.append(f"{sponsor.get('cta_label') or 'Learn more'}: {sponsor_click_url(settings, sponsor, 'line')}")
    lines.extend(["", "Type settings in this LINE chat anytime to change your preferences."])
    return "\n".join(lines)[:4800]


class LineSubscriberDigestWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _subscribers(self) -> list[dict[str, Any]]:
        response = self.client.table("line_subscribers").select("*").eq("active", True).eq("line_friend", True).execute()
        return list(getattr(response, "data", None) or [])

    def _posts(self, pref: dict[str, Any], now_utc: datetime) -> list[dict[str, Any]]:
        last_sent = _parse_iso(pref.get("last_sent_at"))
        cutoff = last_sent or (now_utc - timedelta(days=_lookback_days(pref)))
        query = (
            self.client.table("posts")
            .select("id,title,slug,excerpt,language,topic_category,created_at")
            .eq("status", "published")
            .gte("created_at", cutoff.astimezone(UTC).isoformat())
            .order("created_at", desc=True)
            .limit(40)
        )
        topics = list(pref.get("topics") or [])
        languages = list(pref.get("languages") or [])
        if topics:
            query = query.in_("topic_category", topics)
        if languages:
            query = query.in_("language", languages)
        response = query.execute()
        return list(getattr(response, "data", None) or [])

    def _already_sent(self, subscriber_id: str, period_key: str) -> bool:
        response = (
            self.client.table("line_delivery_log")
            .select("id")
            .eq("line_subscriber_id", subscriber_id)
            .eq("period_key", period_key)
            .eq("status", "sent")
            .limit(1)
            .execute()
        )
        return bool(getattr(response, "data", None) or [])

    def _log(self, subscriber_id: str, period_key: str, status: str, post_count: int, error: str | None = None) -> None:
        now = datetime.now(UTC).isoformat()
        self.client.table("line_delivery_log").upsert(
            {
                "line_subscriber_id": subscriber_id,
                "period_key": period_key,
                "status": status,
                "post_count": post_count,
                "error_message": error[:1000] if error else None,
                "sent_at": now if status == "sent" else None,
            },
            on_conflict="line_subscriber_id,period_key",
        ).execute()

    def _send(self, pref: dict[str, Any], posts: list[dict[str, Any]], period_key: str) -> bool:
        subscriber_id = str(pref["id"])
        if self._already_sent(subscriber_id, period_key):
            return True
        if not self.settings.line_channel_access_token:
            self._log(subscriber_id, period_key, "failed", len(posts), "LINE_CHANNEL_ACCESS_TOKEN is missing")
            return False
        sponsor = active_digest_sponsor(self.client, "line")
        try:
            response = requests.post(
                LINE_PUSH_URL,
                headers={"Authorization": f"Bearer {self.settings.line_channel_access_token}", "Content-Type": "application/json"},
                json={"to": pref["line_user_id"], "messages": [{"type": "text", "text": build_line_subscriber_digest(self.settings, posts, sponsor)}]},
                timeout=self.settings.request_timeout,
            )
            response.raise_for_status()
            self._log(subscriber_id, period_key, "sent", len(posts))
            record_sponsor_impression(self.client, sponsor)
            return True
        except Exception as exc:
            self._log(subscriber_id, period_key, "failed", len(posts), str(exc))
            LOGGER.exception("LINE subscriber digest failed for %s", subscriber_id)
            return False

    def run(self, *, force: bool = False, subscriber_id: str | None = None) -> dict[str, int]:
        now = datetime.now(UTC)
        stats = {"checked": 0, "scheduled": 0, "due": 0, "sent": 0, "empty": 0, "failed": 0}
        for pref in self._subscribers():
            if subscriber_id and str(pref.get("id")) != subscriber_id:
                continue
            stats["checked"] += 1
            due = _parse_iso(pref.get("next_digest_at"))
            if due is None and not force:
                due = next_digest_at(pref, now_utc=now, after_send=False)
                self.client.table("line_subscribers").update({"next_digest_at": due.isoformat()}).eq("id", pref["id"]).execute()
                stats["scheduled"] += 1
                continue
            if not force and due and due > now:
                continue
            due = due or now
            stats["due"] += 1
            posts = self._posts(pref, now)
            if not posts:
                next_at = next_digest_at(pref, now_utc=now, after_send=True)
                self.client.table("line_subscribers").update({"last_sent_at": now.isoformat(), "next_digest_at": next_at.isoformat()}).eq("id", pref["id"]).execute()
                stats["empty"] += 1
                continue
            period_key = _period_key(pref, due)
            if self._send(pref, posts, period_key):
                next_at = next_digest_at(pref, now_utc=now, after_send=True)
                self.client.table("line_subscribers").update({"last_sent_at": now.isoformat(), "next_digest_at": next_at.isoformat()}).eq("id", pref["id"]).execute()
                stats["sent"] += 1
            else:
                stats["failed"] += 1
        return stats
