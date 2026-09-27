import { Eye, Image as ImageIcon, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import AdminShell from '../components/admin/AdminShell';
import { useAuth } from '../contexts/AuthContext';
import { deleteAdminPost, getAdminPosts, saveAdminPost } from '../lib/adminApi';
import { uploadMediaToCloudinary } from '../lib/cloudinary';

const TOPICS = ['ai-tech','business','politics','world','sports','science','health','trending'];
const EMPTY = {
  id: null, title: '', slug: '', content: '', excerpt: '', language: 'en', topic_category: 'trending',
  status: 'draft', seo_description: '', cover_image_url: '', cover_image_public_id: '', cover_image_asset_id: '',
};

function slugify(value) {
  return String(value || '').toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function quality(post) {
  const issues = [];
  if (!String(post.cover_image_url || '').trim()) issues.push('image');
  if (String(post.seo_description || '').trim().length < 100) issues.push('SEO');
  if (String(post.excerpt || '').trim().length < 80) issues.push('excerpt');
  if (String(post.content || '').trim().length < 500) issues.push('content');
  return issues;
}

export default function AdminContentPage() {
  const { user } = useAuth();
  const admin = user?.app_metadata?.role === 'admin';
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try { setPosts(await getAdminPosts()); }
    catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (admin) load(); }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!admin) return <Navigate to="/" replace />;

  const filtered = useMemo(() => posts.filter((post) => {
    const matchesText = !query || `${post.title} ${post.slug}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesText && matchesStatus;
  }), [posts, query, statusFilter]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(post) {
    setForm({
      ...EMPTY,
      ...post,
      excerpt: post.excerpt || '',
      seo_description: post.seo_description || '',
      cover_image_url: post.cover_image_url || '',
      cover_image_public_id: post.cover_image_public_id || '',
      cover_image_asset_id: post.cover_image_asset_id || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setForm(EMPTY);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file.');
    if (file.size > 8 * 1024 * 1024) return toast.error('Cover image must be 8 MB or smaller.');
    setUploading(true);
    try {
      const media = await uploadMediaToCloudinary(file, { purpose: 'content' });
      setForm((current) => ({ ...current, cover_image_url: media.url, cover_image_public_id: media.publicId, cover_image_asset_id: media.assetId }));
      toast.success('Cover image uploaded.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    const next = { ...form, slug: form.slug.trim() || slugify(form.title) };
    if (!next.title.trim() || !next.slug || !next.content.trim()) return toast.error('Title, slug and content are required.');
    if (next.status === 'published') {
      const issues = quality(next);
      if (issues.length) return toast.error(`Fix before publishing: ${issues.join(', ')}.`);
    }
    setSaving(true);
    try {
      await saveAdminPost(next, user.id);
      toast.success(next.id ? 'Article updated.' : 'Article created.');
      reset();
      await load();
    } catch (error) {
      toast.error(error.code === '23505' ? 'That slug is already in use.' : error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      await deleteAdminPost(post.id);
      toast.success('Article deleted.');
      if (form.id === post.id) reset();
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  const issues = quality(form);

  return (
    <AdminShell
      title="Content studio"
      description="Create, edit, publish and remove articles with image and SEO quality checks built into the workflow."
      actions={<button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-900"><Plus className="h-4 w-4" /> New article</button>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
        <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">{form.id ? 'Editing article' : 'New article'}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{form.id ? form.title || 'Untitled' : 'Write something useful'}</h2></div>
            {form.id ? <button type="button" onClick={reset} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X className="h-4 w-4" /></button> : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">Title
              <input value={form.title} onChange={(e) => { update('title', e.target.value); if (!form.id && !form.slug) update('slug', slugify(e.target.value)); }} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
            </label>
            <label className="text-sm font-bold text-slate-700">Slug
              <input value={form.slug} onChange={(e) => update('slug', slugify(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
            </label>
            <label className="text-sm font-bold text-slate-700">Status
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
            </label>
            <label className="text-sm font-bold text-slate-700">Language
              <select value={form.language} onChange={(e) => update('language', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"><option value="en">English</option><option value="ur">Urdu</option></select>
            </label>
            <label className="text-sm font-bold text-slate-700">Topic
              <select value={form.topic_category} onChange={(e) => update('topic_category', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">{TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select>
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">Excerpt <span className="font-normal text-slate-400">({form.excerpt.length} chars)</span>
              <textarea rows={3} value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">SEO description <span className="font-normal text-slate-400">({form.seo_description.length} chars)</span>
              <textarea rows={3} value={form.seo_description} onChange={(e) => update('seo_description', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">Article content (Markdown) <span className="font-normal text-slate-400">({form.content.length} chars)</span>
              <textarea rows={18} value={form.content} onChange={(e) => update('content', e.target.value)} dir={form.language === 'ur' ? 'rtl' : 'ltr'} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm font-normal leading-6 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                {form.cover_image_url ? <img src={form.cover_image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-900">Cover image</p>
                <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP. Uploaded securely to Cloudinary.</p>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"><Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload cover'}</button>
                <input ref={fileRef} type="file" accept="image/*" onChange={uploadCover} className="hidden" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">{issues.length ? `Publish guard: fix ${issues.join(', ')}.` : 'Ready for publication checks.'}</p>
            <button disabled={saving || uploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create article')}</button>
          </div>
        </form>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-auto">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">All articles</h2><p className="text-xs text-slate-500">{posts.length} total</p></div>{loading ? <span className="text-xs font-bold text-violet-600">Loading…</span> : null}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px] xl:grid-cols-1">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"><option value="all">All status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
          </div>
          <div className="mt-4 space-y-3">
            {filtered.map((post) => {
              const postIssues = quality(post);
              return <div key={post.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-violet-200 hover:bg-violet-50/30">
                <div className="flex gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">{post.cover_image_url ? <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-5 w-5 text-slate-300" /></div>}</div>
                  <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-black text-slate-900">{post.title}</p><p className="mt-1 truncate text-xs text-slate-400">{post.slug}</p><div className="mt-2 flex flex-wrap gap-1"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{post.status}</span>{postIssues.length ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">{postIssues.length} issue{postIssues.length > 1 ? 's' : ''}</span> : null}</div></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => edit(post)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-50 px-2 py-2 text-xs font-black text-violet-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  {post.status === 'published' ? <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-blue-700"><Eye className="h-3.5 w-3.5" /></a> : null}
                  <button type="button" onClick={() => remove(post)} className="inline-flex items-center justify-center rounded-lg bg-red-50 px-3 py-2 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>;
            })}
            {!filtered.length && !loading ? <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">No matching articles.</p> : null}
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
