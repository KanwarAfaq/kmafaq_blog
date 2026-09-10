import { BadgeDollarSign, BriefcaseBusiness, Building2, Link2, Megaphone, MessageCircle, Package, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import {
  getRevenueDashboardData,
  updateCommentModeration,
  updateCommentReport,
  updateJobListing,
  updateRevenueItem,
} from '../lib/api';

const SALES_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'];
const ORDER_STATUSES = ['new', 'contacted', 'paid', 'delivered', 'cancelled', 'spam'];
const JOB_STATUSES = ['pending', 'active', 'paused', 'rejected', 'expired'];
const REPORT_STATUSES = ['open', 'reviewed', 'dismissed', 'actioned'];

function SelectStatus({ value, options, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold">
      {options.map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  );
}

export default function AdminRevenuePage() {
  const { user } = useAuth();
  const [data, setData] = useState({ sales: [], leads: [], listings: [], tools: [], lineSubscribers: [], productOrders: [], jobs: [], jobSubmissions: [], sponsors: [], commentReports: [] });
  const [loading, setLoading] = useState(true);
  const admin = user?.app_metadata?.role === 'admin';

  const load = async () => {
    try {
      setData(await getRevenueDashboardData());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) load();
    else setLoading(false);
  }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const won = useMemo(() => data.sales.filter((item) => item.status === 'won').length, [data.sales]);
  if (!admin) return <Navigate to="/" replace />;
  if (loading) return <main className="px-4 py-20 text-center font-bold text-gray-500">Loading revenue dashboard…</main>;

  async function setStatus(table, id, status) {
    try {
      await updateRevenueItem(table, id, { status });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function setJobStatus(job, status) {
    try {
      const patch = { status };
      if (status === 'active') {
        patch.featured = job.plan === 'featured';
        if (!job.expires_at || new Date(job.expires_at) <= new Date()) {
          patch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
      await updateJobListing(job.id, patch);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function moderateReport(report, action) {
    try {
      if (action === 'hide' && report.post_comments?.id) {
        await updateCommentModeration(report.post_comments.id, { status: 'hidden' });
        await updateCommentReport(report.id, { status: 'actioned' });
      } else {
        await updateCommentReport(report.id, { status: action });
      }
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  const cards = [
    ['Sales inquiries', data.sales.length, BadgeDollarSign],
    ['Product orders', data.productOrders.length, Package],
    ['Business leads', data.leads.length, Users],
    ['Active jobs', data.jobs.filter((item) => item.status === 'active').length, BriefcaseBusiness],
    ['LINE subscribers', data.lineSubscribers.filter((item) => item.active && item.line_friend).length, MessageCircle],
    ['Affiliate clicks', data.tools.reduce((sum, item) => sum + Number(item.click_count || 0), 0), Link2],
    ['Sponsor clicks', data.sponsors.reduce((sum, item) => sum + Number(item.click_count || 0), 0), Megaphone],
    ['Open comment reports', data.commentReports.filter((item) => item.status === 'open').length, ShieldAlert],
  ];

  return (
    <main className="py-12">
      <SEO title="Revenue Dashboard" path="/admin/revenue" noIndex />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-emerald-600">ADMIN</p>
            <h1 className="mt-2 text-4xl font-black text-ink">Revenue dashboard</h1>
            <p className="mt-2 text-gray-600">Sales, product orders, businesses, jobs, sponsorships and community moderation.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">Won inquiries: {won}</span>
            <Link to="/admin/monetization" className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white">Manage monetization</Link>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-black text-ink">{value}</p>
              <p className="text-xs font-bold text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Sales inquiries</h2>
            <div className="mt-4 space-y-3">
              {data.sales.map((row) => <div key={row.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-ink">{row.name} · {row.product}</p><p className="text-xs text-gray-500">{row.email}{row.company ? ` · ${row.company}` : ''}</p></div><SelectStatus value={row.status} options={SALES_STATUSES} onChange={(status) => setStatus('monetization_requests', row.id, status)} /></div>{row.message ? <p className="mt-2 text-sm text-gray-600">{row.message}</p> : null}</div>)}
              {!data.sales.length ? <p className="text-sm text-gray-500">No sales inquiries yet.</p> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Digital product orders</h2>
            <div className="mt-4 space-y-3">
              {data.productOrders.map((row) => <div key={row.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-ink">{row.digital_products?.name || 'Product'} · {row.amount} {row.currency}</p><p className="text-xs text-gray-500">{row.name} · {row.email}</p></div><SelectStatus value={row.status} options={ORDER_STATUSES} onChange={(status) => setStatus('digital_product_orders', row.id, status)} /></div>{row.message ? <p className="mt-2 text-sm text-gray-600">{row.message}</p> : null}</div>)}
              {!data.productOrders.length ? <p className="text-sm text-gray-500">No digital product orders yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Business leads</h2>
            <div className="mt-4 space-y-3">
              {data.leads.map((row) => <div key={row.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-ink">{row.name} → {row.business_listings?.name || 'Business'}</p><p className="text-xs text-gray-500">{row.email}{row.phone ? ` · ${row.phone}` : ''}</p></div><SelectStatus value={row.status} options={SALES_STATUSES} onChange={(status) => setStatus('business_leads', row.id, status)} /></div><p className="mt-2 text-sm text-gray-600">{row.message}</p></div>)}
              {!data.leads.length ? <p className="text-sm text-gray-500">No business leads yet.</p> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Job submissions</h2>
            <div className="mt-4 space-y-3">
              {data.jobSubmissions.map((submission) => {
                const job = data.jobs.find((item) => item.id === submission.listing_id) || submission.job_listings;
                return <div key={submission.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-ink">{job?.title || 'Job'} · {job?.company_name || 'Company'}</p><p className="text-xs text-gray-500">{submission.contact_name} · {submission.contact_email}</p></div><SelectStatus value={submission.status} options={SALES_STATUSES} onChange={(status) => setStatus('job_submissions', submission.id, status)} /></div>{job?.id ? <div className="mt-3 flex items-center gap-2"><span className="text-xs font-bold text-gray-500">Listing:</span><SelectStatus value={job.status} options={JOB_STATUSES} onChange={(status) => setJobStatus(job, status)} /></div> : null}</div>;
              })}
              {!data.jobSubmissions.length ? <p className="text-sm text-gray-500">No job submissions yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Business performance</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {data.listings.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold text-ink">{item.name}</p><p className="text-xs text-gray-500">{item.plan} · {item.status}</p></div><p className="text-sm font-black text-gray-700">{item.click_count || 0} clicks · {item.lead_count || 0} leads</p></div>)}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Affiliate performance</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {data.tools.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><p className="font-bold text-ink">{item.name}</p><p className="text-sm font-black text-primary">{item.click_count || 0} clicks</p></div>)}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Digest sponsorships</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {data.sponsors.map((item) => <div key={item.id} className="py-3"><div className="flex items-center justify-between gap-4"><div><p className="font-bold text-ink">{item.sponsor_name} · {item.headline}</p><p className="text-xs text-gray-500">{item.status} · {(item.channels || []).join(' + ')}</p></div><p className="text-sm font-black text-primary">{item.impression_count || 0} views · {item.click_count || 0} clicks</p></div></div>)}
              {!data.sponsors.length ? <p className="text-sm text-gray-500">No sponsor campaigns yet.</p> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-ink">Comment reports</h2>
            <div className="mt-4 space-y-3">
              {data.commentReports.map((report) => <div key={report.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-ink">“{report.post_comments?.body || 'Comment unavailable'}”</p><p className="mt-1 text-xs text-gray-500">By {report.post_comments?.author_name || 'Reader'} · Reason: {report.reason}</p><div className="mt-3 flex flex-wrap items-center gap-2"><SelectStatus value={report.status} options={REPORT_STATUSES} onChange={(status) => moderateReport(report, status)} />{report.post_comments?.status === 'published' ? <button type="button" onClick={() => moderateReport(report, 'hide')} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">Hide comment</button> : <span className="text-xs font-bold text-gray-400">Comment: {report.post_comments?.status || 'removed'}</span>}</div></div>)}
              {!data.commentReports.length ? <p className="text-sm text-gray-500">No reported comments.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
