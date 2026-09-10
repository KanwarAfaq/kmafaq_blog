import { Megaphone, PackagePlus, Save } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { createDigitalProduct, createDigestSponsor } from '../lib/api';

const PRODUCT_INITIAL = {
  name: '', slug: '', short_description: '', description: '', category: 'AI Resources', price: '0', currency: 'USD', cover_url: '', preview_url: '', featured: false, status: 'active',
};
const SPONSOR_INITIAL = {
  sponsor_name: '', headline: '', body: '', cta_label: 'Learn more', cta_url: '', channels: ['email', 'line'], starts_at: '', ends_at: '', status: 'active',
};

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

export default function AdminMonetizationPage() {
  const { user } = useAuth();
  const admin = user?.app_metadata?.role === 'admin';
  const [product, setProduct] = useState(PRODUCT_INITIAL);
  const [sponsor, setSponsor] = useState(SPONSOR_INITIAL);
  const [saving, setSaving] = useState('');

  if (!admin) return <Navigate to="/" replace />;

  async function saveProduct(event) {
    event.preventDefault();
    setSaving('product');
    try {
      await createDigitalProduct({
        ...product,
        slug: product.slug.trim() || slugify(product.name),
        price: Number(product.price || 0),
        cover_url: product.cover_url.trim() || null,
        preview_url: product.preview_url.trim() || null,
      });
      toast.success('Digital product created.');
      setProduct(PRODUCT_INITIAL);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving('');
    }
  }

  async function saveSponsor(event) {
    event.preventDefault();
    setSaving('sponsor');
    try {
      await createDigestSponsor({
        ...sponsor,
        body: sponsor.body.trim() || null,
        starts_at: sponsor.starts_at ? new Date(sponsor.starts_at).toISOString() : new Date().toISOString(),
        ends_at: sponsor.ends_at ? new Date(sponsor.ends_at).toISOString() : null,
      });
      toast.success('Digest sponsor campaign created.');
      setSponsor(SPONSOR_INITIAL);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving('');
    }
  }

  function toggleChannel(channel) {
    setSponsor((current) => {
      const exists = current.channels.includes(channel);
      if (exists && current.channels.length === 1) return current;
      return { ...current, channels: exists ? current.channels.filter((item) => item !== channel) : [...current.channels, channel] };
    });
  }

  return (
    <main className="py-12">
      <SEO title="Monetization Manager" path="/admin/monetization" noIndex />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-black text-emerald-600">ADMIN</p><h1 className="mt-2 text-4xl font-black text-ink">Monetization manager</h1><p className="mt-2 text-gray-600">Create store products and sponsored email/LINE campaigns.</p></div>
          <Link to="/admin/revenue" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-primary">Revenue dashboard</Link>
        </div>

        <div className="mt-8 grid gap-7 xl:grid-cols-2">
          <form onSubmit={saveProduct} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-secondary"><PackagePlus /></div>
            <h2 className="mt-4 text-2xl font-black text-ink">New digital product</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input required placeholder="Product name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <input placeholder="Slug (auto if blank)" value={product.slug} onChange={(e) => setProduct({ ...product, slug: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <input required placeholder="Short description" value={product.short_description} onChange={(e) => setProduct({ ...product, short_description: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
              <textarea rows={6} placeholder="Full description (Markdown supported)" value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
              <input placeholder="Category" value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <div className="grid grid-cols-[1fr_90px] gap-2"><input required min="0" step="0.01" type="number" placeholder="Price" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} className="min-w-0 rounded-xl border border-gray-300 px-4 py-3" /><input maxLength={3} value={product.currency} onChange={(e) => setProduct({ ...product, currency: e.target.value.toUpperCase() })} className="rounded-xl border border-gray-300 px-3 py-3" /></div>
              <select value={product.status} onChange={(e) => setProduct({ ...product, status: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3"><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></select>
              <input placeholder="Cover image URL" value={product.cover_url} onChange={(e) => setProduct({ ...product, cover_url: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <input placeholder="Preview URL" value={product.preview_url} onChange={(e) => setProduct({ ...product, preview_url: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={product.featured} onChange={(e) => setProduct({ ...product, featured: e.target.checked })} /> Featured product</label>
            </div>
            <button disabled={saving === 'product'} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60"><Save className="h-4 w-4" /> {saving === 'product' ? 'Saving…' : 'Create product'}</button>
          </form>

          <form onSubmit={saveSponsor} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Megaphone /></div>
            <h2 className="mt-4 text-2xl font-black text-ink">New digest sponsor</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input required placeholder="Sponsor name" value={sponsor.sponsor_name} onChange={(e) => setSponsor({ ...sponsor, sponsor_name: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <input required placeholder="Headline" value={sponsor.headline} onChange={(e) => setSponsor({ ...sponsor, headline: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <textarea rows={4} placeholder="Short sponsored message" value={sponsor.body} onChange={(e) => setSponsor({ ...sponsor, body: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2" />
              <input required placeholder="CTA label" value={sponsor.cta_label} onChange={(e) => setSponsor({ ...sponsor, cta_label: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <input required placeholder="Destination (example.com/offer or full URL)" value={sponsor.cta_url} onChange={(e) => setSponsor({ ...sponsor, cta_url: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3" />
              <label className="text-xs font-bold text-gray-500">Starts at<input type="datetime-local" value={sponsor.starts_at} onChange={(e) => setSponsor({ ...sponsor, starts_at: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal text-gray-800" /></label>
              <label className="text-xs font-bold text-gray-500">Ends at<input type="datetime-local" value={sponsor.ends_at} onChange={(e) => setSponsor({ ...sponsor, ends_at: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal text-gray-800" /></label>
              <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 px-4 py-3 sm:col-span-2">
                <span className="text-sm font-black text-ink">Channels:</span>
                {['email', 'line'].map((channel) => <label key={channel} className="flex items-center gap-2 text-sm font-bold capitalize"><input type="checkbox" checked={sponsor.channels.includes(channel)} onChange={() => toggleChannel(channel)} /> {channel}</label>)}
              </div>
              <select value={sponsor.status} onChange={(e) => setSponsor({ ...sponsor, status: e.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 sm:col-span-2"><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></select>
            </div>
            <button disabled={saving === 'sponsor'} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-black text-amber-950 disabled:opacity-60"><Save className="h-4 w-4" /> {saving === 'sponsor' ? 'Saving…' : 'Create sponsor campaign'}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
