import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('SEO build retries only missing updated_at and preserves snapshots on other errors',()=>{
 const root=mkdtempSync(join(tmpdir(),'blog-seo-source-'));
 const script=resolve('scripts/generate-seo.mjs');
 try {
  mkdirSync(join(root,'public'));
  const mock=join(root,'fetch.mjs');
  writeFileSync(mock,`globalThis.fetch=async input=>{
   const u=new URL(input);
   if(process.env.SEO_TEST_ERROR)return new Response('{}',{status:503});
   if(u.pathname.endsWith('/posts')&&u.searchParams.get('select').includes('updated_at'))
    return new Response(JSON.stringify({code:'42703',message:'column posts.updated_at does not exist'}),{status:400});
   return new Response(JSON.stringify(u.pathname.endsWith('/posts')?[{slug:'published-post',title:'Existing title',content:'Existing words',language:'ur',created_at:'2026-10-01'}]:[]));
  };`);
  const env={...process.env,SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test',VERCEL:'1'};
  const run=spawnSync(process.execPath,['--import',mock,script],{cwd:root,env,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const manifest=readFileSync(join(root,'public/seo-pages.json'),'utf8');
  assert.ok(JSON.parse(manifest).pages.some(p=>p.path==='/blog/published-post'&&p.content==='Existing words'));
  const failure=spawnSync(process.execPath,['--import',mock,script],{cwd:root,env:{...env,SEO_TEST_ERROR:'1'}});
  assert.notEqual(failure.status,0);
  assert.equal(readFileSync(join(root,'public/seo-pages.json'),'utf8'),manifest);
 }finally{rmSync(root,{recursive:true,force:true});}
});
