import { CheckCircle2, ExternalLink, FileText, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import AdminShell from '../components/admin/AdminShell';
import { useAuth } from '../contexts/AuthContext';
import { getAdminGsc, getAdminPosts } from '../lib/adminApi';

function Card({ label, value, note, tone = 'blue' }) {
  const map = {
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    violet: 'border-violet-100 bg-violet-50 text-violet-950',
  };
  return <div className={`rounded-3xl border p-5 ${map[tone]}`}><p className="text-3xl font-black">{value}</p><p className="mt-2 font-black">{label}</p><p className="mt-1 text-xs opacity-70">{note}</p></div>;
}

export default function AdminSeoPage() {
  const { user } = useAuth();
  const admin = user?.app_metadata?.role === 'admin';
  const [posts, setPosts] = useState([]);
  const [gsc, setGsc] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [postRows, gscData] = await Promise.all([getAdminPosts(), getAdminGsc().catch((error) => ({ configured: false, error: error.message }))]);
      setPosts(postRows);
      setGsc(gscData);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (admin) load(); }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!admin) return <Navigate to="/" replace />;

  const audit = useMemo(() => {
    const published = posts.filter((p) => p.status === 'published');
    return {
      published,
      missingImage: published.filter((p) => !String(p.cover_image_url || '').trim()),
      weakSeo: published.filter((p) => String(p.seo_description || '').trim().length < 100),
      shortExcerpt: published.filter((p) => String(p.excerpt || '').trim().length < 80),
      shortContent: published.filter((p) => String(p.content || '').trim().length < 500),
      healthy: published.filter((p) => String(p.cover_image_url || '').trim() && String(p.seo_description || '').trim().length >= 100 && String(p.excerpt || '').trim().length >= 80 && String(p.content || '').trim().length >= 500),
    };
  }, [posts]);

  const problemMap = new Map();
  [
    ['Missing cover', audit.missingImage],
    ['Weak SEO', audit.weakSeo],
    ['Short excerpt', audit.shortExcerpt],
    ['Short content', audit.shortContent],
  ].forEach(([label, rows]) => rows.forEach((post) => {
    const current = problemMap.get(post.id) || { post, issues: [] };
    current.issues.push(label);
    problemMap.set(post.id, current);
  }));
  const problems = [...problemMap.values()];

  return (
    <AdminShell
      title="SEO & Search"
      description="Content quality checks plus optional live Google Search Console metrics for the canonical kmafaq.online property."
      actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Published" value={audit.published.length} note="Current public articles" tone="blue" />
        <Card label="Healthy content" value={audit.healthy.length} note="Passes image + metadata checks" tone="emerald" />
        <Card label="Missing images" value={audit.missingImage.length} note="Published posts without covers" tone="amber" />
        <Card label="Weak SEO" value={audit.weakSeo.length} note="SEO description below 100 chars" tone="violet" />
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-2.5 text-white"><Search className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-slate-950">Google Search Console</h2><p className="text-sm text-slate-500">Last 28 finalized days when configured.</p></div></div>
        {gsc?.configured ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Clicks" value={gsc.summary?.clicks ?? 0} note="Google organic clicks" tone="blue" />
              <Card label="Impressions" value={gsc.summary?.impressions ?? 0} note="Search result appearances" tone="violet" />
              <Card label="CTR" value={`${((gsc.summary?.ctr || 0) * 100).toFixed(2)}%`} note="Click-through rate" tone="emerald" />
              <Card label="Avg position" value={Number(gsc.summary?.position || 0).toFixed(1)} note="Average Google position" tone="amber" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div><h3 className="font-black text-slate-900">Top pages</h3><div className="mt-3 space-y-2">{(gsc.pages || []).map((row) => <div key={row.page} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-xs font-bold text-slate-700">{row.page}</p><span className="shrink-0 text-xs font-black text-blue-700">{row.clicks} clicks</span></div><p className="mt-1 text-[11px] text-slate-400">{row.impressions} impressions · pos {Number(row.position || 0).toFixed(1)}</p></div>)}</div></div>
              <div><h3 className="font-black text-slate-900">Top queries</h3><div className="mt-3 space-y-2">{(gsc.queries || []).map((row) => <div key={row.query} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold text-slate-700">{row.query}</p><span className="shrink-0 text-xs font-black text-violet-700">{row.impressions} imp.</span></div><p className="mt-1 text-[11px] text-slate-400">{row.clicks} clicks · pos {Number(row.position || 0).toFixed(1)}</p></div>)}</div></div>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-5">
            <p className="font-black text-blue-950">GSC dashboard connection is optional and not configured yet.</p>
            <p className="mt-2 text-sm leading-6 text-blue-800">Add a Google service account with Search Console access, then set <code>GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON</code> and <code>GSC_SITE_URL=sc-domain:kmafaq.online</code> in Vercel.</p>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-violet-600" /><div><h2 className="text-xl font-black text-slate-950">Content audit</h2><p className="text-sm text-slate-500">Only published posts are flagged here.</p></div></div>
        <div className="mt-5 space-y-3">
          {problems.map(({ post, issues }) => <div key={post.id} className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-900">{post.title}</p><p className="mt-1 text-xs text-slate-500">{post.slug}</p><div className="mt-2 flex flex-wrap gap-1">{issues.map((issue) => <span key={issue} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-amber-700 shadow-sm">{issue}</span>)}</div></div><a href={`/admin/content`} className="inline-flex items-center gap-1 text-sm font-black text-violet-700">Fix in content studio <ExternalLink className="h-3.5 w-3.5" /></a></div>)}
          {!problems.length ? <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><p className="font-black">All published posts pass the current quality checks.</p></div> : null}
        </div>
      </section>
    </AdminShell>
  );
}
