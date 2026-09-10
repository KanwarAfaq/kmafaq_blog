import { cleanText, getServerSupabase, validEmail } from './_server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const id = cleanText(req.query?.id, 80);
    if (!id) return res.status(400).send('Missing job id');
    const supabase = getServerSupabase();
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
  } catch (error) {
    console.error('Job redirect error:', error);
    return res.status(500).send('Could not open application link');
  }
}
