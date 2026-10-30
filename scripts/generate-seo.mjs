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

// A missing database must not erase all existing article snapshots during deployment.
if (!supabaseUrl || !supabaseKey) {
  if (process.env.VERCEL) throw new Error('Missing public database configuration for SEO build');
  const cached = JSON.parse(await readFile(resolve(publicDir, 'seo-pages.json'), 'utf8'));
  if (!Array.isArray(cached.pages) || !cached.pages.length) throw new Error('No existing SEO snapshots available');
  console.log('[seo] Local build uses the existing snapshot manifest (database not configured).');
  process.exit(0);
}
async function fetchTable(table, select, filters = []) {
  const rows = [], pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
    endpoint.searchParams.set('select', select);
    for (const [key, value] of filters) endpoint.searchParams.set(key, value);
    endpoint.searchParams.set('order', 'created_at.desc,slug.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const response = await fetch(endpoint, {
      headers: {apikey:supabaseKey, Authorization:`Bearer ${supabaseKey}`},
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Older posts schemas have created_at but no updated_at. Do not hide other failures.
      if (error.code === '42703' && String(error.message).includes('updated_at') && select.split(',').includes('updated_at')) {
        return fetchTable(table, select.split(',').filter(field => field !== 'updated_at').join(','), filters);
      }
      throw new Error(`SEO source ${table} returned ${response.status}; existing snapshots have not been overwritten`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Invalid SEO source ${table}`);
    rows.push(...page);
    if (rows.length > 49000) throw new Error('SEO snapshot capacity exceeded; split before publishing');
    if (page.length < pageSize) return rows;
  }
}

const [posts, products, jobs, businesses] = await Promise.all([
  fetchTable('posts', 'slug,title,content,excerpt,seo_description,language,topic_category,created_at,updated_at,cover_image_url,source_url', [['status', 'eq.published']]),
  fetchTable('digital_products', 'slug,name,short_description,created_at,cover_url,preview_url', [['status', 'eq.active']]),
  fetchTable('job_listings', 'slug,title,company_name,location,created_at,logo_url', [['status', 'eq.active']]),
  fetchTable('business_listings', 'slug,name,short_description,category,city,country,created_at,logo_url,website_url', [['status', 'eq.active']]),
]);


const publicStatic = [
  {path:'/',title:'AI Automation & Technology Guides',description:'AI automation, web development, digital services and practical technology guides by KM Afaq in Urdu and English.'},
  {path:'/blog',title:'Urdu and English News & Technology Articles',description:'Read Urdu and English articles on AI, technology, business, science and world affairs.'},
  {path:'/blog/urdu',title:'اردو بلاگ — ٹیکنالوجی، خبریں اور رہنمائی',description:'اے آئی، ٹیکنالوجی، کاروبار، دنیا اور سائنس پر اردو مضامین۔',language:'ur'},
  {path:'/blog/english',title:'English Articles on AI, Technology and News',description:'English news and helpful articles about AI, technology, business, science and world affairs.'},
  {path:'/services',title:'AI Automation and Web Development Services',description:'AI agents, automation workflows, modern web development and technology consulting from KM Afaq.'},
  {path:'/about',title:'About KM Afaq — AI Automation and Technology',description:'Learn about KM Afaq and his practical AI automation and web development projects.'},
  {path:'/contact',title:'Contact KM Afaq',description:'Contact KM Afaq about AI automation, web development or technology services.'},
  {path:'/line',title:'LINE News and Technology Alerts',description:'Get KM Afaq news and technology updates through LINE.'},
  {path:'/business',title:'Business Directory: Service Providers & Business Listings',description:'Browse a business directory of service providers and business listings on KM Afaq by category and city, and request a quote directly.'},
  {path:'/tools',title:'AI Tools Directory: Curated AI & Software Tools',description:'A curated AI tools directory: AI and software tools selected by KM Afaq for practical workflows and productivity. Some links may be affiliate links.'},
  {path:'/shop',title:'Digital Products and Technology Resources',description:'Explore digital products, templates and practical downloadable resources.'},
  {path:'/jobs',title:'AI, Tech, Remote & Freelance Jobs',description:'Browse AI jobs, technology roles, remote work, internships and freelance opportunities on KM Afaq. Search by title, company or location.'},
  {path:'/pricing',title:'KM Afaq Services, Plans and Pricing',description:'Compare KM Afaq service offerings and business promotion options.'},
];
const snapshotPages = [
  ...publicStatic.map(p=>({...p,kind:'WebPage'})),
  ...posts.filter(p=>p.slug).map(p=>({
    path:'/blog/'+encodeURIComponent(p.slug),kind:'BlogPosting',title:p.title,
    description:p.seo_description||p.excerpt||p.title,content:p.content||'',language:p.language||'en',
    image:p.cover_image_url,source:p.source_url,date:p.created_at,modified:p.updated_at||p.created_at,
    topic:p.topic_category,
  })),
  ...products.filter(p=>p.slug).map(p=>({
    path:'/shop/'+encodeURIComponent(p.slug),kind:'WebPage',title:p.name,
    description:p.short_description||p.name,image:p.cover_url,source:p.preview_url,date:p.created_at,
  })),
  ...jobs.filter(p=>p.slug).map(p=>({
    path:'/jobs/'+encodeURIComponent(p.slug),kind:'WebPage',title:p.title+' at '+(p.company_name||'Employer'),
    description:[p.title,p.company_name,p.location].filter(Boolean).join(' — '),image:p.logo_url,date:p.created_at,
  })),
  ...businesses.filter(p=>p.slug).map(p=>({
    path:'/business/'+encodeURIComponent(p.slug),kind:'WebPage',title:p.name,
    description:p.short_description||p.name,image:p.logo_url,source:p.website_url,date:p.created_at,
  })),
];
// Only published/active records enter the public snapshot manifest; never include profiles.
await mkdir(publicDir,{recursive:true});
await writeFile(resolve(publicDir,'seo-pages.json'),JSON.stringify({
  base:siteUrl,pages:Array.from(new Map(snapshotPages.map(p=>[p.path,p])).values())
}),'utf8');

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
${uniqueUrls.map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod && Number.isFinite(Date.parse(lastmod)) ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}\n  </url>`).join('\n')}
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
