from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from agent.image_generator import AllImageProvidersFailed, _gemini, generate_cover_image
from agent.models import CoverImage


class ImageProviderFallbackTest(unittest.TestCase):
    def settings(self, **overrides):
        base = {
            "image_provider_order": ("pexels", "pixabay", "openverse", "gemini"),
            "gemini_api_key": "test-key",
            "gemini_image_model": "test-image-model",
            "gemini_image_timeout_seconds": 12,
        }
        base.update(overrides)
        return SimpleNamespace(**base)

    @patch("agent.image_generator._gemini")
    @patch("agent.image_generator._openverse")
    @patch("agent.image_generator._pixabay")
    @patch("agent.image_generator._pexels")
    def test_stock_provider_is_used_before_gemini(
        self,
        pexels,
        pixabay,
        openverse,
        gemini,
    ):
        pexels.return_value = CoverImage(path=Path("/tmp/cover.jpg"), provider="pexels")

        result = generate_cover_image(self.settings(), "sample prompt", Path("/tmp/cover"))

        self.assertEqual(result.provider, "pexels")
        pexels.assert_called_once()
        pixabay.assert_not_called()
        openverse.assert_not_called()
        gemini.assert_not_called()

    def test_invalid_provider_order_fails_immediately(self):
        with self.assertRaises(AllImageProvidersFailed):
            generate_cover_image(
                self.settings(image_provider_order=("unknown",)),
                "sample prompt",
                Path("/tmp/cover"),
            )

    @patch("agent.image_generator.genai.Client")
    def test_gemini_has_single_attempt_and_hard_timeout(self, client_cls):
        fake_client = Mock()
        fake_client.interactions.create.return_value = SimpleNamespace(
            output_image=SimpleNamespace(data=b"jpeg-bytes")
        )
        client_cls.return_value = fake_client

        with tempfile.TemporaryDirectory() as tmp:
            result = _gemini(
                self.settings(),
                "sample prompt",
                Path(tmp) / "cover",
            )

        self.assertIsNotNone(result)
        http_options = client_cls.call_args.kwargs["http_options"]
        self.assertEqual(http_options.retry_options.attempts, 1)

        create_kwargs = fake_client.interactions.create.call_args.kwargs
        self.assertEqual(create_kwargs["timeout"], 12.0)


if __name__ == "__main__":
    unittest.main()
