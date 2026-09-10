import { CheckCircle2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { submitMonetizationRequest } from '../lib/api';

const PRODUCTS = [
  { id: 'premium-alerts', name: 'Premium Intelligence', price: '$9/mo', desc: 'Keyword, company and person watchlists with fast email/LINE alerts.', features: ['Custom watchlists', 'Email + LINE channels', 'Fast article matching'] },
  { id: 'featured-listing', name: 'Featured Business', price: '$39/mo', desc: 'Priority business directory placement with direct lead capture.', features: ['Featured badge', 'Quote requests', 'Lead & click counters'] },
  { id: 'sponsored-post', name: 'Sponsored Article', price: 'From $99', desc: 'Clearly labeled sponsored content with a sponsor CTA and website link.', features: ['Sponsored badge', 'Sponsor CTA', 'Permanent article URL'] },
  { id: 'business-premium', name: 'Business Premium', price: '$149/mo', desc: 'Featured listing + sponsored content + custom visibility package.', features: ['Directory promotion', 'Lead generation', 'Content placement'] },
  { id: 'digest-sponsor', name: 'Email / LINE Sponsor', price: 'From $75', desc: 'Place a tracked sponsored message inside KM Afaq reader digests.', features: ['Email + LINE placement', 'Click tracking', 'Campaign reporting'] },
  { id: 'featured-job', name: 'Featured Job', price: '$49 / 30 days', desc: 'Priority placement for jobs, internships and freelance opportunities.', features: ['Featured badge', 'Priority position', 'Application click tracking'] },
  { id: 'digital-product', name: 'Digital Product Partnership', price: 'Custom', desc: 'Sell or bundle practical AI resources through the KM Afaq digital store.', features: ['Store placement', 'Order leads', 'Manual delivery now'] },
];

const INITIAL_FORM = { name: '', email: '', company: '', website_url: '', budget: '', message: '', company_website: '' };

export default function PricingPage() {
  const [searchParams] = useSearchParams();
  const requestedProduct = searchParams.get('product');
  const initialProduct = PRODUCTS.some((item) => item.id === requestedProduct) ? requestedProduct : 'premium-alerts';
  const [product, setProduct] = useState(initialProduct);
  const [form, setForm] = useState(INITIAL_FORM);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (PRODUCTS.some((item) => item.id === requestedProduct)) setProduct(requestedProduct);
  }, [requestedProduct]);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    try {
      await submitMonetizationRequest({ ...form, product });
      toast.success('Request received. KM Afaq can follow up and invoice manually.');
      setForm(INITIAL_FORM);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="py-14">
      <SEO title="Pricing & Advertise" path="/pricing" description="Premium alerts, sponsorships, featured jobs, business listings and digital products on KM Afaq." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-black text-primary">MONETIZE KM AFAQ</p>
          <h1 className="mt-2 text-4xl font-black text-ink sm:text-5xl">Products you can sell now</h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">Use manual invoicing first. Automated checkout remains pending for later.</p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PRODUCTS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setProduct(item.id)}
              className={`rounded-3xl border p-6 text-left shadow-sm ${product === item.id ? 'border-primary bg-blue-50/40' : 'border-gray-200 bg-white'}`}
            >
              <p className="text-xl font-black text-ink">{item.name}</p>
              <p className="mt-1 text-2xl font-black text-primary">{item.price}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{item.desc}</p>
              <div className="mt-4 space-y-2">
                {item.features.map((feature) => <p key={feature} className="flex items-center gap-2 text-xs font-bold text-gray-600"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{feature}</p>)}
              </div>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mx-auto mt-9 max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-black text-ink">Request {PRODUCTS.find((item) => item.id === product)?.name}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Website (example.com, www.example.com, or full URL)" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Budget / package" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
            <textarea rows={4} placeholder="What do you want to achieve?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
            <input tabIndex="-1" autoComplete="off" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} className="hidden" />
          </div>
          <button disabled={sending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60"><Send className="h-4 w-4" />{sending ? 'Sending…' : 'Send sales inquiry'}</button>
        </form>
      </div>
    </main>
  );
}
