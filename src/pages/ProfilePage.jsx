import { Camera, Globe2, Mail, MapPin, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AccountNav from '../components/AccountNav';
import ProfileCompletion from '../components/ProfileCompletion';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, saveMyProfile } from '../lib/api';
import { uploadMediaToCloudinary } from '../lib/cloudinary';

const EMPTY = {
  username: '', full_name: '', display_name: '', bio: '', avatar_url: '', avatar_public_id: '', avatar_asset_id: '',
  phone: '', country: '', city: '', timezone: 'Asia/Karachi', preferred_language: 'both', website_url: '',
};

const timezones = ['Asia/Karachi','Asia/Dubai','Asia/Tokyo','Asia/Kolkata','Europe/London','Europe/Paris','America/New_York','America/Chicago','America/Los_Angeles','UTC'];

function normalizeUsername(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profile = await getMyProfile(user.id);
        if (!active) return;
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
        setForm({ ...EMPTY, timezone: browserZone, ...(profile ?? {}) });
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  const percent = useMemo(() => {
    const keys = ['full_name','display_name','username','bio','avatar_url','country','timezone','preferred_language'];
    const done = keys.filter((key) => String(form[key] ?? '').trim()).length;
    return Math.round((done / keys.length) * 100);
  }, [form]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Avatar must be 5 MB or smaller.');
    setUploading(true);
    try {
      const media = await uploadMediaToCloudinary(file, { purpose: 'avatar' });
      setForm((current) => ({
        ...current,
        avatar_url: media.url,
        avatar_public_id: media.publicId,
        avatar_asset_id: media.assetId,
      }));
      toast.success('Avatar uploaded. Save your profile to keep it.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (form.username && form.username.length < 3) return toast.error('Username must be at least 3 characters.');
    setSaving(true);
    try {
      const saved = await saveMyProfile(user.id, form);
      setForm({ ...EMPTY, ...saved });
      toast.success('Profile saved.');
    } catch (error) {
      const message = error.code === '23505' ? 'That username is already taken.' : error.message;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-gray-500">Loading profile…</div>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <SEO title="Your profile" path="/profile" noIndex />
      <div className="mb-8">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Account</span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Your profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Keep your account details current so KM Afaq can personalize reading and notifications for you.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <AccountNav />
          <ProfileCompletion percent={percent} />
        </aside>

        <form onSubmit={submit} className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50/70 p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br from-blue-100 to-violet-100 shadow-sm">
                    {form.avatar_url ? <img src={form.avatar_url} alt="Your profile" className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-primary" />}
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-2 -right-2 rounded-xl bg-ink p-2.5 text-white shadow-lg transition hover:bg-gray-700 disabled:opacity-60" aria-label="Change avatar">
                    <Camera className="h-4 w-4" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink">Profile photo</h2>
                  <p className="mt-1 text-sm text-gray-600">JPG, PNG or WebP up to 5 MB. Stored securely on Cloudinary.</p>
                  {uploading && <p className="mt-2 text-xs font-bold text-primary">Uploading…</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
              <label className="text-sm font-bold text-gray-700">Full name
                <input value={form.full_name ?? ''} onChange={(e) => update('full_name', e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="Your full name" />
              </label>
              <label className="text-sm font-bold text-gray-700">Display name
                <input value={form.display_name ?? ''} onChange={(e) => update('display_name', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="How readers should see you" />
              </label>
              <label className="text-sm font-bold text-gray-700">Username
                <div className="mt-2 flex rounded-xl border border-gray-300 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-blue-100">
                  <span className="border-r border-gray-200 px-3 py-3 text-gray-400">@</span>
                  <input value={form.username ?? ''} onChange={(e) => update('username', normalizeUsername(e.target.value))} className="min-w-0 flex-1 rounded-r-xl px-3 py-3 font-normal outline-none" placeholder="kmafaq_reader" />
                </div>
              </label>
              <label className="text-sm font-bold text-gray-700">Email
                <div className="relative mt-2"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input value={user.email ?? ''} readOnly className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 font-normal text-gray-500" /></div>
              </label>
              <label className="text-sm font-bold text-gray-700 sm:col-span-2">Bio
                <textarea value={form.bio ?? ''} onChange={(e) => update('bio', e.target.value.slice(0, 500))} rows={4} className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="A short introduction about you…" />
                <span className="mt-1 block text-right text-xs font-normal text-gray-400">{(form.bio ?? '').length}/500</span>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2 text-secondary"><MapPin className="h-5 w-5" /></div><div><h2 className="font-black text-ink">Location & preferences</h2><p className="text-xs text-gray-500">Used for local time and personalized digests.</p></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-bold text-gray-700">Country<input value={form.country ?? ''} onChange={(e) => update('country', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="Pakistan" /></label>
              <label className="text-sm font-bold text-gray-700">City<input value={form.city ?? ''} onChange={(e) => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="Islamabad" /></label>
              <label className="text-sm font-bold text-gray-700">Timezone<select value={form.timezone ?? 'Asia/Karachi'} onChange={(e) => update('timezone', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100">{[...new Set([form.timezone, ...timezones].filter(Boolean))].map((zone) => <option key={zone}>{zone}</option>)}</select></label>
              <label className="text-sm font-bold text-gray-700">Preferred content language<select value={form.preferred_language ?? 'both'} onChange={(e) => update('preferred_language', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100"><option value="both">Urdu + English</option><option value="ur">Urdu</option><option value="en">English</option></select></label>
              <label className="text-sm font-bold text-gray-700">Phone (optional)<input value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="+92…" /></label>
              <label className="text-sm font-bold text-gray-700">Website (optional)<div className="relative mt-2"><Globe2 className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input value={form.website_url ?? ''} onChange={(e) => update('website_url', e.target.value)} type="url" className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" placeholder="https://…" /></div></label>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-gray-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Your profile is private and protected by Supabase RLS.</p>
            <button disabled={saving || uploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
