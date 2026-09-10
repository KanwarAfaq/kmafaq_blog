import crypto from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import lineWebhookHandler from './api/line-webhook.js';
import linePreferencesHandler from './api/line-preferences.js';
import businessLeadHandler from './api/business-lead.js';
import monetizationRequestHandler from './api/monetization-request.js';
import goHandler from './api/go.js';
import authRequestOtpHandler from './api/auth-request-otp.js';
import authVerifyOtpHandler from './api/auth-verify-otp.js';
import productOrderHandler from './api/product-order.js';
import jobSubmitHandler from './api/job-submit.js';
import goJobHandler from './api/go-job.js';
import goSponsorHandler from './api/go-sponsor.js';

function vercelResponseAdapter(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };
  res.send = (payload = '') => {
    if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
      return;
    }
    res.end(payload);
  };
  res.redirect = (location) => {
    res.statusCode = 302;
    res.setHeader('Location', location);
    res.end();
  };
  return res;
}

async function prepareVercelLikeRequest(req) {
  const host = req.headers.host || 'localhost:5173';
  const parsed = new URL(req.url || '/', `http://${host}`);
  req.query = Object.fromEntries(parsed.searchParams.entries());

  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks);
    req.rawBody = rawBody;
    const contentType = String(req.headers['content-type'] || '');
    if (!rawBody.length) {
      req.body = {};
    } else if (contentType.includes('application/json')) {
      try { req.body = JSON.parse(rawBody.toString('utf8')); } catch { req.body = {}; }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(rawBody.toString('utf8')).entries());
    } else {
      req.body = rawBody.toString('utf8');
    }
  }
}

function localServerApi(env) {
  const routes = [
    ['/api/line-webhook', lineWebhookHandler],
    ['/api/line-preferences', linePreferencesHandler],
    ['/api/business-lead', businessLeadHandler],
    ['/api/monetization-request', monetizationRequestHandler],
    ['/api/go', goHandler],
    ['/api/auth-request-otp', authRequestOtpHandler],
    ['/api/auth-verify-otp', authVerifyOtpHandler],
    ['/api/product-order', productOrderHandler],
    ['/api/job-submit', jobSubmitHandler],
    ['/api/go-job', goJobHandler],
    ['/api/go-sponsor', goSponsorHandler],
  ];

  return {
    name: 'local-server-api',
    configureServer(server) {
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      for (const [path, handler] of routes) {
        server.middlewares.use(path, async (req, res) => {
          try {
            await prepareVercelLikeRequest(req);
            await handler(req, vercelResponseAdapter(res));
          } catch (error) {
            console.error(`Local API error for ${path}:`, error);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Local API handler failed.' }));
            }
          }
        });
      }
    },
  };
}

function cloudinaryDevApi(env) {
  return {
    name: 'cloudinary-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/cloudinary-signature', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          let rawBody = '';
          for await (const chunk of req) rawBody += chunk;
          const body = rawBody ? JSON.parse(rawBody) : {};
          const authHeader = req.headers.authorization || '';
          const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
          if (!accessToken) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Authentication required' }));
            return;
          }
          const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
          const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
          const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
          });
          if (!userResponse.ok) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid session' }));
            return;
          }
          const user = await userResponse.json();
          const cloudName = env.CLOUDINARY_CLOUD_NAME;
          const apiKey = env.CLOUDINARY_API_KEY;
          const apiSecret = env.CLOUDINARY_API_SECRET;
          if (!cloudName || !apiKey || !apiSecret) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Cloudinary environment variables are missing' }));
            return;
          }
          const resourceType = body.resourceType === 'video' ? 'video' : 'image';
          const purpose = body.purpose === 'avatar' ? 'avatar' : 'content';
          if (purpose === 'content' && user.app_metadata?.role !== 'admin') {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Admin access required for content uploads' }));
            return;
          }
          if (purpose === 'avatar' && resourceType !== 'image') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Avatar uploads must be images' }));
            return;
          }
          const timestamp = Math.floor(Date.now() / 1000);
          const folder = purpose === 'avatar'
            ? `km-afaq/avatars/${user.id}`
            : resourceType === 'video' ? 'km-afaq/videos' : 'km-afaq/images';
          const payload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
          const signature = crypto.createHash('sha1').update(payload).digest('hex');
          res.statusCode = 200;
          res.end(JSON.stringify({ cloudName, apiKey, timestamp, folder, signature, resourceType }));
        } catch (error) {
          console.error(error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Could not create Cloudinary signature' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), cloudinaryDevApi(env), localServerApi(env)],
    server: { port: 5173, host: true, allowedHosts: ['.trycloudflare.com'] },
    build: { sourcemap: false, target: 'es2020' },
  };
});
