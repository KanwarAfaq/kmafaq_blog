import { BellRing, MessageCircle, QrCode, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function LineSubscribePage() {
  const addFriendUrl = import.meta.env.VITE_LINE_OFFICIAL_ACCOUNT_URL || '';
  const qrImageUrl = import.meta.env.VITE_LINE_ADD_FRIEND_QR_URL || (addFriendUrl ? `https://quickchart.io/qr?size=300&text=${encodeURIComponent(addFriendUrl)}` : '');

  return (
    <main className="py-14 sm:py-20">
      <SEO title="LINE Alerts" path="/line" description="Add KM Afaq on LINE and choose personalized news alerts without creating a website account." />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_340px] md:p-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-600">No website login required</p>
            <h1 className="mt-3 text-3xl font-black text-ink sm:text-5xl">Get personalized KM Afaq alerts on LINE</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">Scan the official QR, add KM Afaq as a friend, then LINE will send you a private preferences link.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[['1', 'Scan & add', 'Add the official account.'], ['2', 'Choose preferences', 'Pick topics, language, days and time.'], ['3', 'Receive alerts', 'Get matching digests automatically.']].map(([n,t,d]) => (
                <div key={n} className="rounded-2xl bg-slate-50 p-4"><span className="text-xs font-black text-primary">STEP {n}</span><p className="mt-2 font-black text-ink">{t}</p><p className="mt-1 text-sm text-gray-600">{d}</p></div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {addFriendUrl ? <a href={addFriendUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#06C755] px-5 py-3 font-black text-white"><MessageCircle className="h-5 w-5" /> Add on LINE</a> : null}
              <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 font-black text-gray-700"><BellRing className="h-5 w-5" /> Premium alerts</Link>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 text-center">
            <QrCode className="h-8 w-8 text-emerald-600" />
            {qrImageUrl ? <img src={qrImageUrl} alt="KM Afaq LINE add friend QR code" className="mt-4 aspect-square w-56 rounded-2xl bg-white object-contain p-3 shadow-sm" /> : <div className="mt-4 flex aspect-square w-56 items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-6 text-sm font-bold text-gray-500">Set VITE_LINE_ADD_FRIEND_QR_URL in .env with the QR image from LINE Official Account Manager.</div>}
            <p className="mt-4 text-sm font-bold text-gray-700">After adding us, check the LINE chat for your private settings link.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500"><Settings2 className="h-3.5 w-3.5" /> Type “settings” in LINE anytime to get a fresh link.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
