import { cleanText, getServerSupabase, normalizeHttpUrl, validEmail } from '../server/_server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const type = cleanText(req.query?.type, 30);
  const id = cleanText(req.query?.id, 80);
  if (!id) return res.status(400).send('Missing id');

  const supabase = getServerSupabase();

  try {
    if (type === 'business') {
      const { data: listing, error } = await supabase
        .from('business_listings')
        .select('id,website_url,status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!listing || listing.status !== 'active' || !listing.website_url) {
        return res.status(404).send('Business website not found');
      }
      try {
        await supabase.rpc('increment_business_click_count', { target_listing_id: listing.id });
      } catch (trackError) {
        console.error('Business click tracking failed:', trackError);
      }
      return res.redirect(listing.website_url);
    }

    if (type === 'tool') {
      const { data: tool, error } = await supabase
        .from('affiliate_tools')
        .select('id,affiliate_url,status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!tool || tool.status !== 'active' || !tool.affiliate_url) return res.status(404).send('Tool not found');
      try {
        await supabase.from('affiliate_clicks').insert({
          tool_id: tool.id,
          referrer: String(req.headers.referer || '').slice(0, 500) || null,
          user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
        });
        await supabase.rpc('increment_affiliate_click_count', { target_tool_id: tool.id });
      } catch (trackError) {
        console.error('Affiliate tracking failed:', trackError);
      }
      return res.redirect(tool.affiliate_url);
    }

    if (type === 'job') {
      const { data: job, error } = await supabase
        .from('job_listings')
        .select('id,apply_url,apply_email,status,expires_at')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!job || (job.expires_at && new Date(job.expires_at).getTime() <= Date.now())) {
        return res.status(404).send('Job is not available');
      }
      await supabase.rpc('increment_job_click', { target_job_id: job.id });
      const destination = job.apply_url || (validEmail(job.apply_email) ? `mailto:${job.apply_email}` : null);
      if (!destination) return res.status(404).send('Application destination is unavailable');
      return res.redirect(destination);
    }

    if (type === 'sponsor') {
      const channel = ['email', 'line', 'web'].includes(req.query?.channel) ? req.query.channel : 'web';
      const { data: campaign, error } = await supabase
        .from('digest_sponsor_campaigns')
        .select('id,cta_url,status,starts_at,ends_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (
        !campaign ||
        campaign.status !== 'active' ||
        new Date(campaign.starts_at).getTime() > Date.now() ||
        (campaign.ends_at && new Date(campaign.ends_at).getTime() <= Date.now())
      ) {
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
    }

    return res.status(400).send('Invalid redirect type');
  } catch (error) {
    console.error('Tracked redirect error:', error);
    return res.status(500).send('Could not open destination');
  }
}
