import crypto from 'node:crypto';
import { getServerSupabase, randomToken, sha256 } from '../server/_server.js';

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

function publicBaseUrl(request) {
  const configured = String(process.env.LINE_PUBLIC_BASE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
  return configured || new URL(request.url).origin;
}

async function createPreferenceLink(request, userId, profile) {
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
  return `${publicBaseUrl(request)}/line/preferences?token=${encodeURIComponent(token)}`;
}

async function disableSubscriber(userId) {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('line_subscribers')
    .update({ line_friend: false, active: false, unfollowed_at: new Date().toISOString(), next_digest_at: null })
    .eq('line_user_id', userId);
  if (error) throw error;
}

export async function POST(request) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !accessToken) return Response.json({ error: 'LINE Messaging API is not configured.' }, { status: 500 });

  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature') || '';
  if (!verifySignature(rawBody, signature, secret)) {
    return Response.json({ error: 'Invalid LINE signature' }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody || '{}');
    for (const event of body.events || []) {
      const userId = event.source?.userId;
      if (!userId) continue;

      if (event.type === 'follow') {
        const profile = await getLineProfile(userId, accessToken);
        const link = await createPreferenceLink(request, userId, profile);
        await reply(event.replyToken, `✅ Thanks for adding KM Afaq.\nChoose your topics, language and alert time here:\n${link}`, accessToken);
      } else if (event.type === 'unfollow') {
        await disableSubscriber(userId);
      } else if (event.type === 'message' && event.message?.type === 'text') {
        const text = String(event.message.text || '').trim().toLowerCase();
        if (['settings', 'setting', 'preferences', 'preference', 'manage', 'alerts'].includes(text)) {
          const profile = await getLineProfile(userId, accessToken);
          const link = await createPreferenceLink(request, userId, profile);
          await reply(event.replyToken, `Manage your KM Afaq alerts:\n${link}`, accessToken);
        }
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return Response.json({ error: 'LINE webhook processing failed.' }, { status: 500 });
  }
}
