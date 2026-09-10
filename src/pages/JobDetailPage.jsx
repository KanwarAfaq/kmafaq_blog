import { ArrowLeft, BriefcaseBusiness, CalendarDays, ExternalLink, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import SEO from '../components/SEO';
import { getJobBySlug } from '../lib/api';

export default function JobDetailPage() {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getJobBySlug(slug).then(setJob).catch(() => setJob(null)).finally(() => setLoading(false)); }, [slug]);

  if (loading) return <Loader label="Loading job…" />;
  if (!job) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-3xl font-black text-ink">Job not found</h1><Link to="/jobs" className="mt-5 inline-block font-black text-primary">Back to jobs</Link></main>;

  return (
    <main className="py-12">
      <SEO title={`${job.title} at ${job.company_name}`} path={`/jobs/${job.slug}`} description={`${job.title} opportunity at ${job.company_name}.`} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-black text-primary"><ArrowLeft className="h-4 w-4" /> Back to jobs</Link>
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              {job.logo_url ? <img src={job.logo_url} alt="" className="h-14 w-14 rounded-2xl object-contain" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><BriefcaseBusiness /></span>}
              <div>
                <div className="flex flex-wrap gap-2">{job.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"><Sparkles className="h-3.5 w-3.5" /> Featured job</span> : null}</div>
                <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">{job.title}</h1>
                <p className="mt-2 text-lg font-bold text-gray-600">{job.company_name}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-gray-600">
              <span className="rounded-full bg-gray-100 px-3 py-1.5">{job.employment_type}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1.5">{job.work_mode}</span>
              {job.location ? <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5"><MapPin className="h-3.5 w-3.5" /> {job.location}</span> : null}
              {job.salary_text ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{job.salary_text}</span> : null}
            </div>
            <div className="article-prose mt-8"><ReactMarkdown remarkPlugins={[remarkGfm]}>{job.description}</ReactMarkdown></div>
          </article>

          <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Opportunity</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-gray-600"><CalendarDays className="h-4 w-4" /> Posted {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(job.created_at))}</p>
            <a href={`/api/go?type=job&id=${encodeURIComponent(job.id)}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white">Apply now <ExternalLink className="h-4 w-4" /></a>
            <p className="mt-3 text-xs leading-5 text-gray-400">Applications are handled by the employer. KM Afaq does not guarantee hiring outcomes.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
