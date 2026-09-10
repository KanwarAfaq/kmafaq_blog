import { ArrowUpRight, FileDown, Package, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { getDigitalProducts } from '../lib/api';

function money(value, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function DigitalProductsPage() {
  const [products, setProducts] = useState([]);
  useEffect(() => { getDigitalProducts().then(setProducts).catch(() => setProducts([])); }, []);

  return (
    <main className="py-14">
      <SEO title="Digital Products" path="/shop" description="AI prompt packs, templates, guides and practical digital resources from KM Afaq." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black text-secondary">DIGITAL STORE</p>
            <h1 className="mt-2 text-4xl font-black text-ink sm:text-5xl">Practical resources you can use today</h1>
            <p className="mt-3 max-w-2xl text-gray-600">AI prompt packs, templates, checklists, guides and downloadable resources.</p>
          </div>
          <Link to="/pricing?product=digital-product" className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-black text-primary">Partner / bundle inquiry</Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              {product.cover_url ? (
                <img src={product.cover_url} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 text-secondary"><Package className="h-12 w-12" /></div>
              )}
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-secondary">{product.category}</span>
                  {product.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"><Sparkles className="h-3.5 w-3.5" /> Featured</span> : null}
                </div>
                <h2 className="mt-4 text-xl font-black text-ink">{product.name}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{product.short_description}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xl font-black text-primary">{Number(product.price) === 0 ? 'Free' : money(product.price, product.currency)}</span>
                  <Link to={`/shop/${product.slug}`} className="inline-flex items-center gap-1 text-sm font-black text-primary">View product <ArrowUpRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </article>
          ))}
          {!products.length ? (
            <div className="col-span-full rounded-3xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
              <FileDown className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 font-black text-ink">Digital store is ready.</p>
              <p className="mt-1 text-sm">Add your first product from the admin monetization page.</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
