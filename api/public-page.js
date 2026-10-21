import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sources, renderPublicPage } from '../server/public-page.js';
export default async function handler(req,res) {
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const {section,slug}=req.query||{};
 const source=Object.hasOwn(sources,section)?sources[section]:null;
 const notFound=()=>{
  res.setHeader('X-Robots-Tag','noindex, follow');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(404).end(req.method==='HEAD'?undefined:'<!doctype html><html lang="en"><head><title>Page not found | KM Afaq</title><meta name="robots" content="noindex,follow"></head><body><h1>Page not found</h1><a href="/">Home</a></body></html>');
 };
 if(!source||typeof slug!=='string'||!slug.trim()||slug.includes('/'))return notFound();
 try {
  const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
  if(!base||!key)throw new Error('Missing public database configuration');
  const url=new URL('/rest/v1/'+source.table,base);
  url.searchParams.set('select','*');url.searchParams.set('slug','eq.'+slug);
  url.searchParams.set('status','eq.'+source.status);url.searchParams.set('limit','1');
  const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Public content query failed: '+response.status);
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('Invalid public content response');
  if(!rows.length)return notFound();
  const shell=await readFile(join(process.cwd(),'dist/app-shell.html'),'utf8');
  const html=renderPublicPage(shell,section,slug,rows[0]);
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).end(req.method==='HEAD'?undefined:html);
 } catch(error) {
  console.error('[public-page]',error.message);res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','300');
  return res.status(503).end(req.method==='HEAD'?undefined:'Page temporarily unavailable');
 }
}
