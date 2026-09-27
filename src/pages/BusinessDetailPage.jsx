import { ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import SEO from '../components/SEO';
import { getBusinessBySlug, submitBusinessLead } from '../lib/api';

export default function BusinessDetailPage() {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', company_website: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getBusinessBySlug(slug)
      .then((data) => { if (active) setBusiness(data); })
      .catch(() => { if (active) setBusiness(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    try {
      await submitBusinessLead({ ...form, listing_id: business.id, source_url: window.location.href });
      toast.success('Request sent.');
      setForm({ name: '', email: '', phone: '', message: '', company_website: '' });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loader label="Loading business…" />;

  if (!business) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <SEO title="Business not found" path={`/business/${slug}`} noIndex />
        <h1 className="text-3xl font-black text-ink">Business not found</h1>
        <p className="mt-3 text-gray-600">This listing may have been removed or is no longer active.</p>
        <Link to="/business" className="mt-4 inline-block font-black text-primary">Back to directory</Link>
      </main>
    );
  }

  const canonicalUrl = `https://kmafaq.online/business/${business.slug}`;
  const hasPublicWebsite = /^https?:\/\//i.test(business.website_url || '');
  const businessSchema = {
    '@context': 'https://schema.org',
    '@type': (business.city || business.country) ? 'LocalBusiness' : 'Organization',
    name: business.name,
    url: canonicalUrl,
    description: business.description || business.short_description,
    image: business.logo_url || undefined,
    logo: business.logo_url || undefined,
    ...(hasPublicWebsite ? { sameAs: [business.website_url] } : {}),
    ...((business.city || business.country) ? {
      address: {
        '@type': 'PostalAddress',
        addressLocality: business.city || undefined,
        addressCountry: business.country || undefined,
      },
    } : {}),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://kmafaq.online/' },
      { '@type': 'ListItem', position: 2, name: 'Business Directory', item: 'https://kmafaq.online/business' },
      { '@type': 'ListItem', position: 3, name: business.name, item: canonicalUrl },
    ],
  };

  return (
    <main className="py-14">
      <SEO
        title={business.name}
        path={`/business/${business.slug}`}
        description={business.short_description}
        image={business.logo_url}
        imageAlt={business.name}
        schema={[businessSchema, breadcrumbSchema]}
      />
      <div className="mx-auto grid max-w-5xl gap-7 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
          <p className="text-sm font-black text-primary">{business.category}</p>
          <h1 className="mt-2 text-4xl font-black text-ink">{business.name}</h1>
          {(business.city || business.country) ? (
            <p className="mt-2 text-sm font-semibold text-gray-500">{[business.city, business.country].filter(Boolean).join(', ')}</p>
          ) : null}
          <p className="mt-4 text-lg leading-8 text-gray-600">{business.description || business.short_description}</p>
          {business.website_url ? (
            <a
              href={`/api/go?type=business&id=${encodeURIComponent(business.id)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-black text-gray-700"
            >
              Visit website <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </section>

        <form onSubmit={submit} className="h-fit rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-xl font-black text-ink">Request a quote</h2>
          <p className="mt-1 text-sm text-gray-500">Send a direct inquiry about this business or service.</p>
          <div className="mt-4 space-y-3">
            <input required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3" />
            <input placeholder="Phone (optional)" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3" />
            <textarea required minLength={10} rows={5} placeholder="What do you need?" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="w-full rounded-xl border border-gray-300 px-4 py-3" />
            <input tabIndex="-1" autoComplete="off" value={form.company_website} onChange={(event) => setForm({ ...form, company_website: event.target.value })} className="hidden" aria-hidden="true" />
          </div>
          <button disabled={sending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60">
            <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send request'}
          </button>
        </form>
      </div>
    </main>
  );
}
