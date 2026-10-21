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
