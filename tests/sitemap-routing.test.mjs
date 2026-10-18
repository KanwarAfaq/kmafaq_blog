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
