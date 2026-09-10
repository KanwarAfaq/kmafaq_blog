import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function loadLocalEnv() {
  try {
    const envText = await readFile(resolve(process.cwd(), '.env'), 'utf8');
    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Local .env is optional; CI/Vercel normally supplies process.env.
  }
}

await loadLocalEnv();

const siteUrl = (process.env.SITE_URL || 'https://kmafaq.online').replace(/\/$/, '');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const publicDir = resolve(process.cwd(), 'public');
const staticRoutes = [
  '/', '/blog', '/blog/urdu', '/blog/english', '/services', '/about', '/contact',
  '/line', '/business', '/tools', '/shop', '/jobs', '/jobs/post', '/pricing',
];

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

async function fetchTable(table, select, filters = []) {
  if (!supabaseUrl || !supabaseKey) return [];
  const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
  endpoint.searchParams.set('select', select);
  for (const [key, value] of filters) endpoint.searchParams.set(key, value);
  endpoint.searchParams.set('order', 'created_at.desc');
  try {
    const response = await fetch(endpoint, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[seo] Could not fetch ${table}: ${error.message}`);
    return [];
  }
}

const [posts, products, jobs, businesses] = await Promise.all([
  fetchTable('posts', 'slug,created_at', [['status', 'eq.published']]),
  fetchTable('digital_products', 'slug,created_at', [['status', 'eq.active']]),
  fetchTable('job_listings', 'slug,created_at', [['status', 'eq.active']]),
  fetchTable('business_listings', 'slug,created_at', [['status', 'eq.active']]),
]);

const urls = [
  ...staticRoutes.map((route) => ({ loc: `${siteUrl}${route}`, lastmod: null })),
  ...posts.map((row) => ({ loc: `${siteUrl}/blog/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...products.map((row) => ({ loc: `${siteUrl}/shop/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...jobs.map((row) => ({ loc: `${siteUrl}/jobs/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...businesses.map((row) => ({ loc: `${siteUrl}/business/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin/
Sitemap: ${siteUrl}/sitemap.xml
`;

await mkdir(publicDir, { recursive: true });
await Promise.all([
  writeFile(resolve(publicDir, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve(publicDir, 'robots.txt'), robots, 'utf8'),
]);

console.log(`[seo] Generated sitemap with ${urls.length} URL(s).`);
