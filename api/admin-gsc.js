import crypto from 'node:crypto';
import { getAuthenticatedUser } from '../server/_server.js';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function b64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  return buffer.toString('base64url');
}

function credentialsFromEnv() {
  const raw = process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || '';
  const encoded = process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_BASE64 || '';
  if (!raw && !encoded) return null;
  const text = raw || Buffer.from(encoded, 'base64').toString('utf8');
  const parsed = JSON.parse(text);
  if (!parsed.client_email || !parsed.private_key) throw new Error('Google service-account JSON is incomplete.');
  return parsed;
}

async function accessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url({ iss: credentials.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${b64url(signer.sign(credentials.private_key))}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Could not authorize Google Search Console.');
  return data.access_token;
}

function dateAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

async function googleJson(url, token, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Google API ${response.status}`);
  return data;
}

function rowToObject(row, dimension) {
  return {
    [dimension]: row.keys?.[0] || '',
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

    const credentials = credentialsFromEnv();
    if (!credentials) return res.status(200).json({ configured: false });
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:kmafaq.online';
    const token = await accessToken(credentials);
    const encodedSite = encodeURIComponent(siteUrl);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;
    const startDate = dateAgo(29);
    const endDate = dateAgo(2);
    const base = { startDate, endDate, type: 'web' };

    const [summaryData, pagesData, queriesData, sitemapData] = await Promise.all([
      googleJson(endpoint, token, { method: 'POST', body: JSON.stringify({ ...base, rowLimit: 1 }) }),
      googleJson(endpoint, token, { method: 'POST', body: JSON.stringify({ ...base, dimensions: ['page'], rowLimit: 10 }) }),
      googleJson(endpoint, token, { method: 'POST', body: JSON.stringify({ ...base, dimensions: ['query'], rowLimit: 10 }) }),
      googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`, token).catch(() => ({ sitemap: [] })),
    ]);
    const summaryRow = summaryData.rows?.[0] || {};
    return res.status(200).json({
      configured: true,
      site: siteUrl,
      startDate,
      endDate,
      summary: {
        clicks: Number(summaryRow.clicks || 0),
        impressions: Number(summaryRow.impressions || 0),
        ctr: Number(summaryRow.ctr || 0),
        position: Number(summaryRow.position || 0),
      },
      pages: (pagesData.rows || []).map((row) => rowToObject(row, 'page')),
      queries: (queriesData.rows || []).map((row) => rowToObject(row, 'query')),
      sitemaps: (sitemapData.sitemap || []).map((item) => ({
        path: item.path,
        lastSubmitted: item.lastSubmitted,
        lastDownloaded: item.lastDownloaded,
        errors: item.errors,
        warnings: item.warnings,
      })),
    });
  } catch (error) {
    console.error('Admin GSC error:', error);
    return res.status(500).json({ error: error.message || 'Could not load Search Console data.' });
  }
}
