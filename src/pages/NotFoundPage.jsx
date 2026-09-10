import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <SEO title="Page not found" path="/404" noIndex />
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="mt-3 text-4xl font-black text-ink">Page not found</h1>
      <p className="mt-4 text-gray-600">The page you requested does not exist or has moved.</p>
      <Link to="/" className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-blue-700">Return home</Link>
    </section>
  );
}
