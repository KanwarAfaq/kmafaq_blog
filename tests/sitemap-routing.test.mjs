import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('live sitemap route is not shadowed by a Vite static asset', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const route = (vercel.rewrites || []).find(x => x.source === '/sitemap.xml');
  assert.equal(route?.destination, '/api/sitemap');
  assert.equal(existsSync('dist/sitemap.xml'), false,
    'dist/sitemap.xml shadows /api/sitemap and can publish an incomplete sitemap');
});

test('unknown paths cannot silently become the homepage; supported dynamic routes remain', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(!config.rewrites.some(r => ['/(.*)', '/:path*'].includes(r.source)));
  for (const source of ['/blog/:slug','/business/:slug','/shop/:slug','/jobs/:slug','/line/preferences','/profile/notifications']) {
    assert.ok(config.rewrites.some(r => r.source === source), 'route lost: '+source);
  }
  assert.match(readFileSync('public/404.html','utf8'), /noindex/);
});

test('all static public landing pages serve their own pre-rendered HTML rather than the home shell', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const pages = ['/blog','/blog/urdu','/blog/english','/services','/about','/contact','/line','/business','/tools','/shop','/jobs','/pricing'];
  for(const page of pages){
    const route = config.rewrites.find(r=>r.source===page);
    assert.equal(route?.destination,page+'/index.html','wrong HTML document for '+page);
  }
  for(const route of config.rewrites.filter(r=>pages.includes(r.source))){
    assert.notEqual(route.destination,'/index.html','public listing must not inherit homepage canonical');
  }
});
