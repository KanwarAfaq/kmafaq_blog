import {
  cleanText,
  getServerSupabase,
  randomDigits,
  requestIp,
  safeJsonBody,
  sendSmtpMail,
  sha256,
  validEmail,
} from './_server.js';

const PURPOSES = new Set(['login', 'signup', 'reset']);
const OTP_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_HOUR = 5;

function otpHash(email, purpose, code) {
  const pepper = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'km-afaq-local-otp';
  return sha256(`${email}|${purpose}|${code}|${pepper}`);
}

function emailContent(code, purpose) {
  const labels = {
    login: 'sign in to KM Afaq',
    signup: 'create your KM Afaq account',
    reset: 'reset your KM Afaq password',
  };
  const action = labels[purpose] || 'continue with KM Afaq';
  const subject = `KM Afaq verification code: ${code}`;
  const text = `Your KM Afaq code is ${code}. Use it to ${action}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:28px"><div style="font-size:13px;font-weight:800;color:#2563eb">KM AFAQ</div><h1 style="font-size:24px;color:#111827">Your verification code</h1><p style="color:#4b5563">Use this 4-digit code to ${action}.</p><div style="font-size:38px;letter-spacing:12px;font-weight:900;color:#111827;margin:24px 0">${code}</div><p style="color:#6b7280">This code expires in ${OTP_TTL_MINUTES} minutes and can be used once.</p><p style="font-size:12px;color:#9ca3af">If you did not request this, you can safely ignore this email.</p></div></body></html>`;
  return { subject, text, html };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = safeJsonBody(req);
    const email = cleanText(body.email, 200).toLowerCase();
    const purpose = cleanText(body.purpose, 20).toLowerCase();
    if (!validEmail(email) || !PURPOSES.has(purpose)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const supabase = getServerSupabase();
    const { data: exists, error: existsError } = await supabase.rpc('auth_user_exists', { target_email: email });
    if (existsError) throw existsError;

    if (purpose === 'signup' && exists) {
      return res.status(409).json({ error: 'An account already exists for this email. Sign in instead.' });
    }
    if ((purpose === 'login' || purpose === 'reset') && !exists) {
      // Avoid leaking account membership through a different HTTP status.
      return res.status(200).json({ ok: true, message: 'If this account exists, a code has been sent.' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRows, error: recentError } = await supabase
      .from('auth_otp_codes')
      .select('id,created_at')
      .eq('email', email)
      .eq('purpose', purpose)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(MAX_REQUESTS_PER_HOUR + 1);
    if (recentError) throw recentError;

    const recent = recentRows || [];
    if (recent.length >= MAX_REQUESTS_PER_HOUR) {
      return res.status(429).json({ error: 'Too many code requests. Try again later.' });
    }
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' });
    }

    const code = randomDigits(4);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from('auth_otp_codes')
      .insert({
        email,
        purpose,
        code_hash: otpHash(email, purpose, code),
        expires_at: expiresAt,
        request_ip: requestIp(req),
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    try {
      await sendSmtpMail({ to: email, ...emailContent(code, purpose) });
    } catch (mailError) {
      await supabase.from('auth_otp_codes').delete().eq('id', inserted.id);
      throw mailError;
    }

    return res.status(200).json({ ok: true, expires_in: OTP_TTL_MINUTES * 60 });
  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({ error: 'Could not send the verification code.' });
  }
}
