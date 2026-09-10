from __future__ import annotations

import argparse
import json
import logging
import sys

from .config import Settings
from .trends import collect_trends


def configure_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="KM Afaq AI publishing agent")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logs")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Run the publishing pipeline")
    run.add_argument("--topic", help="Manual topic override; skips trend selection")
    run.add_argument("--language", choices=("ur", "en"), default="ur", help="Article language")
    run.add_argument("--dry-run", action="store_true", help="Generate content/media but do not upload/publish/notify")
    run.add_argument("--skip-image", action="store_true", help="Skip every image source (debug only)")

    sub.add_parser("trends", help="Fetch and print current topic candidates")
    sub.add_parser("daily-summary", help="Send LINE summary only when today's 5 Urdu + 5 English posts are complete")
    sub.add_parser("notify-test", help="Send a simple LINE test message")
    email_test = sub.add_parser("email-test", help="Send a simple SMTP test email")
    email_test.add_argument("--to", help="Recipient email; defaults to SMTP_TO")
    digests = sub.add_parser("user-digests", help="Process due account email digests and no-login LINE subscriber digests")
    digests.add_argument("--force", action="store_true", help="Send now instead of waiting for next_digest_at")
    digests.add_argument("--user-id", help="Process only one Supabase Auth user UUID for account digests")
    premium = sub.add_parser("premium-alerts", help="Process premium keyword/company/person watchlists")
    premium.add_argument("--force", action="store_true", help="Check the last 24 hours instead of only new posts")
    return parser


def main() -> int:
    parser = make_parser()
    args = parser.parse_args()
    configure_logging(args.verbose)
    settings = Settings()

    try:
        if args.command == "trends":
            rows = collect_trends(settings)
            payload = [
                {
                    "query": row.query,
                    "geo": row.geo,
                    "provider": row.provider,
                    "traffic": row.traffic,
                    "source_url": row.source_url,
                    "news_titles": row.news_titles[:3],
                }
                for row in rows
            ]
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0

        if args.command == "notify-test":
            from .notifications import send_line

            status = send_line(settings, "✅ KM Afaq LINE notification test successful.")
            print(json.dumps({"line": status}, indent=2))
            return 0 if status == "sent" else 1

        if args.command == "email-test":
            from .user_digests import send_smtp_email

            recipient = args.to or settings.smtp_test_to
            if not recipient:
                raise RuntimeError("Provide --to EMAIL or set SMTP_TO")
            send_smtp_email(
                settings,
                recipient,
                "KM Afaq SMTP test",
                "<p>✅ KM Afaq SMTP email test successful.</p>",
                "KM Afaq SMTP email test successful.",
            )
            print(json.dumps({"email": "sent", "to": recipient}, indent=2))
            return 0

        if args.command == "user-digests":
            from .line_digests import LineSubscriberDigestWorker
            from .user_digests import UserDigestWorker

            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
            result = {
                "account_digests": UserDigestWorker(settings).run(force=args.force, user_id=args.user_id),
                "line_subscriber_digests": LineSubscriberDigestWorker(settings).run(force=args.force),
            }
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0

        if args.command == "premium-alerts":
            from .premium_alerts import PremiumAlertWorker

            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
            result = PremiumAlertWorker(settings).run(force=args.force)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0

        if args.command == "daily-summary":
            from .database import PostRepository
            from .notifications import maybe_send_daily_summary

            repo = PostRepository(settings)
            result = maybe_send_daily_summary(settings, repo)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0

        from .pipeline import run_agent

        run_agent(
            settings,
            topic_override=args.topic,
            language=args.language,
            dry_run=args.dry_run,
            skip_image=args.skip_image,
        )
        return 0
    except Exception as exc:
        logging.getLogger(__name__).exception("Agent failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
