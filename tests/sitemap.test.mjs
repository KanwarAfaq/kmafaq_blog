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

test('sitemap uses actual modification dates and tolerates only the known missing-column schema', async t => {
  const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
  process.env.SUPABASE_URL='https://example.test';process.env.SUPABASE_ANON_KEY='fixture';
  t.after(()=>{
    if(previous.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previous.url;
    if(previous.key===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=previous.key;
  });
  const {default: configuredHandler}=await import('../api/sitemap.js?modified-date-test');
  let postAttempts=0;
  const mock=t.mock.method(globalThis,'fetch',async endpoint=>{
    const table=endpoint.pathname.split('/').at(-1);
    if(table==='posts'){
      postAttempts++;
      if(endpoint.searchParams.get('select').includes('updated_at'))return new Response(JSON.stringify({code:'42703',message:'column posts.updated_at does not exist'}),{status:400});
      assert.equal(endpoint.searchParams.get('status'),'eq.published');
      return new Response(JSON.stringify([{slug:'original-slug',created_at:'2026-10-01'}]));
    }
    return new Response(JSON.stringify(table==='digital_products'?[{slug:'resource',created_at:'2026-10-01',updated_at:'2026-10-22'}]:[]));
  });
  const response=mockResponse();await configuredHandler({method:'GET'},response);
  assert.equal(response.statusCode,200);assert.equal(postAttempts,2);
  assert.match(response.body,/2026-10-22T00:00:00.000Z/);assert.match(response.body,/\/blog\/original-slug/);
  mock.mock.mockImplementation(async()=>new Response(JSON.stringify({code:'42501',message:'access denied'}),{status:403}));
  const denied=mockResponse();await configuredHandler({method:'GET'},denied);
  assert.equal(denied.statusCode,503);assert.equal(denied.headers['cache-control'],'no-store');
  mock.mock.mockImplementation(async()=>new Response('{}'));
  const invalid=mockResponse();await configuredHandler({method:'GET'},invalid);assert.equal(invalid.statusCode,503);
});
