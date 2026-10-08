import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/sitemap.js';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = body; }
  };
}

test('sitemap returns 503 without database configuration rather than publishing a partial sitemap', async () => {
  const response = mockResponse();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.body, /temporarily unavailable/i);
});

test('sitemap rejects non-GET methods', async () => {
  const response = mockResponse();
  await handler({ method: 'POST' }, response);
  assert.equal(response.statusCode, 405);
});
