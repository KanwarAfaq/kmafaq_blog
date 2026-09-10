from __future__ import annotations

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from datetime import UTC, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import requests
from supabase import Client, create_client

from .config import Settings
from .digest_sponsors import active_digest_sponsor, record_sponsor_impression, sponsor_click_url

LOGGER = logging.getLogger(__name__)
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


def send_smtp_email(settings: Settings, to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise RuntimeError("SMTP_HOST/SMTP_SERVER and SMTP_FROM/SENDER_EMAIL are required")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    context = ssl.create_default_context()
    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=settings.request_timeout, context=context
        ) as smtp:
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.request_timeout) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls:
            smtp.starttls(context=context)
            smtp.ehlo()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def _parse_time(value: Any) -> time:
    text = str(value or "09:00").split("+")[0]
    parts = text.split(":")
    return time(hour=int(parts[0]), minute=int(parts[1]) if len(parts) > 1 else 0)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _db_weekday(dt: datetime) -> int:
    """DB convention: 0=Sunday ... 6=Saturday."""
    return (dt.weekday() + 1) % 7


def _candidate_at(local_date, preferred: time, zone: ZoneInfo) -> datetime:
    return datetime.combine(local_date, preferred, tzinfo=zone)


def next_digest_at(pref: dict[str, Any], *, now_utc: datetime, after_send: bool) -> datetime:
    try:
        zone = ZoneInfo(str(pref.get("timezone") or "Asia/Karachi"))
    except Exception:
        zone = ZoneInfo("UTC")
    now_local = now_utc.astimezone(zone)
    preferred = _parse_time(pref.get("preferred_time"))
    frequency = pref.get("frequency") or "daily"

    if after_send and frequency in {"every_15_days", "every_30_days"}:
        days = 15 if frequency == "every_15_days" else 30
        return _candidate_at(now_local.date() + timedelta(days=days), preferred, zone).astimezone(UTC)

    if frequency == "daily" or frequency in {"every_15_days", "every_30_days"}:
        candidate = _candidate_at(now_local.date(), preferred, zone)
        if after_send or candidate <= now_local:
            candidate = _candidate_at(now_local.date() + timedelta(days=1), preferred, zone)
        return candidate.astimezone(UTC)

    if frequency == "weekly":
        target = int(pref.get("weekly_day") or 0)
        for offset in range(0 if not after_send else 1, 8):
            day = now_local.date() + timedelta(days=offset)
            candidate = _candidate_at(day, preferred, zone)
            if _db_weekday(candidate) == target and candidate > now_local:
                return candidate.astimezone(UTC)
        return (now_utc + timedelta(days=7)).replace(second=0, microsecond=0)

    selected = {int(day) for day in (pref.get("custom_weekdays") or [])}
    if selected:
        for offset in range(0 if not after_send else 1, 8):
            day = now_local.date() + timedelta(days=offset)
            candidate = _candidate_at(day, preferred, zone)
            if _db_weekday(candidate) in selected and candidate > now_local:
                return candidate.astimezone(UTC)

    # Invalid/empty custom day config: fall back to tomorrow rather than spam now.
    return _candidate_at(now_local.date() + timedelta(days=1), preferred, zone).astimezone(UTC)


def _lookback_days(pref: dict[str, Any]) -> int:
    return {
        "daily": 1,
        "weekly": 7,
        "every_15_days": 15,
        "every_30_days": 30,
        "custom_days": 7,
    }.get(pref.get("frequency"), 1)


def _period_key(pref: dict[str, Any], due: datetime) -> str:
    return f"{pref.get('frequency','daily')}:{due.astimezone(UTC).strftime('%Y%m%dT%H%MZ')}"


def _post_url(site_url: str, row: dict[str, Any]) -> str:
    return f"{site_url}/blog/{row['slug']}"


def _title(row: dict[str, Any]) -> str:
    return " ".join(str(row.get("title") or "Untitled").split())


def build_line_digest(
    settings: Settings,
    posts: list[dict[str, Any]],
    pref: dict[str, Any],
    sponsor: dict[str, Any] | None = None,
) -> str:
    lines = ["📰 KM Afaq — Your Digest", f"{len(posts)} new post{'s' if len(posts) != 1 else ''} based on your interests", ""]
    for index, row in enumerate(posts[:10], 1):
        title = _title(row)
        if len(title) > 115:
            title = title[:112].rstrip() + "…"
        lines.append(f"{index}. {title}")
        lines.append(_post_url(settings.site_url, row))
    if len(posts) > 10:
        lines.extend(["", f"+ {len(posts) - 10} more posts"])
    if sponsor:
        lines.extend([
            "",
            f"Sponsored by {sponsor.get('sponsor_name') or 'Partner'}",
            str(sponsor.get("headline") or "Partner message"),
        ])
        if sponsor.get("body"):
            lines.append(str(sponsor["body"])[:360])
        lines.append(f"{sponsor.get('cta_label') or 'Learn more'}: {sponsor_click_url(settings, sponsor, 'line')}")
    lines.extend(["", f"Manage preferences: {settings.site_url}/profile/notifications"])
    return "\n".join(lines)[:4800]


