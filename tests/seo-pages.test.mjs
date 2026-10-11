import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
test('every SEO snapshot has indexable metadata, focus content, links and valid schema',async()=>{
 const {pages}=JSON.parse(await readFile('public/seo-pages.json','utf8'));
 assert.ok(pages.length>=13,'missing static pages');
 for(const page of pages){
  const path=page.path==='/'?'index.html':page.path.slice(1)+'/index.html';
  const html=await readFile(resolve('dist',path),'utf8');
  assert.ok(html.includes('<h1>'),'missing H1 '+page.path);
  assert.ok(html.includes('<h2>'),'missing H2 '+page.path);
  assert.ok(html.includes('<p>'),'missing first paragraph '+page.path);
  assert.ok(html.includes('rel="canonical"'),'missing canonical '+page.path);
  assert.ok(/<a href="\//.test(html),'missing internal link '+page.path);
  if(page.image&&/^https?:\/\//.test(page.image))assert.ok(html.includes('alt="'),'image has no alt '+page.path);
  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length,'missing schema '+page.path);
  scripts.forEach(m=>assert.equal(JSON.parse(m[1])['@context'],'https://schema.org','invalid schema '+page.path));
 }
});
