import crypto from 'node:crypto';
import { getAuthenticatedUser, getServerSupabase, safeJsonBody, sha256 } from '../server/_server.js';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const LINE_BOT_INFO_URL = 'https://api.line.me/v2/bot/info';

async function lineJson(path, token) {
  const response = await fetch(`https://api.line.me${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `LINE API ${response.status}`);
  return payload;
}

async function publicLineInfo(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
  const configuredUrl = String(process.env.VITE_LINE_OFFICIAL_ACCOUNT_URL || '').trim();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    if (configuredUrl) return res.status(200).json({ configured: true, addFriendUrl: configuredUrl });
    return res.status(200).json({ configured: false });
  }
  try {
    const response = await fetch(LINE_BOT_INFO_URL, { headers: { Authorization: `Bearer ${token}` } });
    const bot = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(bot.message || 'LINE bot info request failed.');
    const basicId = bot.basicId || '';
    const addFriendUrl = configuredUrl || (basicId ? `https://line.me/R/ti/p/${encodeURIComponent(basicId)}` : '');
    return res.status(200).json({
      configured: Boolean(addFriendUrl),
      displayName: bot.displayName || 'KM Afaq',
      pictureUrl: bot.pictureUrl || null,
      basicId: basicId || null,
      addFriendUrl: addFriendUrl || null,
    });
  } catch (error) {
    console.error('LINE public info error:', error);
    if (configuredUrl) return res.status(200).json({ configured: true, addFriendUrl: configuredUrl });
    return res.status(200).json({ configured: false });
  }
}

async function countRows(client, table, filter) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function adminHealth(res) {
  const site = String(process.env.SITE_URL || 'https://kmafaq.online').replace(/\/$/, '');
  const services = {
    supabase: { ok: false, detail: 'Database connection failed.' },
    cloudinary: { configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) },
    smtp: { configured: Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USERNAME)) },
    gsc: { configured: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_BASE64), site: process.env.GSC_SITE_URL || 'sc-domain:kmafaq.online' },
    line: {
      configured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_MESSAGING_CHANNEL_SECRET),
      tokenValid: false,
      webhookActive: false,
      webhookMatches: false,
      expectedWebhook: `${site}/api/line-webhook`,
    },
  };
  const metrics = { publishedPosts: 0, draftPosts: 0, lineSubscribers: 0, activeJobs: 0 };

  try {
    const client = getServerSupabase();
    const [publishedPosts, draftPosts, lineSubscribers, activeJobs] = await Promise.all([
      countRows(client, 'posts', { column: 'status', value: 'published' }),
      countRows(client, 'posts', { column: 'status', value: 'draft' }),
      countRows(client, 'line_subscribers', { column: 'active', value: true }).catch(() => 0),
      countRows(client, 'job_listings', { column: 'status', value: 'active' }).catch(() => 0),
    ]);
    Object.assign(metrics, { publishedPosts, draftPosts, lineSubscribers, activeJobs });
    services.supabase = { ok: true, detail: 'Database and admin service connection are healthy.' };
  } catch (error) {
    services.supabase = { ok: false, detail: error.message };
  }

  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (lineToken) {
    try {
      const bot = await lineJson('/v2/bot/info', lineToken);
      services.line.tokenValid = true;
      services.line.botName = bot.displayName || null;
      services.line.basicId = bot.basicId || null;
      try {
        const webhook = await lineJson('/v2/bot/channel/webhook/endpoint', lineToken);
        services.line.webhookEndpoint = webhook.endpoint || null;
        services.line.webhookActive = Boolean(webhook.active);
        services.line.webhookMatches = String(webhook.endpoint || '').replace(/\/$/, '') === services.line.expectedWebhook;
      } catch (error) {
        services.line.webhookDetail = error.message;
      }
    } catch (error) {
      services.line.detail = error.message;
    }
  } else {
    services.line.detail = 'LINE_CHANNEL_ACCESS_TOKEN is missing.';
  }

  return res.status(200).json({ ok: true, metrics, services, checkedAt: new Date().toISOString() });
}

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

