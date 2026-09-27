from __future__ import annotations

import unittest

from agent.notifications import build_daily_summary


class LineFacebookSummaryTest(unittest.TestCase):
    def test_summary_includes_facebook_status(self):
        posts = [
            {
                "id": "1",
                "title": "Urdu post",
                "language": "ur",
                "facebook": {"status": "published", "facebook_post_id": "p1"},
            },
            {
                "id": "2",
                "title": "English post",
                "language": "en",
                "facebook": {"status": "failed", "error_message": "token expired"},
            },
        ]
        message = build_daily_summary(
            publish_date="2026-09-27",
            urdu=1,
            english=1,
            target_each=1,
            site_url="https://kmafaq.online",
            posts=posts,
        )
        self.assertIn("Urdu post — FB ✅", message)
        self.assertIn("English post — FB ⚠️", message)
        self.assertIn("Facebook: ✅ published", message)

    def test_summary_handles_missing_facebook_record(self):
        posts = [{"id": "1", "title": "Post without audit", "language": "en", "facebook": None}]
        message = build_daily_summary(
            publish_date="2026-09-27",
            urdu=0,
            english=1,
            target_each=1,
            site_url="https://kmafaq.online",
            posts=posts,
        )
        self.assertIn("Post without audit — FB ?", message)


if __name__ == "__main__":
    unittest.main()
