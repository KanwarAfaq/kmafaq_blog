import crypto from 'node:crypto';

function resolveCallbackUrl(req) {
  const host = req.headers.host || '';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (local) return `http://${host}/api/line-callback`;
  if (process.env.LINE_LOGIN_CALLBACK_URL) return process.env.LINE_LOGIN_CALLBACK_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/line-callback`;
}


function encodeState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

async function getSupabaseUser(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase server environment variables are missing.');
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await getSupabaseUser(token);
    if (!user?.id) return res.status(401).json({ error: 'Invalid session' });

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const stateSecret = process.env.LINE_STATE_SECRET;
    const callbackUrl = resolveCallbackUrl(req);
    if (!channelId || !stateSecret) return res.status(500).json({ error: 'LINE Login is not configured yet.' });

    const state = encodeState({ uid: user.id, ts: Date.now(), nonce: crypto.randomBytes(16).toString('hex') }, stateSecret);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: channelId,
      redirect_uri: callbackUrl,
      state,
      scope: 'openid profile',
      bot_prompt: 'aggressive',
    });
    return res.status(200).json({ url: `https://access.line.me/oauth2/v2.1/authorize?${params}` });
  } catch (error) {
    console.error('LINE connect start error:', error);
    return res.status(500).json({ error: 'Could not start LINE connection.' });
  }
}
