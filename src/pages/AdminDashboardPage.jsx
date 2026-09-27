import { Activity, BriefcaseBusiness, CheckCircle2, Cloud, Database, FileText, Mail, MessageCircle, RefreshCw, Search, Settings2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import AdminShell from '../components/admin/AdminShell';
import { useAuth } from '../contexts/AuthContext';
import { getAdminHealth } from '../lib/adminApi';

function Metric({ label, value, note, icon: Icon, classes }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${classes}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/80 p-2.5 shadow-sm"><Icon className="h-5 w-5" /></div>
        <span className="text-3xl font-black">{value ?? '—'}</span>
      </div>
      <p className="mt-4 font-black">{label}</p>
      <p className="mt-1 text-xs opacity-70">{note}</p>
    </div>
  );
}

function HealthRow({ icon: Icon, label, ok, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`rounded-xl p-2 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-black text-slate-900">{label}</p>
          {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <TriangleAlert className="h-4 w-4 text-amber-500" />}
        </div>
        <p className="mt-1 break-words text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const admin = user?.app_metadata?.role === 'admin';
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setHealth(await getAdminHealth());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (admin) load(); }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!admin) return <Navigate to="/" replace />;

  const metrics = health?.metrics || {};
  const services = health?.services || {};
  const line = services.line || {};

  return (
    <AdminShell
      title="Admin overview"
      description="A single place to publish content, monitor search health, inspect revenue flows, and verify critical integrations."
      actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-900 shadow-lg disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh health</button>}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Published posts" value={metrics.publishedPosts} note="Visible to readers" icon={FileText} classes="border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-950" />
        <Metric label="Draft posts" value={metrics.draftPosts} note="Waiting for publication" icon={Settings2} classes="border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 text-violet-950" />
        <Metric label="LINE subscribers" value={metrics.lineSubscribers} note="Active friends" icon={MessageCircle} classes="border-emerald-100 bg-gradient-to-br from-emerald-50 to-lime-50 text-emerald-950" />
        <Metric label="Active jobs" value={metrics.activeJobs} note="Public job listings" icon={BriefcaseBusiness} classes="border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-950" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-2.5 text-white"><Activity className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-black text-slate-950">System health</h2><p className="text-sm text-slate-500">Live checks from production configuration.</p></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <HealthRow icon={Database} label="Supabase" ok={services.supabase?.ok} detail={services.supabase?.detail || 'Checking database connection…'} />
            <HealthRow icon={Cloud} label="Cloudinary" ok={services.cloudinary?.configured} detail={services.cloudinary?.configured ? 'Signed media uploads configured.' : 'Cloudinary server credentials are incomplete.'} />
            <HealthRow icon={Mail} label="Email / SMTP" ok={services.smtp?.configured} detail={services.smtp?.configured ? 'Digest/OTP email transport configured.' : 'SMTP variables are incomplete.'} />
            <HealthRow icon={Search} label="Google Search Console" ok={services.gsc?.configured} detail={services.gsc?.configured ? `Property: ${services.gsc.site}` : 'Optional service-account connection not configured yet.'} />
            <HealthRow icon={MessageCircle} label="LINE Messaging" ok={Boolean(line.configured && line.tokenValid)} detail={line.tokenValid ? `${line.botName || 'Bot'} · ${line.basicId || 'LINE Official Account'}` : (line.detail || 'LINE token/secret needs configuration.')} />
            <HealthRow icon={Activity} label="LINE webhook" ok={Boolean(line.webhookActive && line.webhookMatches)} detail={line.webhookEndpoint ? `${line.webhookEndpoint}${line.webhookMatches ? ' · correct endpoint' : ' · endpoint mismatch'}` : 'Webhook endpoint could not be verified.'} />
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100">Quick actions</p>
          <h2 className="mt-2 text-2xl font-black">Run the site from here</h2>
          <div className="mt-5 grid gap-3">
            <Link to="/admin/content" className="rounded-2xl bg-white/15 p-4 font-black backdrop-blur transition hover:bg-white/20">Create or edit an article →</Link>
            <Link to="/admin/seo" className="rounded-2xl bg-white/15 p-4 font-black backdrop-blur transition hover:bg-white/20">Review SEO & GSC analytics →</Link>
            <Link to="/admin/revenue" className="rounded-2xl bg-white/15 p-4 font-black backdrop-blur transition hover:bg-white/20">Review revenue operations →</Link>
            <Link to="/line" target="_blank" className="rounded-2xl bg-white/15 p-4 font-black backdrop-blur transition hover:bg-white/20">Test public LINE page →</Link>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
