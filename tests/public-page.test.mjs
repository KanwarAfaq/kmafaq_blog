import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/public-page.js';
import {renderPublicPage} from '../server/public-page.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},end(body=''){this.body=body}});
test('late published articles get canonical HTML in their language without script injection',()=>{
 const shell='<html lang="en"><head><title>Home</title><link rel="canonical" href="https://kmafaq.online/"></head><body><div id="root"></div></body></html>';
 const html=renderPublicPage(shell,'blog','original-slug',{title:'Original <title>',content:'Original words <script>alert(1)</script>',language:'ur'});
 assert.match(html,/<html lang="ur" dir="rtl">/);assert.match(html,/href="https:\/\/kmafaq.online\/blog\/original-slug"/);assert.match(html,/Original words/);assert.doesNotMatch(html,/alert\(1\)/);
});
test('only published content is requested; unknown slugs are 404; outages are 503',async t=>{
 const old={...process.env};process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_ANON_KEY='test';t.after(()=>{process.env=old});
 const mock=t.mock.method(globalThis,'fetch',async u=>{assert.equal(u.searchParams.get('status'),'eq.published');return new Response('[]')});
 const res=response();await handler({method:'GET',query:{section:'blog',slug:'missing'}},res);assert.equal(res.statusCode,404);assert.match(res.headers['X-Robots-Tag'],/noindex/);
 mock.mock.mockImplementation(async()=>new Response('{}',{status:503}));
 const error=response();await handler({method:'GET',query:{section:'blog',slug:'known'}},error);assert.equal(error.statusCode,503);assert.equal(error.headers['Cache-Control'],'no-store');
});
