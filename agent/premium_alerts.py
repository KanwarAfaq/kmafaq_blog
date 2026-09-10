from __future__ import annotations

import html
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from supabase import Client, create_client

from .config import Settings
from .user_digests import LINE_PUSH_URL, _post_url, _title, send_smtp_email

LOGGER = logging.getLogger(__name__)


def _matches(post: dict[str, Any], alert: dict[str, Any]) -> bool:
    topics = set(alert.get("topics") or [])
    languages = set(alert.get("languages") or [])
    if topics and post.get("topic_category") not in topics:
        return False
    if languages and post.get("language") not in languages:
        return False
    haystack = " ".join(str(post.get(key) or "") for key in ("title", "excerpt", "source_topic", "content")).casefold()
    return any(str(keyword).strip().casefold() in haystack for keyword in (alert.get("keywords") or []) if str(keyword).strip())


def _build_email(settings: Settings, alert: dict[str, Any], post: dict[str, Any]) -> tuple[str, str, str]:
    title = _title(post)
    url = _post_url(settings.site_url, post)
    subject = f"KM Afaq Alert: {title[:90]}"
    safe_title = html.escape(title)
    safe_name = html.escape(str(alert.get("name") or "Watchlist"))
    safe_url = html.escape(url, quote=True)
    body = f'<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><p style="font-weight:800;color:#2563eb">KM Afaq Premium Intelligence</p><h1 style="font-size:24px">{safe_title}</h1><p>Matched watchlist: <b>{safe_name}</b></p><a href="{safe_url}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">Read article</a></div>'
    text = f"KM Afaq Premium Intelligence\nMatched: {alert.get('name')}\n\n{title}\n{url}"
    return subject, body, text


class PremiumAlertWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _alerts(self) -> list[dict[str, Any]]:
        response = self.client.table("premium_alerts").select("*").eq("active", True).execute()
        return list(getattr(response, "data", None) or [])

    def _premium_active(self, user_id: str) -> bool:
        response = self.client.table("user_profiles").select("subscription_tier,subscription_status,subscription_expires_at").eq("user_id", user_id).limit(1).execute()
        rows = list(getattr(response, "data", None) or [])
        if not rows:
            return False
        row = rows[0]
        if row.get("subscription_tier") not in {"premium", "business"} or row.get("subscription_status") not in {"active", "trial"}:
            return False
        expires = row.get("subscription_expires_at")
        if expires:
            when = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if when.tzinfo is None:
                when = when.replace(tzinfo=UTC)
            if when < datetime.now(UTC):
                return False
        return True

    def _posts(self, since: datetime) -> list[dict[str, Any]]:
        response = (
            self.client.table("posts")
            .select("id,title,slug,excerpt,content,source_topic,language,topic_category,created_at")
            .eq("status", "published")
            .gte("created_at", since.astimezone(UTC).isoformat())
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        return list(getattr(response, "data", None) or [])

    def _auth_email(self, user_id: str) -> str | None:
        response = self.client.auth.admin.get_user_by_id(user_id)
        user = getattr(response, "user", None)
        return getattr(user, "email", None) if user else None

    def _prefs(self, user_id: str) -> dict[str, Any]:
        response = self.client.table("notification_preferences").select("line_user_id,line_friend,line_enabled").eq("user_id", user_id).limit(1).execute()
        rows = list(getattr(response, "data", None) or [])
        return rows[0] if rows else {}

    def _sent(self, alert_id: str, post_id: str, channel: str) -> bool:
        response = self.client.table("premium_alert_delivery_log").select("id").eq("alert_id", alert_id).eq("post_id", post_id).eq("channel", channel).eq("status", "sent").limit(1).execute()
        return bool(getattr(response, "data", None) or [])

    def _log(self, alert: dict[str, Any], post: dict[str, Any], channel: str, status: str, error: str | None = None) -> None:
        self.client.table("premium_alert_delivery_log").upsert({
            "alert_id": alert["id"], "user_id": alert["user_id"], "post_id": post["id"], "channel": channel,
            "status": status, "error_message": error[:1000] if error else None,
            "sent_at": datetime.now(UTC).isoformat() if status == "sent" else None,
        }, on_conflict="alert_id,post_id,channel").execute()

    def _send_email(self, alert: dict[str, Any], post: dict[str, Any]) -> bool:
        if self._sent(alert["id"], post["id"], "email"):
            return True
        email = self._auth_email(str(alert["user_id"]))
        if not email:
            self._log(alert, post, "email", "failed", "No account email")
            return False
        try:
            subject, body, text = _build_email(self.settings, alert, post)
            send_smtp_email(self.settings, email, subject, body, text)
            self._log(alert, post, "email", "sent")
            return True
        except Exception as exc:
            self._log(alert, post, "email", "failed", str(exc))
            LOGGER.exception("Premium email alert failed")
            return False

    def _send_line(self, alert: dict[str, Any], post: dict[str, Any]) -> bool:
        if self._sent(alert["id"], post["id"], "line"):
            return True
        prefs = self._prefs(str(alert["user_id"]))
        if not (prefs.get("line_enabled") and prefs.get("line_friend") and prefs.get("line_user_id")):
            self._log(alert, post, "line", "failed", "No linked LINE account for this website user")
            return False
        try:
            response = requests.post(LINE_PUSH_URL, headers={"Authorization": f"Bearer {self.settings.line_channel_access_token}", "Content-Type": "application/json"}, json={"to": prefs["line_user_id"], "messages": [{"type": "text", "text": f"🚨 KM Afaq Premium Alert\n{alert.get('name')}\n\n{_title(post)}\n{_post_url(self.settings.site_url, post)}"}]}, timeout=self.settings.request_timeout)
            response.raise_for_status()
            self._log(alert, post, "line", "sent")
            return True
        except Exception as exc:
            self._log(alert, post, "line", "failed", str(exc))
            LOGGER.exception("Premium LINE alert failed")
            return False

    def run(self, *, force: bool = False) -> dict[str, int]:
        now = datetime.now(UTC)
        stats = {"alerts": 0, "matched": 0, "sent": 0, "failed": 0, "inactive_plan": 0}
        for alert in self._alerts():
            stats["alerts"] += 1
            user_id = str(alert["user_id"])
            if not self._premium_active(user_id):
                stats["inactive_plan"] += 1
                continue
            last = alert.get("last_checked_at")
            if last and not force:
                since = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                if since.tzinfo is None:
                    since = since.replace(tzinfo=UTC)
            else:
                since = now - timedelta(hours=24 if force else 2)
            posts = [post for post in self._posts(since) if _matches(post, alert)]
            stats["matched"] += len(posts)
            channels = set(alert.get("channels") or ["email"])
            for post in posts:
                results = []
                if "email" in channels:
                    results.append(self._send_email(alert, post))
                if "line" in channels:
                    results.append(self._send_line(alert, post))
                if results and all(results):
                    stats["sent"] += 1
                elif results:
                    stats["failed"] += 1
            self.client.table("premium_alerts").update({"last_checked_at": now.isoformat()}).eq("id", alert["id"]).execute()
        return stats
