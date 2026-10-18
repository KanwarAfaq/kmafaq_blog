/**
 * Vite copies public/sitemap.xml into dist. Vercel prefers that file over the
 * intended /sitemap.xml -> /api/sitemap rewrite, leaving Google's sitemap stale.
 * Keep the checked-in fallback/source XML but never deploy it as a static asset.
 * The public route must resolve through the live /api/sitemap handler.
 */
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

await rm(resolve('dist', 'sitemap.xml'), { force: true });
console.log('[seo] Removed static dist/sitemap.xml so Vercel serves the dynamic API sitemap.');
