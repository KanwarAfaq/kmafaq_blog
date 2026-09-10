import crypto from 'node:crypto';

function resolveCallbackUrl(req) {
  const host = req.headers.host || '';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (local) return `http://${host}/api/line-callback`;
  if (process.env.LINE_LOGIN_CALLBACK_URL) return process.env.LINE_LOGIN_CALLBACK_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/line-callback`;
}


function verifyState(state, secret) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.uid || !payload.ts || Date.now() - payload.ts > 10 * 60 * 1000) return null;
  return payload;
}

async function upsertLinePreference(userId, data) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase service credentials are missing.');
  const response = await fetch(`${supabaseUrl}/rest/v1/notification_preferences?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!response.ok) throw new Error(`Supabase preference update failed: ${await response.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const stateSecret = process.env.LINE_STATE_SECRET;
  const payload = verifyState(req.query.state, stateSecret || '');
  if (!payload) return res.redirect('/profile/notifications?line=error');

  try {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const callbackUrl = resolveCallbackUrl(req);
    if (!channelId || !channelSecret) throw new Error('LINE Login server credentials are missing.');

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: req.query.code, redirect_uri: callbackUrl, client_id: channelId, client_secret: channelSecret }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || 'LINE token exchange failed.');

    const [profileResponse, friendshipResponse] = await Promise.all([
      fetch('https://api.line.me/oauth2/v2.1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } }),
      fetch('https://api.line.me/friendship/v1/status', { headers: { Authorization: `Bearer ${tokens.access_token}` } }),
    ]);
    const profile = await profileResponse.json();
    const friendship = friendshipResponse.ok ? await friendshipResponse.json() : { friendFlag: false };
    if (!profileResponse.ok || !profile.sub) throw new Error('Could not read LINE profile.');

    await upsertLinePreference(payload.uid, {
      line_user_id: profile.sub,
      line_display_name: profile.name || null,
      line_picture_url: profile.picture || null,
      line_friend: Boolean(friendship.friendFlag),
      line_enabled: Boolean(friendship.friendFlag),
      line_connected_at: new Date().toISOString(),
      next_digest_at: null,
    });
    return res.redirect(`/profile/notifications?line=${friendship.friendFlag ? 'connected' : 'friend-required'}`);
  } catch (error) {
    console.error('LINE callback error:', error);
    return res.redirect('/profile/notifications?line=error');
  }
}
