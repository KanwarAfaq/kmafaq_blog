import { getAuthenticatedUser, getServerSupabase } from '../server/_server.js';

async function countRows(client, table, filter) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function lineJson(path, token) {
  const response = await fetch(`https://api.line.me${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `LINE API ${response.status}`);
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    if (user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

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
  } catch (error) {
    console.error('Admin health error:', error);
    return res.status(500).json({ error: 'Could not run admin health checks.' });
  }
}
