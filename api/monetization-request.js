import { cleanText, getServerSupabase, normalizeHttpUrl, safeJsonBody, validEmail } from './_server.js';

const PRODUCTS = new Set(['premium-alerts','featured-listing','sponsored-post','business-premium','digest-sponsor','featured-job','digital-product']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = safeJsonBody(req);
    if (body.company_website) return res.status(200).json({ ok: true });
    const product = cleanText(body.product, 60);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 200).toLowerCase();
    const company = cleanText(body.company, 160) || null;
    const websiteRaw = cleanText(body.website_url, 500) || null;
    const website = websiteRaw ? normalizeHttpUrl(websiteRaw) : null;
    const budget = cleanText(body.budget, 120) || null;
    const message = cleanText(body.message, 2500) || null;
    if (!PRODUCTS.has(product) || !name || !validEmail(email) || (websiteRaw && !website)) {
      return res.status(400).json({ error: 'Please provide valid inquiry details.' });
    }
    const supabase = getServerSupabase();
    const { error } = await supabase.from('monetization_requests').insert({
      product, name, email, company, website_url: website, budget, message,
    });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Monetization request error:', error);
    return res.status(500).json({ error: 'Could not submit your request.' });
  }
}
