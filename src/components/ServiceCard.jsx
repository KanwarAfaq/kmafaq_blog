import { Bot, Code2, Search, Sparkles } from 'lucide-react';

function ServiceIcon({ name }) {
  const normalized = name.toLowerCase();
  const Icon = normalized.includes('automation')
    ? Bot
    : normalized.includes('web')
      ? Code2
      : normalized.includes('seo') || normalized.includes('consult')
        ? Search
        : Sparkles;

  return <Icon className="h-7 w-7" aria-hidden="true" />;
}

export default function ServiceCard({ service }) {
  const price = Number(service.price);

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
        <ServiceIcon name={service.name} />
      </div>
      <h3 className="mt-5 text-xl font-bold text-ink">{service.name}</h3>
      <p className="mt-3 min-h-18 text-sm leading-6 text-gray-600">{service.description}</p>
      <div className="mt-6 border-t border-gray-100 pt-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Starting at</span>
        <p className="mt-1 text-2xl font-extrabold text-secondary">
          {Number.isFinite(price)
            ? price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
            : 'Custom'}
        </p>
      </div>
    </article>
  );
}
