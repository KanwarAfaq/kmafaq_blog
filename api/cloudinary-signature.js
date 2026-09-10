import crypto from 'node:crypto';

const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video']);

function signParams(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

async function getSupabaseUser(accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase server environment variables are missing.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return res.status(401).json({ error: 'Invalid session' });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary server environment variables are missing' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const resourceType = ALLOWED_RESOURCE_TYPES.has(body.resourceType) ? body.resourceType : 'image';
    const purpose = body.purpose === 'avatar' ? 'avatar' : 'content';
    if (purpose === 'content' && user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for content uploads' });
    }
    if (purpose === 'avatar' && resourceType !== 'image') {
      return res.status(400).json({ error: 'Avatar uploads must be images' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = purpose === 'avatar' ? `km-afaq/avatars/${user.id}` : (resourceType === 'video' ? 'km-afaq/videos' : 'km-afaq/images');
    const paramsToSign = { folder, timestamp };
    const signature = signParams(paramsToSign, apiSecret);

    return res.status(200).json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      resourceType,
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    return res.status(500).json({ error: 'Could not create upload signature' });
  }
}
