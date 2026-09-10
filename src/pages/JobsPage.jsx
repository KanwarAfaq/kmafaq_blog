import { ArrowUpRight, BriefcaseBusiness, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { getJobListings } from '../lib/api';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  useEffect(() => { getJobListings().then(setJobs).catch(() => setJobs([])); }, []);

  const filtered = useMemo(() => jobs.filter((job) => {
    if (type !== 'all' && job.employment_type !== type) return false;
    const haystack = `${job.title} ${job.company_name} ${job.location || ''}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [jobs, type, query]);

  return (
    <main className="py-14">
      <SEO title="AI, Tech & Freelance Jobs" path="/jobs" description="Browse AI, technology, remote, internship and freelance opportunities on KM Afaq." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black text-emerald-600">JOBS & FREELANCE</p>
            <h1 className="mt-2 text-4xl font-black text-ink sm:text-5xl">Opportunities for modern digital work</h1>
            <p className="mt-3 max-w-2xl text-gray-600">AI, technology, remote jobs, internships and freelance opportunities.</p>
          </div>
          <Link to="/jobs/post" className="rounded-xl bg-primary px-5 py-3 text-center font-black text-white">Post a job</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, company or location" className="rounded-xl border border-gray-300 px-4 py-3 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold">
            <option value="all">All job types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>

        <div className="mt-7 space-y-4">
          {filtered.map((job) => (
            <article key={job.id} className={`rounded-3xl border bg-white p-5 shadow-sm sm:p-6 ${job.featured ? 'border-amber-200' : 'border-gray-200'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  {job.logo_url ? <img src={job.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><BriefcaseBusiness /></span>}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black text-ink"><Link to={`/jobs/${job.slug}`} className="hover:text-primary">{job.title}</Link></h2>
                      {job.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700"><Sparkles className="h-3 w-3" /> Featured</span> : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-gray-600">{job.company_name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                      <span className="rounded-full bg-gray-100 px-3 py-1">{job.employment_type}</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">{job.work_mode}</span>
                      {job.location ? <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1"><MapPin className="h-3 w-3" /> {job.location}</span> : null}
                      {job.salary_text ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{job.salary_text}</span> : null}
                    </div>
                  </div>
                </div>
                <Link to={`/jobs/${job.slug}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-primary">View job <ArrowUpRight className="h-4 w-4" /></Link>
              </div>
            </article>
          ))}
          {!filtered.length ? <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center text-gray-500"><BriefcaseBusiness className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 font-black text-ink">No matching jobs yet.</p><Link to="/jobs/post" className="mt-2 inline-block text-sm font-black text-primary">Post the first opportunity</Link></div> : null}
        </div>
      </div>
    </main>
  );
}
