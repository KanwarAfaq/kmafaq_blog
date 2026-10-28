const SITE_URL = (process.env.SITE_URL || 'https://kmafaq.online').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const escapeXml = (value = '') => String(value)
  .replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD]/gu, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildRss(posts) {
  const dated = posts.find(p => Number.isFinite(Date.parse(p.updated_at || p.created_at)));
  const built = new Date(dated ? (dated.updated_at || dated.created_at) : Date.now()).toUTCString();
  const items = posts.filter(p => p?.slug && p?.title).map((p) => {
    const link = `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`;
    const date = Number.isFinite(Date.parse(p.created_at)) ? `\n      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>` : '';
    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>${date}
      <dc:language>${p.language === 'en' ? 'en' : 'ur'}</dc:language>
      <description>${escapeXml(p.seo_description || p.excerpt || p.title)}</description>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>KM Afaq</title>
    <link>${SITE_URL}/blog</link>
    <description>AI automation, web development and technology guides in English and Urdu.</description>
    <language>en</language>
    <lastBuildDate>${built}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method not allowed');
    return;
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing public database configuration');
    const url = new URL('/rest/v1/posts', SUPABASE_URL);
    url.searchParams.set('select', 'slug,title,excerpt,seo_description,language,created_at,updated_at');
    url.searchParams.set('status', 'eq.published');
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', '50');
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`posts: ${response.status}`);
    const posts = await response.json();
    if (!Array.isArray(posts)) throw new Error('Invalid feed source response');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.end(req.method === 'HEAD' ? undefined : buildRss(posts));
  } catch (error) {
    console.error('[rss]', error.message);
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Feed temporarily unavailable');
  }
}
