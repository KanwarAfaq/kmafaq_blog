import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeArticleMarkdown } from '../src/lib/markdown.js';
import { extractHeadings, headingId } from '../src/lib/article.js';

export function renderArticleHtml(value = '') {
  // Never execute stored HTML. Keep legacy text and block boundaries, while
  // Markdown headings, citations, lists and tables remain semantic HTML.
  const markdown = normalizeArticleMarkdown(String(value)
    .split(/(^[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*(?:`{3,}|~{3,})[ \t]*$|`+[^`]*`+)/gm)
    .map((part, index) => index % 2 ? part : part
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n\n${'#'.repeat(Math.max(2, Number(level)))} ${text}\n\n`)
    .replace(/<\/(?:p|div|li|ul|ol)>|<br\s*\/?>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')).join(''));
  const headings = extractHeadings(markdown);
  let index = 0;
  const heading = tag => ({ children }) => createElement(tag, {
    id: headings[index++]?.id || headingId(String(children)),
  }, children);
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    components: { h1: heading('h2'), h2: heading('h2'), h3: heading('h3') },
  }, markdown));
}
