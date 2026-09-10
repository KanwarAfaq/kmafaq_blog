import { getServerSupabase, safeJsonBody, sha256 } from './_server.js';

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

export default async function handler(req, res) {
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
