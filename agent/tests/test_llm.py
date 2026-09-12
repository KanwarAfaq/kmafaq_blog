import unittest
from unittest.mock import Mock, patch

from agent.config import Settings
from agent.llm import FallbackLLM


class LLMTest(unittest.TestCase):
    @patch("agent.llm.requests.post")
    def test_openrouter_uses_bearer_authorization(self, mocked_post):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"choices": [{"message": {"content": '{"ok": true}'}}]}
        mocked_post.return_value = response

        settings = Settings(
            site_url="https://kmafaq.online",
            openrouter_api_key="unit-test-key",
            openrouter_model="openrouter/model",
        )
        llm = FallbackLLM(settings)
        result = llm._openrouter("system", "prompt", 0.4, 1000)

        self.assertEqual(result, {"ok": True})
        headers = mocked_post.call_args.kwargs["headers"]
        self.assertEqual(headers["Authorization"], "Bear" + "er " + "unit-test-key")

    @patch.object(FallbackLLM, "_gemini")
    def test_generate_json_retries_same_provider_once(self, mocked_gemini):
        mocked_gemini.side_effect = [ValueError("invalid json"), {"ok": True}]
        settings = Settings(gemini_api_key="unit-gemini-key")
        llm = FallbackLLM(settings)

        data, provider = llm.generate_json(system="system", prompt="prompt")

        self.assertEqual(data, {"ok": True})
        self.assertEqual(provider, "gemini")
        self.assertEqual(mocked_gemini.call_count, 2)


if __name__ == "__main__":
    unittest.main()
