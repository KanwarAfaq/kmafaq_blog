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
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  const pageSize = 1000;
  const rows = [];

  for (let offset = 0; offset < 50000; offset += pageSize) {
    const endpoint = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    endpoint.searchParams.set('select', 'slug,created_at');
    endpoint.searchParams.set('status', `eq.${status}`);
    endpoint.searchParams.set('order', 'created_at.desc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));

    try {
      const response = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!response.ok) throw new Error(`${table}: ${response.status}`);

      const page = await response.json();
      rows.push(...(page || []));
      if (!Array.isArray(page) || page.length < pageSize) break;
    } catch (error) {
      console.warn('[sitemap]', error.message);
      break;
    }
  }

  return rows
    .filter((row) => row?.slug)
    .map((row) => ({
      loc: `${SITE_URL}${prefix}${encodeURIComponent(row.slug)}`,
      lastmod: row.created_at || null,
    }));
}

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method not allowed');
    return;
  }

  const dynamicGroups = await Promise.all(SOURCES.map(fetchRows));
  const urls = [
    ...STATIC_ROUTES.map((route) => ({ loc: `${SITE_URL}${route}`, lastmod: null })),
    ...dynamicGroups.flat(),
  ];

  const unique = Array.from(new Map(urls.map((entry) => [entry.loc, entry])).values());
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