async function googleAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url({ iss: credentials.client_email, scope: GSC_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 });
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${b64url(signer.sign(credentials.private_key))}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Could not authorize Google Search Console.');
  return data.access_token;
}

function dateAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
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

async function adminGsc(res) {
  const credentials = credentialsFromEnv();
  if (!credentials) return res.status(200).json({ configured: false });

  const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:kmafaq.online';
  const token = await googleAccessToken(credentials);
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
}

const TOPICS = new Set(['ai-tech','business','politics','world','sports','science','health','trending']);
const LANGUAGES = new Set(['ur','en']);
const FREQUENCIES = new Set(['daily','weekly','every_15_days','every_30_days','custom_days']);

function tokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return String(req.query?.token || '').trim();
}

async function getSubscriber(token) {
  if (!token) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('line_subscribers')
    .select('id,line_display_name,line_picture_url,line_friend,active,topics,languages,frequency,weekly_day,custom_weekdays,preferred_time,timezone,next_digest_at')
    .eq('preference_token_hash', sha256(token))
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function linePreferencesHandler(req, res) {
  try {
    const token = tokenFromReq(req);
    const subscriber = await getSubscriber(token);
    if (!subscriber) return res.status(401).json({ error: 'This LINE preference link is invalid or expired.' });

    if (req.method === 'GET') return res.status(200).json({ subscriber });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = safeJsonBody(req);
    const topics = Array.isArray(body.topics) ? body.topics.filter((x) => TOPICS.has(x)) : [];
    const languages = Array.isArray(body.languages) ? body.languages.filter((x) => LANGUAGES.has(x)) : [];
    const frequency = FREQUENCIES.has(body.frequency) ? body.frequency : 'daily';
    const weeklyDay = Math.min(6, Math.max(0, Number(body.weekly_day ?? 1)));
    const customWeekdays = Array.isArray(body.custom_weekdays)
      ? [...new Set(body.custom_weekdays.map(Number).filter((x) => x >= 0 && x <= 6))]
      : [];
    const preferredTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.preferred_time || '')) ? body.preferred_time : '09:00';
    const timezone = String(body.timezone || 'Asia/Karachi').trim().slice(0, 64) || 'Asia/Karachi';

    if (!topics.length) return res.status(400).json({ error: 'Choose at least one topic.' });
    if (!languages.length) return res.status(400).json({ error: 'Choose at least one language.' });
    if (frequency === 'custom_days' && !customWeekdays.length) return res.status(400).json({ error: 'Choose at least one day.' });

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('line_subscribers')
      .update({
        active: Boolean(body.active ?? true),
        topics,
        languages,
        frequency,
        weekly_day: weeklyDay,
        custom_weekdays: customWeekdays,
        preferred_time: preferredTime,
        timezone,
        next_digest_at: null,
      })
      .eq('id', subscriber.id)
      .select('id,line_display_name,line_picture_url,line_friend,active,topics,languages,frequency,weekly_day,custom_weekdays,preferred_time,timezone,next_digest_at')
      .single();
    if (error) throw error;
    return res.status(200).json({ subscriber: data });
  } catch (error) {
    console.error('LINE preferences error:', error);
    return res.status(500).json({ error: 'Could not update LINE preferences.' });
  }
}


export default async function handler(req, res) {
  const action = String(req.query?.action || '').trim();

  if (action === 'line-public') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    return publicLineInfo(req, res);
  }

  if (action === 'health' || action === 'gsc') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required.' });
      if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
      if (action === 'health') return adminHealth(res);
      return adminGsc(res);
    } catch (error) {
      console.error('Admin site operation error:', error);
      return res.status(500).json({ error: error.message || 'Site operation failed.' });
    }
  }

  return linePreferencesHandler(req, res);
}
