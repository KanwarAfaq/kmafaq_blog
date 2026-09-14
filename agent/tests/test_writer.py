import unittest
from types import SimpleNamespace

from agent.llm import AllProvidersFailed
from agent.models import TrendItem
from agent.writer import select_topic


class _FailingLLM:
    def generate_json(self, **kwargs):
        raise AllProvidersFailed("providers unavailable")


class WriterTest(unittest.TestCase):
    def test_select_topic_uses_deterministic_fallback_when_all_providers_fail(self):
        settings = SimpleNamespace(min_trend_relevance=45)
        trends = [
            TrendItem(query="AI agents", geo="US", source_url="https://example.com/1", provider="google_trends"),
            TrendItem(query="Cricket World Cup", geo="PK", source_url="https://example.com/2", provider="google_trends"),
        ]

        selection = select_topic(_FailingLLM(), trends, settings, language="en")

        self.assertEqual(selection.source_query, "AI agents")
        self.assertEqual(selection.topic, "AI agents")
        self.assertEqual(selection.provider, "rule-based-fallback")
        self.assertGreaterEqual(selection.relevance_score, settings.min_trend_relevance)


if __name__ == "__main__":
    unittest.main()
