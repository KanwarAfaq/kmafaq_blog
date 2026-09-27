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
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const publicDir = resolve(process.cwd(), 'public');

const staticRoutes = [
  '/',
  '/blog',
  '/blog/urdu',
  '/blog/english',
  '/services',
  '/about',
  '/contact',
  '/line',
  '/business',
  '/tools',
  '/shop',
  '/jobs',
  '/pricing',
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cleanText(value = '', max = 220) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

async function fetchTable(table, select, filters = [], limit = 1000) {
  if (!supabaseUrl || !supabaseKey) return [];
  const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
  endpoint.searchParams.set('select', select);
  for (const [key, value] of filters) endpoint.searchParams.set(key, value);
  endpoint.searchParams.set('order', 'created_at.desc');
  endpoint.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[seo] Could not fetch ${table}: ${error.message}`);
    return [];
  }
}

const [posts, products, jobs, businesses] = await Promise.all([
  fetchTable('posts', 'slug,title,excerpt,seo_description,language,topic_category,created_at', [['status', 'eq.published']]),
  fetchTable('digital_products', 'slug,name,short_description,created_at', [['status', 'eq.active']]),
  fetchTable('job_listings', 'slug,title,company_name,location,created_at', [['status', 'eq.active']]),
  fetchTable('business_listings', 'slug,name,short_description,category,city,country,created_at', [['status', 'eq.active']]),
]);

const urls = [
  ...staticRoutes.map((route) => ({ loc: `${siteUrl}${route}`, lastmod: null })),
  ...posts.filter((row) => row.slug).map((row) => ({ loc: `${siteUrl}/blog/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...products.filter((row) => row.slug).map((row) => ({ loc: `${siteUrl}/shop/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...jobs.filter((row) => row.slug).map((row) => ({ loc: `${siteUrl}/jobs/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
  ...businesses.filter((row) => row.slug).map((row) => ({ loc: `${siteUrl}/business/${encodeURIComponent(row.slug)}`, lastmod: row.created_at })),
];

const uniqueUrls = Array.from(new Map(urls.map((entry) => [entry.loc, entry])).values());

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls.map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${siteUrl}/sitemap.xml
`;

const latestArticles = posts.slice(0, 30).map((post) => {
  const summary = cleanText(post.seo_description || post.excerpt || '', 180);
  return `- [${cleanText(post.title, 120)}](${siteUrl}/blog/${encodeURIComponent(post.slug)}): ${summary}`;
}).join('\n');

const llms = `# KM Afaq

> Practical AI automation, technology, online earning insights, jobs, tools, business resources, and digital services in Urdu and English.

Canonical site: ${siteUrl}
Primary languages: English (en), Urdu (ur)

## Main sections

- [Home](${siteUrl}/): Overview of KM Afaq, services, and recent articles.
- [Blog](${siteUrl}/blog): Current Urdu and English articles.
- [Urdu Blog](${siteUrl}/blog/urdu): Urdu-language articles.
- [English Blog](${siteUrl}/blog/english): English-language articles.
- [Services](${siteUrl}/services): AI automation, web development, and technology consulting.
- [Jobs](${siteUrl}/jobs): Technology, AI, remote, internship, and freelance opportunities.
- [Business Directory](${siteUrl}/business): Business and service-provider listings.
- [AI Tools](${siteUrl}/tools): Curated AI and software resources.
- [Digital Store](${siteUrl}/shop): Digital products and practical resources.
- [About](${siteUrl}/about): About KM Afaq.
- [Contact](${siteUrl}/contact): Contact and service inquiries.

## Recent articles

${latestArticles || '- Recent article links are available in the XML sitemap.'}

## Crawling

- XML sitemap: ${siteUrl}/sitemap.xml
- Robots policy: ${siteUrl}/robots.txt
`;

await mkdir(publicDir, { recursive: true });
await Promise.all([
  writeFile(resolve(publicDir, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve(publicDir, 'robots.txt'), robots, 'utf8'),
  writeFile(resolve(publicDir, 'llms.txt'), llms, 'utf8'),
]);

console.log(`[seo] Generated sitemap with ${uniqueUrls.length} URL(s) and llms.txt with ${Math.min(posts.length, 30)} article(s).`);
