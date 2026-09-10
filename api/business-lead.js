import { cleanText, getServerSupabase, safeJsonBody, validEmail } from '../server/_server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = safeJsonBody(req);
    if (body.company_website) return res.status(200).json({ ok: true }); // honeypot
    const listingId = cleanText(body.listing_id, 80);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 200).toLowerCase();
    const phone = cleanText(body.phone, 80) || null;
    const message = cleanText(body.message, 2000);
    if (!listingId || !name || !validEmail(email) || message.length < 10) {
      return res.status(400).json({ error: 'Please provide a valid name, email and message.' });
    }
    const supabase = getServerSupabase();
    const { data: listing, error: listingError } = await supabase
      .from('business_listings').select('id,status').eq('id', listingId).maybeSingle();
    if (listingError) throw listingError;
    if (!listing || listing.status !== 'active') return res.status(404).json({ error: 'Business listing not found.' });
    const { error } = await supabase.from('business_leads').insert({
      listing_id: listingId, name, email, phone, message, source_url: cleanText(body.source_url, 500) || null,
    });
    if (error) throw error;
    try { await supabase.rpc('increment_business_lead_count', { target_listing_id: listingId }); }
    catch (trackError) { console.error('Lead counter update failed:', trackError); }
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Business lead error:', error);
    return res.status(500).json({ error: 'Could not submit your request.' });
  }
}
