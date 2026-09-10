import crypto from 'node:crypto';
import { getPublicBaseUrl, getServerSupabase, randomToken, sha256 } from './_server.js';

const REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const PROFILE_URL = 'https://api.line.me/v2/bot/profile';

function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function getLineProfile(userId, token) {
  const response = await fetch(`${PROFILE_URL}/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return {};
  return response.json();
}

async function reply(replyToken, text, token) {
  if (!replyToken || !token) return;
  const response = await fetch(REPLY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!response.ok) console.error('LINE reply failed:', await response.text());
}

async function createPreferenceLink(req, userId, profile) {
  const supabase = getServerSupabase();
  const token = randomToken();
  const now = new Date().toISOString();
  const row = {
    line_user_id: userId,
    line_display_name: profile.displayName || null,
    line_picture_url: profile.pictureUrl || null,
    line_friend: true,
    active: true,
    preference_token_hash: sha256(token),
    followed_at: now,
    unfollowed_at: null,
    next_digest_at: null,
  };
  const { error } = await supabase.from('line_subscribers').upsert(row, { onConflict: 'line_user_id' });
  if (error) throw error;
  return `${getPublicBaseUrl(req)}/line/preferences?token=${encodeURIComponent(token)}`;
}

async function disableSubscriber(userId) {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('line_subscribers')
    .update({ line_friend: false, active: false, unfollowed_at: new Date().toISOString(), next_digest_at: null })
    .eq('line_user_id', userId);
  if (error) throw error;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !accessToken) return res.status(500).json({ error: 'LINE Messaging API is not configured.' });

  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {}));

  if (!verifySignature(raw, req.headers['x-line-signature'], secret)) {
    return res.status(401).json({ error: 'Invalid LINE signature' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(raw.toString('utf8') || '{}');
    for (const event of body.events || []) {
      const userId = event.source?.userId;
      if (!userId) continue;

      if (event.type === 'follow') {
        const profile = await getLineProfile(userId, accessToken);
        const link = await createPreferenceLink(req, userId, profile);
        await reply(event.replyToken, `✅ Thanks for adding KM Afaq.\nChoose your topics, language and alert time here:\n${link}`, accessToken);
      } else if (event.type === 'unfollow') {
        await disableSubscriber(userId);
      } else if (event.type === 'message' && event.message?.type === 'text') {
        const text = String(event.message.text || '').trim().toLowerCase();
        if (['settings', 'setting', 'preferences', 'preference', 'manage', 'alerts'].includes(text)) {
          const profile = await getLineProfile(userId, accessToken);
          const link = await createPreferenceLink(req, userId, profile);
          await reply(event.replyToken, `Manage your KM Afaq alerts:\n${link}`, accessToken);
        }
      }
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return res.status(500).json({ error: 'LINE webhook processing failed.' });
  }
}
