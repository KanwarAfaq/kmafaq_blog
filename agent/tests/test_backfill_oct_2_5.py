from __future__ import annotations

import unittest
from collections import Counter
from types import SimpleNamespace

from agent.backfill_oct_2_5 import SLOTS, _scheduled_at, _slug


class OctoberBackfillManifestTest(unittest.TestCase):
    def test_has_exactly_five_posts_per_language_per_day(self):
        counts = Counter((row[0], row[2]) for row in SLOTS)
        self.assertEqual(len(SLOTS), 40)
        for publish_date in ("2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"):
            self.assertEqual(counts[(publish_date, "ur")], 5)
            self.assertEqual(counts[(publish_date, "en")], 5)

    def test_topic_provenance_is_expected(self):
        providers = Counter(row[5] for row in SLOTS)
        self.assertEqual(providers["github_actions_log"], 37)
        self.assertEqual(providers["historical_news_archive"], 3)

    def test_deterministic_slugs_are_unique(self):
        slugs = [_slug(row[0], row[1], row[2], row[3]) for row in SLOTS]
        self.assertEqual(len(slugs), len(set(slugs)))

    def test_pakistan_time_is_backdated_to_utc(self):
        settings = SimpleNamespace(publish_timezone="Asia/Karachi")
        self.assertEqual(
            _scheduled_at(settings, "2026-10-02", "08:00"),
            "2026-10-02T03:00:00+00:00",
        )
        self.assertEqual(
            _scheduled_at(settings, "2026-10-05", "23:30"),
            "2026-10-05T18:30:00+00:00",
        )


if __name__ == "__main__":
    unittest.main()
