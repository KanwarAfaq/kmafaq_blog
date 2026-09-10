import unittest
from unittest.mock import Mock, patch

from agent.trends import fetch_geo_trends


RSS = b'''<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
  <channel>
    <item>
      <title>AI agents</title>
      <ht:approx_traffic>20K+</ht:approx_traffic>
      <link>https://trends.google.com/trending/example</link>
      <pubDate>Sun, 06 Sep 2026 10:00:00 GMT</pubDate>
      <ht:news_item>
        <ht:news_item_title>New AI agent tools arrive</ht:news_item_title>
        <ht:news_item_snippet>Developers are testing new agent workflows.</ht:news_item_snippet>
        <ht:news_item_url>https://example.com/story</ht:news_item_url>
      </ht:news_item>
    </item>
  </channel>
</rss>'''


class TrendsTest(unittest.TestCase):
    @patch('agent.trends.requests.get')
    def test_rss_parser(self, mocked_get):
        response = Mock()
        response.content = RSS
        response.raise_for_status.return_value = None
        mocked_get.return_value = response

        rows = fetch_geo_trends('US', 5)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].query, 'AI agents')
        self.assertEqual(rows[0].traffic, '20K+')
        self.assertEqual(rows[0].news_titles[0], 'New AI agent tools arrive')
        self.assertEqual(rows[0].source_url, 'https://trends.google.com/trending/example')


if __name__ == '__main__':
    unittest.main()
