import { Link } from 'react-router-dom';
import { PAGE_FAQS } from '../constants/faqs';

export default function FaqSection({ path }) {
  const faq = PAGE_FAQS[path];
  if (!faq) return null;
  return (
    <section className="mt-14 border-t border-gray-200 pt-10" aria-labelledby="page-faq">
      <h2 id="page-faq" className="text-2xl font-black text-ink">{faq.heading}</h2>
      <dl className="mt-5 space-y-5">
        {faq.items.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-black text-ink">{q}</dt>
            <dd className="mt-1 text-gray-600">{a}</dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Related pages" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-black text-primary">
        {faq.links.map((l) => <Link key={l.to} to={l.to}>{l.text}</Link>)}
      </nav>
    </section>
  );
}
