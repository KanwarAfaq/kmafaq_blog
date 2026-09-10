import { BellRing, CalendarDays, CheckCircle2, Clock3, Mail, MessageCircle, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import AccountNav from '../components/AccountNav';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { getMyDeliveryLog, getNotificationPreferences, saveNotificationPreferences } from '../lib/api';
import { TOPIC_OPTIONS } from '../lib/topics';

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DEFAULTS = {
  active: true,
  email_enabled: false,
  line_enabled: false,
  line_user_id: null,
  line_display_name: null,
  line_picture_url: null,
  line_friend: false,
  topics: ['ai-tech','business','politics','world','sports','science','health','trending'],
  languages: ['ur','en'],
  frequency: 'daily',
  weekly_day: 1,
  custom_weekdays: [],
  preferred_time: '09:00',
  timezone: 'Asia/Karachi',
};

function Toggle({ checked, onChange, label, description, icon: Icon, disabled = false }) {
  return (
    <label className={`flex items-start gap-4 rounded-2xl border p-4 transition ${checked ? 'border-blue-200 bg-blue-50/60' : 'border-gray-200 bg-white'} ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className={`mt-0.5 rounded-xl p-2 ${checked ? 'bg-white text-primary' : 'bg-gray-100 text-gray-500'}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-ink">{label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span></span>
      <span className={`relative mt-1 h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}><input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></span>
    </label>
  );
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [prefs, log] = await Promise.all([getNotificationPreferences(user.id), getMyDeliveryLog(user.id)]);
        if (!active) return;
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
        setForm({ ...DEFAULTS, timezone: browserZone, ...(prefs ?? {}) });
        setHistory(log);
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  const selectedTopicCount = form.topics?.length ?? 0;
  const scheduleSummary = useMemo(() => {
    const time = (form.preferred_time || '09:00').slice(0, 5);
    if (form.frequency === 'daily') return `Every day at ${time}`;
    if (form.frequency === 'weekly') return `Every ${WEEKDAYS[form.weekly_day]} at ${time}`;
    if (form.frequency === 'every_15_days') return `Every 15 days at ${time}`;
    if (form.frequency === 'every_30_days') return `Every 30 days at ${time}`;
    const days = (form.custom_weekdays || []).map((day) => WEEKDAYS[day]).join(', ') || 'no days selected';
    return `${days} at ${time}`;
  }, [form]);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function toggleTopic(value) {
    setForm((current) => ({ ...current, topics: current.topics.includes(value) ? current.topics.filter((item) => item !== value) : [...current.topics, value] }));
  }
  function toggleLanguage(value) {
    setForm((current) => {
      const next = current.languages.includes(value) ? current.languages.filter((item) => item !== value) : [...current.languages, value];
      return { ...current, languages: next.length ? next : current.languages };
    });
  }
  function toggleWeekday(day) {
    setForm((current) => ({ ...current, custom_weekdays: current.custom_weekdays.includes(day) ? current.custom_weekdays.filter((item) => item !== day) : [...current.custom_weekdays, day].sort() }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedTopicCount) return toast.error('Choose at least one topic.');
    if (form.frequency === 'custom_days' && !form.custom_weekdays.length) return toast.error('Choose at least one custom day.');
    if (!form.email_enabled) return toast.error('Enable email digest here, or use the separate LINE QR subscription page.');
    setSaving(true);
    try {
      const saved = await saveNotificationPreferences(user.id, form);
      setForm({ ...DEFAULTS, ...saved });
      toast.success('Notification preferences saved.');
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-gray-500">Loading notification settings…</div>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <SEO title="Notification settings" path="/profile/notifications" noIndex />
      <div className="mb-8"><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">Personalized digests</span><h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Notification settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Choose what you want to read, where you want it delivered, and exactly when you want to receive it.</p></div>
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start"><AccountNav /></aside>
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-ink">Delivery channels</h2><p className="mt-1 text-sm text-gray-500">Use one or both channels.</p></div><BellRing className="h-6 w-6 text-primary" /></div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Toggle checked={form.email_enabled} onChange={(value) => update('email_enabled', value)} label="Email digest" description={`Send to your verified account email: ${user.email}`} icon={Mail} />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-start gap-4"><span className="rounded-xl bg-white p-2 text-[#06C755]"><MessageCircle className="h-5 w-5" /></span><div><p className="text-sm font-extrabold text-ink">LINE alerts — no login required</p><p className="mt-1 text-xs leading-5 text-gray-500">Scan the LINE QR, add KM Afaq, and choose separate LINE preferences without linking this website account.</p><Link to="/line" className="mt-3 inline-flex rounded-xl bg-[#06C755] px-4 py-2 text-xs font-extrabold text-white">Open LINE QR</Link></div></div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-ink">Topics you care about</h2><p className="mt-1 text-sm text-gray-500">Your digest only includes posts from selected categories.</p>
            <div className="mt-5 flex flex-wrap gap-2">{TOPIC_OPTIONS.filter((item) => item.value !== 'all').map((item) => { const selected = form.topics.includes(item.value); return <button key={item.value} type="button" onClick={() => toggleTopic(item.value)} className={`rounded-full border px-4 py-2 text-sm font-extrabold transition ${selected ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50'}`}>{item.label}</button>; })}</div>
            <div className="mt-6 border-t border-gray-100 pt-5"><p className="text-sm font-extrabold text-ink">Languages</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => toggleLanguage('ur')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${form.languages.includes('ur') ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600'}`}>Urdu</button><button type="button" onClick={() => toggleLanguage('en')} className={`rounded-xl border px-4 py-2 text-sm font-bold ${form.languages.includes('en') ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600'}`}>English</button></div></div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-secondary" /><div><h2 className="text-xl font-black text-ink">Digest schedule</h2><p className="mt-1 text-sm text-gray-500">A quiet, predictable digest instead of constant alerts.</p></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-bold text-gray-700">Frequency<select value={form.frequency} onChange={(e) => update('frequency', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="every_15_days">Every 15 days</option><option value="every_30_days">Every 30 days</option><option value="custom_days">Choose weekdays</option></select></label>
              <label className="text-sm font-bold text-gray-700">Preferred time<div className="relative mt-2"><Clock3 className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input type="time" value={(form.preferred_time || '09:00').slice(0,5)} onChange={(e) => update('preferred_time', e.target.value)} className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" /></div></label>
              {form.frequency === 'weekly' && <label className="text-sm font-bold text-gray-700">Day of week<select value={form.weekly_day} onChange={(e) => update('weekly_day', Number(e.target.value))} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none">{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
              <label className="text-sm font-bold text-gray-700">Timezone<input value={form.timezone} onChange={(e) => update('timezone', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-primary focus:ring-4 focus:ring-blue-100" /></label>
            </div>
            {form.frequency === 'custom_days' && <div className="mt-5"><p className="text-sm font-bold text-gray-700">Choose days</p><div className="mt-3 flex flex-wrap gap-2">{WEEKDAYS.map((day, index) => <button key={day} type="button" onClick={() => toggleWeekday(index)} className={`h-10 min-w-12 rounded-xl border px-3 text-xs font-extrabold ${form.custom_weekdays.includes(index) ? 'border-secondary bg-violet-50 text-secondary' : 'border-gray-200 text-gray-600'}`}>{day}</button>)}</div></div>}
            <div className="mt-6 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Your schedule</p><p className="mt-1 font-extrabold text-ink">{scheduleSummary}</p><p className="mt-1 text-xs text-gray-500">Timezone: {form.timezone}</p></div>
          </section>

          {history.length > 0 && <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-lg font-black text-ink">Recent deliveries</h2><div className="mt-4 divide-y divide-gray-100">{history.slice(0,5).map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-bold text-ink">{item.channel === 'line' ? 'LINE' : 'Email'} · {item.post_count} posts</p><p className="text-xs text-gray-500">{new Date(item.sent_at || item.created_at).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${item.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{item.status}</span></div>)}</div></section>}

          <div className="flex flex-col-reverse gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-gray-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> You can change or pause these preferences anytime.</p><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save notification settings'}</button></div>
        </form>
      </div>
    </main>
  );
}
