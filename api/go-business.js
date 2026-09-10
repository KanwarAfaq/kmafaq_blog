import { getServerSupabase } from './_server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const id = String(req.query?.id || '').trim();
    const supabase = getServerSupabase();
    const { data: listing, error } = await supabase
      .from('business_listings')
      .select('id,website_url,status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!listing || listing.status !== 'active' || !listing.website_url) return res.status(404).send('Business website not found');
    try { await supabase.rpc('increment_business_click_count', { target_listing_id: listing.id }); }
    catch (trackError) { console.error('Business click tracking failed:', trackError); }
    return res.redirect(listing.website_url);
  } catch (error) {
    console.error('Business redirect error:', error);
    return res.status(500).send('Could not open business website');
  }
}
