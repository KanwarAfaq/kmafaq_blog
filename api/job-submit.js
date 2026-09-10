import {
  cleanText,
  getServerSupabase,
  normalizeHttpUrl,
  safeJsonBody,
  sendSmtpMail,
  slugify,
  validEmail,
} from './_server.js';

const WORK_MODES = new Set(['remote', 'hybrid', 'onsite']);
const TYPES = new Set(['full-time', 'part-time', 'contract', 'internship', 'freelance']);
const PLANS = new Set(['standard', 'featured']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = safeJsonBody(req);
    if (body.company_website_hidden) return res.status(200).json({ ok: true });

    const title = cleanText(body.title, 160);
    const companyName = cleanText(body.company_name, 160);
    const description = cleanText(body.description, 6000);
    const location = cleanText(body.location, 160) || null;
    const workMode = WORK_MODES.has(body.work_mode) ? body.work_mode : 'remote';
    const employmentType = TYPES.has(body.employment_type) ? body.employment_type : 'full-time';
    const applyUrl = body.apply_url ? normalizeHttpUrl(body.apply_url) : null;
    const applyEmail = cleanText(body.apply_email, 200).toLowerCase() || null;
    const salaryText = cleanText(body.salary_text, 160) || null;
    const plan = PLANS.has(body.plan) ? body.plan : 'standard';
    const contactName = cleanText(body.contact_name, 120);
    const contactEmail = cleanText(body.contact_email, 200).toLowerCase();
    const companyWebsite = body.company_website ? normalizeHttpUrl(body.company_website) : null;
    const notes = cleanText(body.notes, 1500) || null;

    if (!title || !companyName || description.length < 30 || !contactName || !validEmail(contactEmail)) {
      return res.status(400).json({ error: 'Please complete the required job and contact fields.' });
    }
    if (!applyUrl && !(applyEmail && validEmail(applyEmail))) {
      return res.status(400).json({ error: 'Add a valid application website or application email.' });
    }
    if (body.apply_url && !applyUrl) return res.status(400).json({ error: 'Application website is not valid.' });
    if (body.company_website && !companyWebsite) return res.status(400).json({ error: 'Company website is not valid.' });

    const supabase = getServerSupabase();
    const slug = `${slugify(`${companyName}-${title}`, 'job')}-${Date.now().toString(36).slice(-6)}`;
    const { data: listing, error: listingError } = await supabase
      .from('job_listings')
      .insert({
        title,
        slug,
        company_name: companyName,
        description,
        location,
        work_mode: workMode,
        employment_type: employmentType,
        apply_url: applyUrl,
        apply_email: applyEmail,
        salary_text: salaryText,
        plan,
        featured: plan === 'featured',
        status: 'pending',
      })
      .select('id,slug')
      .single();
    if (listingError) throw listingError;

    const { error: submissionError } = await supabase.from('job_submissions').insert({
      listing_id: listing.id,
      contact_name: contactName,
      contact_email: contactEmail,
      company_website: companyWebsite,
      notes,
    });
    if (submissionError) {
      await supabase.from('job_listings').delete().eq('id', listing.id);
      throw submissionError;
    }

    const notify = process.env.SALES_NOTIFY_EMAIL || process.env.SMTP_TO || process.env.SMTP_FROM;
    if (notify) {
      sendSmtpMail({
        to: notify,
        subject: `New KM Afaq job submission: ${title}`,
        text: `${companyName} submitted ${title}. Contact: ${contactName} <${contactEmail}>. Plan: ${plan}.`,
        html: `<h2>New job submission</h2><p><strong>${companyName}</strong> submitted <strong>${title}</strong>.</p><p>Contact: ${contactName} (${contactEmail})</p><p>Plan: ${plan}</p>`,
      }).catch((mailError) => console.error('Job notification email failed:', mailError));
    }

    return res.status(201).json({ ok: true, listing_id: listing.id, slug: listing.slug, status: 'pending' });
  } catch (error) {
    console.error('Job submission error:', error);
    return res.status(500).json({ error: 'Could not submit this job.' });
  }
}
