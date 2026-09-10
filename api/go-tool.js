import { getServerSupabase } from './_server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const id = String(req.query?.id || '').trim();
    const supabase = getServerSupabase();
    const { data: tool, error } = await supabase
      .from('affiliate_tools').select('id,affiliate_url,status').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!tool || tool.status !== 'active') return res.status(404).send('Tool not found');
    try {
      await supabase.from('affiliate_clicks').insert({
        tool_id: tool.id,
        referrer: String(req.headers.referer || '').slice(0, 500) || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      });
      await supabase.rpc('increment_affiliate_click_count', { target_tool_id: tool.id });
    } catch (trackError) { console.error('Affiliate tracking failed:', trackError); }
    return res.redirect(tool.affiliate_url);
  } catch (error) {
    console.error('Affiliate redirect error:', error);
    return res.status(500).send('Could not open tool');
  }
}
