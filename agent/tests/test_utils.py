import unittest

from agent.utils import extract_json, slugify


class UtilsTest(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("AI Agents: 10 Ways to Earn"), "ai-agents-10-ways-to-earn")

    def test_extract_json_fence(self):
        self.assertEqual(extract_json('```json\n{"ok": true}\n```'), {"ok": True})


if __name__ == "__main__":
    unittest.main()
