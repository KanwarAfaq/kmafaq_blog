import { ArrowLeft, CheckCircle2, ExternalLink, Package, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '../components/SEO';
import Loader from '../components/Loader';
import { useAuth } from '../contexts/AuthContext';
import { getDigitalProductBySlug, submitDigitalProductOrder } from '../lib/api';

function money(value, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function DigitalProductDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: '', email: user?.email || '', message: '', company_website: '' });

  useEffect(() => {
    getDigitalProductBySlug(slug).then(setProduct).catch(() => setProduct(null)).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (user?.email) setForm((current) => ({ ...current, email: current.email || user.email }));
  }, [user?.email]);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    try {
      await submitDigitalProductOrder({ ...form, product_id: product.id });
      toast.success('Order request received. We will email you with payment/delivery details.');
      setForm((current) => ({ ...current, message: '', company_website: '' }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loader label="Loading product…" />;
  if (!product) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-3xl font-black text-ink">Product not found</h1><Link to="/shop" className="mt-5 inline-block font-black text-primary">Back to store</Link></main>;

  return (
    <main className="py-12">
      <SEO title={product.name} path={`/shop/${product.slug}`} description={product.short_description} image={product.cover_url} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-black text-primary"><ArrowLeft className="h-4 w-4" /> Back to store</Link>
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            {product.cover_url ? <img src={product.cover_url} alt={product.name} className="aspect-[16/8] w-full object-cover" /> : <div className="flex aspect-[16/8] items-center justify-center bg-violet-50 text-secondary"><Package className="h-14 w-14" /></div>}
            <div className="p-6 sm:p-8">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-secondary">{product.category}</span>
              <h1 className="mt-4 text-3xl font-black text-ink sm:text-4xl">{product.name}</h1>
              <p className="mt-3 text-lg leading-7 text-gray-600">{product.short_description}</p>
              <div className="article-prose mt-7 text-gray-700"><ReactMarkdown>{product.description || product.short_description}</ReactMarkdown></div>
              {product.preview_url ? <a href={product.preview_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 font-black text-primary"><ExternalLink className="h-4 w-4" /> Preview resource</a> : null}
            </div>
          </article>

          <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <p className="text-sm font-bold text-gray-500">Price</p>
            <p className="mt-1 text-3xl font-black text-primary">{Number(product.price) === 0 ? 'Free' : money(product.price, product.currency)}</p>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Digital delivery</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Email confirmation</p>
            </div>
            <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Automated checkout is pending. For now, submit the order and KM Afaq can invoice/deliver manually.</p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <textarea rows={3} placeholder="Optional message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <input tabIndex="-1" autoComplete="off" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} className="hidden" />
              <button disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60"><Send className="h-4 w-4" /> {sending ? 'Sending…' : Number(product.price) === 0 ? 'Request free resource' : 'Request purchase'}</button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
