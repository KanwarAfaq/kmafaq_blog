const BOT_INFO_URL = 'https://api.line.me/v2/bot/info';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');

  const configuredUrl = String(process.env.VITE_LINE_OFFICIAL_ACCOUNT_URL || '').trim();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    if (configuredUrl) return res.status(200).json({ configured: true, addFriendUrl: configuredUrl });
    return res.status(200).json({ configured: false });
  }

  try {
    const response = await fetch(BOT_INFO_URL, { headers: { Authorization: `Bearer ${token}` } });
    const bot = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(bot.message || 'LINE bot info request failed.');
    const basicId = bot.basicId || '';
    const addFriendUrl = configuredUrl || (basicId ? `https://line.me/R/ti/p/${encodeURIComponent(basicId)}` : '');
    return res.status(200).json({
      configured: Boolean(addFriendUrl),
      displayName: bot.displayName || 'KM Afaq',
      pictureUrl: bot.pictureUrl || null,
      basicId: basicId || null,
      addFriendUrl: addFriendUrl || null,
    });
  } catch (error) {
    console.error('LINE public info error:', error);
    if (configuredUrl) return res.status(200).json({ configured: true, addFriendUrl: configuredUrl });
    return res.status(200).json({ configured: false });
  }
}
