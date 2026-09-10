import { Save, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { TOPIC_OPTIONS } from '../lib/topics';

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DEFAULT = { active: true, topics: ['ai-tech','business','politics','world','sports','science','health','trending'], languages: ['ur','en'], frequency: 'daily', weekly_day: 1, custom_weekdays: [], preferred_time: '09:00', timezone: 'Asia/Karachi' };

export default function LinePreferencesPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState(DEFAULT);
  const [subscriber, setSubscriber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const topics = useMemo(() => TOPIC_OPTIONS.filter((x) => x.value !== 'all'), []);

  useEffect(() => {
    fetch(`/api/line-preferences?token=${encodeURIComponent(token)}`)
      .then(async (r) => { const p = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p.error || 'Invalid preference link.'); return p; })
      .then(({ subscriber: row }) => { setSubscriber(row); setForm({ ...DEFAULT, ...row, preferred_time: String(row.preferred_time || '09:00').slice(0,5) }); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (key, value) => setForm((old) => ({ ...old, [key]: old[key].includes(value) ? old[key].filter((x) => x !== value) : [...old[key], value] }));
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch('/api/line-preferences', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const p = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p.error || 'Could not save settings.');
      setSubscriber(p.subscriber); toast.success('LINE alert preferences saved.');
    } catch (e2) { toast.error(e2.message); } finally { setSaving(false); }
  };

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-20 text-center font-bold text-gray-500">Loading LINE preferences…</main>;
  if (!subscriber) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-3xl font-black text-ink">Invalid LINE settings link</h1><p className="mt-3 text-gray-600">Type <b>settings</b> in the KM Afaq LINE chat to receive a fresh private link.</p></main>;

  return (
    <main className="py-14"><SEO title="LINE Preferences" path="/line/preferences" noIndex />
      <form onSubmit={save} className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black text-emerald-600">LINE subscriber</p><h1 className="mt-2 text-3xl font-black text-ink">Choose your alerts</h1><p className="mt-2 text-gray-600">{subscriber.line_display_name ? `Hi ${subscriber.line_display_name}. ` : ''}No website account is required.</p>
          <label className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm((x) => ({ ...x, active: e.target.checked }))} /> Alerts active</label>
        </section>
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-lg font-black text-ink">Topics</h2><div className="mt-4 flex flex-wrap gap-2">{topics.map((t) => <button type="button" key={t.value} onClick={() => toggle('topics', t.value)} className={`rounded-xl border px-3 py-2 text-sm font-black ${form.topics.includes(t.value) ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600'}`}>{t.label}</button>)}</div></section>
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-lg font-black text-ink">Language & schedule</h2><div className="mt-4 flex gap-2">{[['ur','Urdu'],['en','English']].map(([v,l]) => <button type="button" key={v} onClick={() => toggle('languages', v)} className={`rounded-xl border px-4 py-2 text-sm font-black ${form.languages.includes(v) ? 'border-secondary bg-violet-50 text-secondary' : 'border-gray-200 text-gray-600'}`}>{l}</button>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Frequency<select value={form.frequency} onChange={(e)=>setForm((x)=>({...x,frequency:e.target.value}))} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="every_15_days">Every 15 days</option><option value="every_30_days">Every 30 days</option><option value="custom_days">Custom days</option></select></label><label className="text-sm font-bold">Time<input type="time" value={form.preferred_time} onChange={(e)=>setForm((x)=>({...x,preferred_time:e.target.value}))} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal" /></label><label className="text-sm font-bold">Timezone<input value={form.timezone} onChange={(e)=>setForm((x)=>({...x,timezone:e.target.value}))} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal" /></label>{form.frequency==='weekly' ? <label className="text-sm font-bold">Day<select value={form.weekly_day} onChange={(e)=>setForm((x)=>({...x,weekly_day:Number(e.target.value)}))} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal">{WEEKDAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>:null}</div>{form.frequency==='custom_days'?<div className="mt-5 flex flex-wrap gap-2">{WEEKDAYS.map((d,i)=><button type="button" key={d} onClick={()=>setForm((x)=>({...x,custom_weekdays:x.custom_weekdays.includes(i)?x.custom_weekdays.filter((n)=>n!==i):[...x.custom_weekdays,i]}))} className={`rounded-xl border px-3 py-2 text-xs font-black ${form.custom_weekdays.includes(i)?'border-primary bg-blue-50 text-primary':'border-gray-200 text-gray-600'}`}>{d}</button>)}</div>:null}</section>
        <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60"><Save className="h-4 w-4" /> {saving?'Saving…':'Save LINE preferences'}</button><p className="flex items-center justify-center gap-2 text-xs text-gray-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> This private link controls only your LINE alerts.</p>
      </form>
    </main>
  );
}
