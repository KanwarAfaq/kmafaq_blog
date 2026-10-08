import unittest
from unittest.mock import Mock, patch
from agent.config import Settings
from agent.llm import FallbackLLM

class CguRoutingTests(unittest.TestCase):
    def test_cgu_precedes_other_providers(self):
        settings = Settings(cgu_api_key="test-key", groq_api_key="other-key")
        self.assertEqual(settings.provider_order()[0], "cgu")
        self.assertEqual(settings.cgu_model, "gpt-oss:20b")

    @patch("agent.llm.requests.post")
    def test_local_failure_tries_cgu_compatible_model(self, post):
        failure = Mock()
        failure.raise_for_status.side_effect = RuntimeError("model unavailable")
        success = Mock()
        success.raise_for_status.return_value = None
        success.json.return_value = {"choices": [{"message": {"content": '{"ok":true}'}}]}
        post.side_effect = [failure, success]
        settings = Settings(cgu_api_key="test-key")
        result, provider = FallbackLLM(settings).generate_json(system="Return JSON", prompt="hello")
        self.assertEqual(provider, "cgu")
        self.assertTrue(result["ok"])
        self.assertEqual(post.call_args_list[0].kwargs["json"]["model"], "gpt-oss:20b")
        self.assertEqual(post.call_args_list[1].kwargs["json"]["model"], "gpt-6-luna")

    @patch("agent.llm.requests.post")
    def test_cgu_exhaustion_falls_back_to_groq(self, post):
        response = Mock()
        response.raise_for_status.side_effect = RuntimeError("offline")
        post.return_value = response
        settings = Settings(cgu_api_key="test-key", groq_api_key="other-key")
        llm = FallbackLLM(settings)
        with patch.object(llm, "_groq", return_value={"fallback": True}) as groq:
            result, provider = llm.generate_json(system="json", prompt="test")
        self.assertEqual(provider, "groq")
        self.assertTrue(result["fallback"])
        groq.assert_called_once()

if __name__ == "__main__":
    unittest.main()
