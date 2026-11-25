"""Prevent a future agent template regeneration from restoring 10 daily posts."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class AgentWorkflowPolicyTests(unittest.TestCase):
    def test_production_and_installable_template_share_four_post_policy(self):
        active = (ROOT / ".github/workflows/ai-agent.yml").read_text(encoding="utf-8")
        template = (ROOT / "agent/templates/github-action.yml").read_text(encoding="utf-8")
        self.assertEqual(
            template.split("name:", 1)[1],
            active.split("name:", 1)[1],
            "Agent installable template must stay synchronized with the active workflow",
        )
        for workflow in (active, template):
            self.assertIn("DAILY_POST_LIMIT_TOTAL: '4'", workflow)
            self.assertIn("DAILY_POST_LIMIT_PER_LANGUAGE: '2'", workflow)
            self.assertEqual(len(re.findall(r"^\s*- cron:", workflow, re.M)), 5,
                             "Expected four publishing slots and one daily summary")
            self.assertIn("concurrency:", workflow)

if __name__ == "__main__":
    unittest.main()
