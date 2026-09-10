import crypto from 'node:crypto';
import {
  cleanText,
  getRequestBaseUrl,
  getServerSupabase,
  safeJsonBody,
  sha256,
  validEmail,
} from './_server.js';

const PURPOSES = new Set(['login', 'signup', 'reset']);
const MAX_ATTEMPTS = 5;

function otpHash(email, purpose, code) {
  const pepper = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'km-afaq-local-otp';
  return sha256(`${email}|${purpose}|${code}|${pepper}`);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function safeRedirect(value) {
  const raw = cleanText(value, 500);
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = safeJsonBody(req);
    const email = cleanText(body.email, 200).toLowerCase();
    const purpose = cleanText(body.purpose, 20).toLowerCase();
    const code = cleanText(body.code, 4);
    const password = String(body.password || '');
    const redirectPath = safeRedirect(body.redirect);

    if (!validEmail(email) || !PURPOSES.has(purpose) || !/^\d{4}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 4-digit verification code.' });
    }
    if ((purpose === 'signup' || purpose === 'reset') && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const supabase = getServerSupabase();
    const { data: row, error: findError } = await supabase
      .from('auth_otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'This code has expired. Request a new code.' });
    }
    if (Number(row.attempts || 0) >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    const expected = otpHash(email, purpose, code);
    if (!safeEqual(expected, row.code_hash)) {
      await supabase.from('auth_otp_codes').update({ attempts: Number(row.attempts || 0) + 1 }).eq('id', row.id);
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    if (purpose === 'signup') {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return res.status(400).json({ error: error.message || 'Could not create account.' });
      await supabase.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
      return res.status(200).json({ ok: true, mode: 'password', user_id: data.user?.id || null });
    }

    if (purpose === 'reset') {
      const { data: userId, error: userError } = await supabase.rpc('auth_user_id_by_email', { target_email: email });
      if (userError) throw userError;
      if (!userId) return res.status(400).json({ error: 'Could not reset this account.' });
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
      if (updateError) throw updateError;
      await supabase.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
      return res.status(200).json({ ok: true, mode: 'password-reset' });
    }

    const redirectTo = `${getRequestBaseUrl(req)}${redirectPath}`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      redirectTo,
    });
    if (error) throw error;
    const actionLink = data?.properties?.action_link;
    if (!actionLink) throw new Error('Supabase did not return a login action link.');
    await supabase.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    return res.status(200).json({ ok: true, mode: 'action-link', action_link: actionLink });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ error: 'Could not verify the code.' });
  }
}
