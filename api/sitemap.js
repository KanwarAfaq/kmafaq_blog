import rssHandler from '../server/rss.js';
const SITE_URL = (process.env.SITE_URL || 'https://kmafaq.online').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const STATIC_ROUTES = [
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

const SOURCES = [
  { table: 'posts', status: 'published', prefix: '/blog/' },
  { table: 'digital_products', status: 'active', prefix: '/shop/' },
  { table: 'job_listings', status: 'active', prefix: '/jobs/' },
  { table: 'business_listings', status: 'active', prefix: '/business/' },
];

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function fetchRows({ table, status, prefix }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing sitemap database configuration');

  const pageSize = 1000;
  const rows = [];
  let select = 'slug,created_at,updated_at';

  for (let offset = 0; offset < 50000; offset += pageSize) {
    const endpoint = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    endpoint.searchParams.set('select', select);
    endpoint.searchParams.set('status', `eq.${status}`);
    endpoint.searchParams.set('order', 'created_at.desc,slug.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000),
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (error.code === '42703' && String(error.message).includes('updated_at') && select.includes('updated_at')) {
          select = 'slug,created_at';
          offset -= pageSize;
          continue;
        }
        throw new Error(`${table}: ${response.status}`);
      }

      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Invalid sitemap source response');
      rows.push(...page);
      if (rows.length > 49000) throw new Error('Sitemap source capacity exceeded');
      if (page.length < pageSize) break;
    } catch (error) {
      throw new Error(`Sitemap source unavailable: ${error.message}`);
    }
  }

  return rows
    .filter((row) => row?.slug)
    .map((row) => ({
      loc: `${SITE_URL}${prefix}${encodeURIComponent(row.slug)}`,
      lastmod: [row.updated_at, row.created_at].find(value => value && Number.isFinite(Date.parse(value))) || null,
    }));
}

export default async function handler(req, res) {
  // RSS shares this function to stay under the Hobby plan's 12-function limit.
  if ((req.url || '').includes('feed=rss')) return rssHandler(req, res);
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method not allowed');
    return;
  }

  let dynamicGroups;
  try {
    dynamicGroups = await Promise.all(SOURCES.map(fetchRows));
  } catch (error) {
    console.error('[sitemap] Cannot safely publish an incomplete sitemap:', error.message);
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Sitemap temporarily unavailable');
    return;
  }
  const urls = [
    ...STATIC_ROUTES.map((route) => ({ loc: `${SITE_URL}${route}`, lastmod: null })),
    ...dynamicGroups.flat(),
  ];

  const unique = Array.from(new Map(urls.map((entry) => [entry.loc, entry])).values());
  if (unique.length > 50000) {
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.end('Sitemap requires splitting before publication');
    return;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map(({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>
`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(xml);
}
