from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from agent.facebook import build_caption, publish_photo


class FacebookPublisherTest(unittest.TestCase):
    def settings(self, **overrides):
        base = {
            "facebook_posting_enabled": True,
            "facebook_page_id": "123456",
            "facebook_page_access_token": "test-token",
            "facebook_api_version": "v24.0",
            "request_timeout": 20,
        }
        base.update(overrides)
        return SimpleNamespace(**base)

    def test_build_caption_preserves_unicode_and_link(self):
        caption = build_caption(
            "اردو عنوان",
            "یہ ایک مختصر خلاصہ ہے۔",
            "https://kmafaq.online/blog/test",
        )
        self.assertIn("اردو عنوان", caption)
        self.assertIn("https://kmafaq.online/blog/test", caption)

    @patch("agent.facebook.requests.post")
    def test_publish_photo_uses_same_image_and_caption(self, mocked_post):
        response = Mock()
        response.content = b'{"post_id":"123_456"}'
        response.json.return_value = {"post_id": "123_456"}
        response.raise_for_status.return_value = None
        mocked_post.return_value = response

        result = publish_photo(
            self.settings(),
            title="English title",
            excerpt="Short summary",
            article_url="https://kmafaq.online/blog/test",
            image_url="https://res.cloudinary.com/demo/image/upload/test.jpg",
        )

        self.assertEqual(result.status, "published")
        self.assertEqual(result.facebook_post_id, "123_456")
        _, kwargs = mocked_post.call_args
        self.assertEqual(
            kwargs["data"]["url"],
            "https://res.cloudinary.com/demo/image/upload/test.jpg",
        )
        self.assertIn("https://kmafaq.online/blog/test", kwargs["data"]["caption"])

    @patch("agent.facebook.requests.post")
    def test_facebook_failure_does_not_raise(self, mocked_post):
        mocked_post.side_effect = RuntimeError("network down")
        result = publish_photo(
            self.settings(),
            title="Title",
            excerpt="Excerpt",
            article_url="https://kmafaq.online/blog/test",
            image_url="https://example.com/image.jpg",
        )
        self.assertEqual(result.status, "failed")
        self.assertIn("network down", result.error or "")

    def test_disabled_does_not_publish(self):
        result = publish_photo(
            self.settings(facebook_posting_enabled=False),
            title="Title",
            excerpt="Excerpt",
            article_url="https://kmafaq.online/blog/test",
            image_url="https://example.com/image.jpg",
        )
        self.assertEqual(result.status, "disabled")


if __name__ == "__main__":
    unittest.main()
