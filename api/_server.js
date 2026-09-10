import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { createClient } from '@supabase/supabase-js';

export function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getPublicBaseUrl(req) {
  const configured = (process.env.LINE_PUBLIC_BASE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
  if (process.env.LINE_PUBLIC_BASE_URL) return process.env.LINE_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (host) return `${proto}://${host}`;
  return configured || 'http://localhost:5173';
}

export function getRequestBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomDigits(length = 4) {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, '0');
}

export function safeJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function json(res, status, payload) {
  return res.status(status).json(payload);
}

export function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeHttpUrl(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function validHttpUrl(value) {
  return !value || Boolean(normalizeHttpUrl(value));
}

export function requestIp(req) {
  return cleanText(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0], 120) || null;
}

export function slugify(value, fallback = 'item') {
  const slug = cleanText(value, 180)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug || `${fallback}-${Date.now().toString(36)}`;
}

export async function getAuthenticatedUser(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

function encodeHeader(value) {
  const text = String(value || '');
  return /^[\x20-\x7E]*$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function dotStuff(value) {
  return String(value).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function smtpReader(socket) {
  let buffer = '';
  const waiters = [];
  let failure = null;

  function flush() {
    while (waiters.length) {
      const match = buffer.match(/(?:^|\r\n)(\d{3}) ([^\r\n]*)(?:\r\n|$)/m);
      if (!match) break;
      const end = (match.index || 0) + match[0].length;
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end);
      const waiter = waiters.shift();
      waiter.resolve(chunk.trim());
    }
  }

  socket.on('data', (data) => { buffer += data.toString('utf8'); flush(); });
  socket.on('error', (error) => {
    failure = error;
    while (waiters.length) waiters.shift().reject(error);
  });
  socket.on('close', () => {
    if (!failure) {
      const error = new Error('SMTP connection closed unexpectedly.');
      while (waiters.length) waiters.shift().reject(error);
    }
  });

  return () => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    waiters.push({ resolve, reject });
    flush();
  });
}

async function smtpCommand(socket, readResponse, command, expected = ['250']) {
  if (command != null) socket.write(`${command}\r\n`);
  const response = await readResponse();
  const finalLine = response.split(/\r?\n/).at(-1) || '';
  const finalCode = finalLine.slice(0, 3);
  if (!expected.includes(finalCode)) throw new Error(`SMTP ${command || 'connect'} failed: ${response}`);
  return response;
}

async function connectSmtp(host, port, useSsl) {
  const socket = useSsl
    ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
    : net.connect({ host, port });
  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP connection timed out.')));
  await new Promise((resolve, reject) => {
    const readyEvent = useSsl ? 'secureConnect' : 'connect';
    socket.once(readyEvent, resolve);
    socket.once('error', reject);
  });
  return socket;
}

export async function sendSmtpMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST || process.env.SMTP_SERVER;
  const port = Number(process.env.SMTP_PORT || 587);
  const username = process.env.SMTP_USERNAME || '';
  const password = process.env.SMTP_PASSWORD || '';
  const from = process.env.SMTP_FROM || process.env.SENDER_EMAIL || username;
  const useSsl = String(process.env.SMTP_USE_SSL || '').toLowerCase() === 'true' || port === 465;
  const useTls = !useSsl && String(process.env.SMTP_USE_TLS ?? 'true').toLowerCase() !== 'false';
  if (!host || !from) throw new Error('SMTP_HOST and SMTP_FROM are required.');

  let socket = await connectSmtp(host, port, useSsl);
  let readResponse = smtpReader(socket);
  await smtpCommand(socket, readResponse, null, ['220']);
  await smtpCommand(socket, readResponse, `EHLO kmafaq.online`, ['250']);

  if (useTls) {
    await smtpCommand(socket, readResponse, 'STARTTLS', ['220']);
    socket.removeAllListeners('data');
    const upgraded = tls.connect({ socket, servername: host, rejectUnauthorized: true });
    await new Promise((resolve, reject) => {
      upgraded.once('secureConnect', resolve);
      upgraded.once('error', reject);
    });
    socket = upgraded;
    readResponse = smtpReader(socket);
    await smtpCommand(socket, readResponse, 'EHLO kmafaq.online', ['250']);
  }

  if (username) {
    await smtpCommand(socket, readResponse, 'AUTH LOGIN', ['334']);
    await smtpCommand(socket, readResponse, Buffer.from(username).toString('base64'), ['334']);
    await smtpCommand(socket, readResponse, Buffer.from(password).toString('base64'), ['235']);
  }

  await smtpCommand(socket, readResponse, `MAIL FROM:<${from}>`, ['250']);
  await smtpCommand(socket, readResponse, `RCPT TO:<${to}>`, ['250', '251']);
  await smtpCommand(socket, readResponse, 'DATA', ['354']);

  const boundary = `kmafaq-${crypto.randomBytes(12).toString('hex')}`;
  const body = [
    `From: KM Afaq <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text || '', 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html || text || '', 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  socket.write(`${dotStuff(body)}\r\n.\r\n`);
  const dataResponse = await readResponse();
  if (!String(dataResponse.split(/\r?\n/).at(-1) || '').startsWith('250')) {
    throw new Error(`SMTP message rejected: ${dataResponse}`);
  }
  socket.write('QUIT\r\n');
  socket.end();
}