def build_email_digest(
    settings: Settings,
    posts: list[dict[str, Any]],
    display_name: str | None,
    sponsor: dict[str, Any] | None = None,
) -> tuple[str, str, str]:
    name = html.escape(display_name or "there")
    rows = []
    for row in posts[:25]:
        title = html.escape(_title(row))
        excerpt = html.escape(" ".join(str(row.get("excerpt") or "").split())[:220])
        category = html.escape(str(row.get("topic_category") or "trending").replace("-", " ").title())
        url = html.escape(_post_url(settings.site_url, row), quote=True)
        rows.append(
            f'<div style="padding:18px 0;border-bottom:1px solid #e5e7eb">'
            f'<div style="font-size:12px;font-weight:800;color:#2563eb;text-transform:uppercase;letter-spacing:.08em">{category}</div>'
            f'<a href="{url}" style="display:block;margin-top:6px;color:#111827;text-decoration:none;font-size:18px;line-height:1.4;font-weight:800">{title}</a>'
            f'<p style="margin:8px 0 0;color:#6b7280;font-size:14px;line-height:1.6">{excerpt}</p>'
            f'</div>'
        )

    sponsor_html = ""
    sponsor_text = ""
    if sponsor:
        sponsor_name = html.escape(str(sponsor.get("sponsor_name") or "Partner"))
        sponsor_headline = html.escape(str(sponsor.get("headline") or "Partner message"))
        sponsor_body = html.escape(str(sponsor.get("body") or ""))
        sponsor_cta = html.escape(str(sponsor.get("cta_label") or "Learn more"))
        sponsor_url = html.escape(sponsor_click_url(settings, sponsor, "email"), quote=True)
        sponsor_html = (
            '<div style="margin:22px 0;padding:18px;border:1px solid #fde68a;background:#fffbeb;border-radius:16px">'
            f'<div style="font-size:11px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.09em">Sponsored by {sponsor_name}</div>'
            f'<div style="margin-top:7px;font-size:17px;font-weight:800;color:#111827">{sponsor_headline}</div>'
            + (f'<p style="margin:7px 0 0;color:#6b7280;font-size:14px;line-height:1.6">{sponsor_body}</p>' if sponsor_body else "")
            + f'<a href="{sponsor_url}" style="display:inline-block;margin-top:12px;color:#92400e;font-weight:800">{sponsor_cta} →</a></div>'
        )
        sponsor_text = f"\n\nSPONSORED BY {sponsor.get('sponsor_name') or 'Partner'}\n{sponsor.get('headline') or 'Partner message'}\n{sponsor.get('body') or ''}\n{sponsor.get('cta_label') or 'Learn more'}: {sponsor_click_url(settings, sponsor, 'email')}"

    subject = f"KM Afaq Digest — {len(posts)} new posts for you"
    html_body = f'''<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#1f2937"><div style="max-width:680px;margin:0 auto;padding:30px 16px"><div style="background:#ffffff;border-radius:20px;padding:28px;box-shadow:0 8px 30px rgba(15,23,42,.06)"><div style="font-size:13px;font-weight:900;color:#7c3aed;letter-spacing:.12em;text-transform:uppercase">KM Afaq</div><h1 style="margin:8px 0 6px;font-size:28px;color:#111827">Your personalized digest</h1><p style="margin:0 0 12px;color:#6b7280;line-height:1.7">Hi {name}, here are the latest stories matching your topics and language preferences.</p>{''.join(rows)}{sponsor_html}<div style="padding-top:24px"><a href="{settings.site_url}/blog" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:12px">Browse all articles</a></div><p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">You received this because you enabled KM Afaq digests. <a href="{settings.site_url}/profile/notifications" style="color:#6b7280">Change notification settings</a>.</p></div></div></body></html>'''
    text_body = "KM Afaq — Your personalized digest\n\n" + "\n\n".join(f"{_title(row)}\n{_post_url(settings.site_url, row)}" for row in posts[:25]) + sponsor_text + f"\n\nManage preferences: {settings.site_url}/profile/notifications"
    return subject, html_body, text_body


class UserDigestWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _preferences(self) -> list[dict[str, Any]]:
        response = self.client.table("notification_preferences").select("*").eq("active", True).execute()
        return list(getattr(response, "data", None) or [])

    def _profile(self, user_id: str) -> dict[str, Any]:
        response = self.client.table("user_profiles").select("display_name,full_name").eq("user_id", user_id).limit(1).execute()
        rows = list(getattr(response, "data", None) or [])
        return rows[0] if rows else {}

    def _auth_email(self, user_id: str) -> str | None:
        response = self.client.auth.admin.get_user_by_id(user_id)
        user = getattr(response, "user", None)
        return getattr(user, "email", None) if user else None

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

    def _already_sent(self, user_id: str, channel: str, period_key: str) -> bool:
        response = (
            self.client.table("notification_delivery_log")
            .select("id,status")
            .eq("user_id", user_id)
            .eq("channel", channel)
            .eq("period_key", period_key)
            .eq("status", "sent")
            .limit(1)
            .execute()
        )
        return bool(getattr(response, "data", None) or [])

    def _log(self, user_id: str, channel: str, period_key: str, status: str, post_count: int, error: str | None = None) -> None:
        now = datetime.now(UTC).isoformat()
        self.client.table("notification_delivery_log").upsert(
            {
                "user_id": user_id,
                "channel": channel,
                "period_key": period_key,
                "status": status,
                "post_count": post_count,
                "error_message": error[:1000] if error else None,
                "sent_at": now if status == "sent" else None,
            },
            on_conflict="user_id,channel,period_key",
        ).execute()

    def _send_line(self, pref: dict[str, Any], posts: list[dict[str, Any]], period_key: str) -> bool:
        user_id = str(pref["user_id"])
        if self._already_sent(user_id, "line", period_key):
            return True
        if not pref.get("line_enabled"):
            return True
        if not (pref.get("line_user_id") and pref.get("line_friend")):
            self._log(user_id, "line", period_key, "failed", len(posts), "LINE is not fully connected or the Official Account is not a friend")
            return False
        sponsor = active_digest_sponsor(self.client, "line")
        try:
            response = requests.post(
                LINE_PUSH_URL,
                headers={"Authorization": f"Bearer {self.settings.line_channel_access_token}", "Content-Type": "application/json"},
                json={"to": pref["line_user_id"], "messages": [{"type": "text", "text": build_line_digest(self.settings, posts, pref, sponsor)}]},
                timeout=self.settings.request_timeout,
            )
            response.raise_for_status()
            self._log(user_id, "line", period_key, "sent", len(posts))
            record_sponsor_impression(self.client, sponsor)
            return True
        except Exception as exc:
            self._log(user_id, "line", period_key, "failed", len(posts), str(exc))
            LOGGER.exception("LINE digest failed for %s", user_id)
            return False

    def _send_email(self, pref: dict[str, Any], posts: list[dict[str, Any]], period_key: str, profile: dict[str, Any]) -> bool:
        user_id = str(pref["user_id"])
        if self._already_sent(user_id, "email", period_key):
            return True
        if not pref.get("email_enabled"):
            return True
        if not self.settings.smtp_host or not self.settings.smtp_from:
            self._log(user_id, "email", period_key, "failed", len(posts), "SMTP_HOST/SMTP_SERVER or SMTP_FROM/SENDER_EMAIL is missing")
            return False
        email = self._auth_email(user_id)
        if not email:
            self._log(user_id, "email", period_key, "failed", len(posts), "No verified account email found")
            return False

        sponsor = active_digest_sponsor(self.client, "email")
        subject, html_body, text_body = build_email_digest(
            self.settings, posts, profile.get("display_name") or profile.get("full_name"), sponsor
        )
        try:
            send_smtp_email(self.settings, email, subject, html_body, text_body)
            self._log(user_id, "email", period_key, "sent", len(posts))
            record_sponsor_impression(self.client, sponsor)
            return True
        except Exception as exc:
            self._log(user_id, "email", period_key, "failed", len(posts), str(exc))
            LOGGER.exception("Email digest failed for %s", user_id)
            return False

    def run(self, *, force: bool = False, user_id: str | None = None) -> dict[str, int]:
        now = datetime.now(UTC)
        stats = {"checked": 0, "scheduled": 0, "due": 0, "sent": 0, "empty": 0, "failed": 0}
        for pref in self._preferences():
            if user_id and str(pref.get("user_id")) != user_id:
                continue
            if not pref.get("email_enabled") and not pref.get("line_enabled"):
                continue
            stats["checked"] += 1
            due = _parse_iso(pref.get("next_digest_at"))
            if due is None and not force:
                due = next_digest_at(pref, now_utc=now, after_send=False)
                self.client.table("notification_preferences").update({"next_digest_at": due.isoformat()}).eq("user_id", pref["user_id"]).execute()
                stats["scheduled"] += 1
                continue
            if not force and due and due > now:
                continue
            due = due or now
            stats["due"] += 1
            posts = self._posts(pref, now)
            if not posts:
                next_at = next_digest_at(pref, now_utc=now, after_send=True)
                self.client.table("notification_preferences").update({"last_sent_at": now.isoformat(), "next_digest_at": next_at.isoformat()}).eq("user_id", pref["user_id"]).execute()
                stats["empty"] += 1
                continue
            period_key = _period_key(pref, due)
            profile = self._profile(str(pref["user_id"]))
            email_ok = self._send_email(pref, posts, period_key, profile)
            line_ok = self._send_line(pref, posts, period_key)
            if email_ok and line_ok:
                next_at = next_digest_at(pref, now_utc=now, after_send=True)
                self.client.table("notification_preferences").update({"last_sent_at": now.isoformat(), "next_digest_at": next_at.isoformat()}).eq("user_id", pref["user_id"]).execute()
                stats["sent"] += 1
            else:
                stats["failed"] += 1
        return stats
