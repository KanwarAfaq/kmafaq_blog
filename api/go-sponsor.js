import { cleanText, getServerSupabase, normalizeHttpUrl } from './_server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const id = cleanText(req.query?.id, 80);
    const channel = ['email', 'line', 'web'].includes(req.query?.channel) ? req.query.channel : 'web';
    if (!id) return res.status(400).send('Missing campaign id');
    const supabase = getServerSupabase();
    const { data: campaign, error } = await supabase
      .from('digest_sponsor_campaigns')
      .select('id,cta_url,status,starts_at,ends_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!campaign || campaign.status !== 'active' || new Date(campaign.starts_at).getTime() > Date.now() || (campaign.ends_at && new Date(campaign.ends_at).getTime() <= Date.now())) {
      return res.status(404).send('Campaign is not active');
    }
    await Promise.all([
      supabase.rpc('increment_digest_sponsor_click', { target_campaign_id: campaign.id }),
      supabase.from('digest_sponsor_clicks').insert({
        campaign_id: campaign.id,
        channel,
        referrer: req.headers.referer || null,
        user_agent: req.headers['user-agent'] || null,
      }),
    ]);
    const destination = normalizeHttpUrl(campaign.cta_url);
    if (!destination) return res.status(404).send('Sponsor destination is unavailable');
    return res.redirect(destination);
  } catch (error) {
    console.error('Sponsor redirect error:', error);
    return res.status(500).send('Could not open sponsor link');
  }
}
