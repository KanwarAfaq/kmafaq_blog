import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArticleHtml } from '../server/article-html.js';
import { renderPublicPage } from '../server/public-page.js';
import { extractHeadings } from '../src/lib/article.js';
import { normalizeArticleMarkdown } from '../src/lib/markdown.js';

test('crawler HTML retains answer headings, citations, lists, code and tables without executing stored HTML',()=>{
 const html=renderArticleHtml('# Answer\n\nA clear answer.\n\n## Evidence\n\n[Official source](https://example.org/docs)\n\n- First\n- Second\n\n| Name | Value |\n| --- | --- |\n| One | Two |\n\n```js\nconst value = 1;\n```\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))');
 assert.match(html,/<h2 id="answer">Answer<\/h2>/);
 assert.match(html,/<h2 id="evidence">Evidence<\/h2>/);
 assert.match(html,/<a href="https:\/\/example.org\/docs">Official source<\/a>/);
 assert.match(html,/<ul>/);assert.match(html,/<table>/);assert.match(html,/<pre><code/);
 assert.doesNotMatch(html,/<script|alert\(1\)|href="javascript:/);
 assert.match(renderArticleHtml('```html\n<div>Example</div>\n```'), /&lt;div&gt;Example&lt;\/div&gt;/);
});

test('normal tables retain empty cells; legacy inline tables regain row boundaries',()=>{
 const regular='| A | B |\n| --- | --- |\n| value | |';
 assert.equal(normalizeArticleMarkdown(regular),regular);
 const html=renderArticleHtml(regular);assert.match(html,/<td>value<\/td>\s*<td><\/td>/);
 assert.match(renderArticleHtml('| A | B | | --- | --- | | C | D |'),/<table>/);
});

test('duplicate and Urdu headings have unique fragment targets; fenced examples are excluded',()=>{
 const content='## سوال\n\nAnswer\n\n## سوال\n\nMore\n\n```md\n## Example\n```';
 assert.deepEqual(extractHeadings(content).map(h=>h.id),['سوال','سوال-2']);
 const html=renderArticleHtml(content);assert.match(html,/id="سوال-2"/);
});

test('late-published HTML replaces default metadata, exposes a real image and emits complete article schema',()=>{
 const shell='<html><head><meta data-rh="true" name="description" content="Home"><link data-rh="true" rel="canonical" href="https://kmafaq.online/"><script data-rh="true" type="application/ld+json">{"@type":"WebSite"}</script></head><body><div id="root"></div></body></html>';
 const html=renderPublicPage(shell,'blog','valid-slug',{title:'Real article',content:'## Evidence\n\nFacts',cover_image_url:'https://example.org/cover.jpg',source_url:'https://example.org/source',created_at:'2026-10-01',language:'en'});
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.equal((html.match(/name="description"/g)||[]).length,1);
 assert.match(html,/data-rh="true" rel="canonical"/);
 assert.match(html,/name="twitter:title" content="Real article"/);
 assert.match(html,/<img src="https:\/\/example.org\/cover.jpg"/);
 assert.match(html,/rel="author"/);
 const json=JSON.parse(html.match(/<script[^>]+type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(json['@type'],'BlogPosting');assert.equal(json.publisher.name,'KM Afaq');assert.equal(json.image,'https://example.org/cover.jpg');assert.equal(json.citation,'https://example.org/source');
});
