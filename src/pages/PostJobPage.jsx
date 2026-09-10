import { BriefcaseBusiness, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { submitJobListing } from '../lib/api';

const INITIAL = {
  title: '', company_name: '', description: '', location: '', work_mode: 'remote', employment_type: 'full-time',
  apply_url: '', apply_email: '', salary_text: '', plan: 'standard', contact_name: '', contact_email: '', company_website: '', notes: '', company_website_hidden: '',
};

export default function PostJobPage() {
  const [form, setForm] = useState(INITIAL);
  const [sending, setSending] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    try {
      await submitJobListing(form);
      toast.success('Job submitted for review.');
      setForm(INITIAL);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="py-14">
      <SEO title="Post a Job" path="/jobs/post" description="Submit a job, internship or freelance opportunity to KM Afaq." />
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link to="/jobs" className="text-sm font-black text-primary">← Back to jobs</Link>
        <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><BriefcaseBusiness /></div>
          <h1 className="mt-4 text-3xl font-black text-ink">Post a job or freelance opportunity</h1>
          <p className="mt-2 text-gray-600">Standard submissions are reviewed before publication. Featured listings receive priority placement and can be invoiced manually until checkout is connected.</p>

          <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
            <input required placeholder="Job title *" value={form.title} onChange={set('title')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input required placeholder="Company name *" value={form.company_name} onChange={set('company_name')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <select value={form.employment_type} onChange={set('employment_type')} className="rounded-xl border border-gray-300 px-4 py-3"><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="freelance">Freelance</option></select>
            <select value={form.work_mode} onChange={set('work_mode')} className="rounded-xl border border-gray-300 px-4 py-3"><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
            <input placeholder="Location" value={form.location} onChange={set('location')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Salary / budget (e.g. $2k-$3k/mo)" value={form.salary_text} onChange={set('salary_text')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <textarea required minLength={30} rows={7} placeholder="Job description, requirements and responsibilities *" value={form.description} onChange={set('description')} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
            <input placeholder="Application website (example.com/apply)" value={form.apply_url} onChange={set('apply_url')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input type="email" placeholder="OR application email" value={form.apply_email} onChange={set('apply_email')} className="rounded-xl border border-gray-300 px-4 py-3" />

            <div className="rounded-2xl border border-gray-200 p-4 sm:col-span-2">
              <p className="font-black text-ink">Listing plan</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-4 ${form.plan === 'standard' ? 'border-primary bg-blue-50' : 'border-gray-200'}`}><input type="radio" name="plan" value="standard" checked={form.plan === 'standard'} onChange={set('plan')} className="me-2" /><strong>Standard</strong><p className="mt-1 text-xs text-gray-500">Normal board placement.</p></label>
                <label className={`cursor-pointer rounded-xl border p-4 ${form.plan === 'featured' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}><input type="radio" name="plan" value="featured" checked={form.plan === 'featured'} onChange={set('plan')} className="me-2" /><strong className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" /> Featured — $49 / 30 days</strong><p className="mt-1 text-xs text-gray-500">Priority placement and Featured badge.</p></label>
              </div>
            </div>

            <h2 className="mt-2 text-xl font-black text-ink sm:col-span-2">Employer contact</h2>
            <input required placeholder="Contact name *" value={form.contact_name} onChange={set('contact_name')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input required type="email" placeholder="Contact email *" value={form.contact_email} onChange={set('contact_email')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Company website (any domain format)" value={form.company_website} onChange={set('company_website')} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input tabIndex="-1" autoComplete="off" value={form.company_website_hidden} onChange={set('company_website_hidden')} className="hidden" />
            <textarea rows={3} placeholder="Notes for KM Afaq" value={form.notes} onChange={set('notes')} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
            <button disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white sm:col-span-2"><Send className="h-4 w-4" /> {sending ? 'Submitting…' : 'Submit job for review'}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
