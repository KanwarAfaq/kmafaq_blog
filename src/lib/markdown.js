/**
 * Older AI drafts occasionally compressed a Markdown table into one line:
 * `| A | B | | --- | --- | | C | D |`.
 * Restore row boundaries before ReactMarkdown/remark-gfm parses the article.
 */
export function normalizeArticleMarkdown(value = '') {
  return String(value)
    .replace(/\r\n/g, '\n')
    .split('\n').map(line => /\|\s+\|\s*:?-{3,}/.test(line) ? line.replace(/\|\s+\|/g, '|\n|') : line).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
