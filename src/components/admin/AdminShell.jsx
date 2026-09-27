import { BadgeDollarSign, FileText, LayoutDashboard, Megaphone, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import SEO from '../SEO';

const ITEMS = [
  ['Overview', '/admin', LayoutDashboard],
  ['Content', '/admin/content', FileText],
  ['SEO & Search', '/admin/seo', Search],
  ['Revenue', '/admin/revenue', BadgeDollarSign],
  ['Monetize', '/admin/monetization', Megaphone],
];

export default function AdminShell({ title, description, actions, children }) {
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <SEO title={title || 'Admin'} path="/admin" noIndex />
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">KM Afaq Control Center</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
              {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          <nav className="mt-8 flex gap-2 overflow-x-auto pb-1" aria-label="Admin navigation">
            {ITEMS.map(([label, to, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                  isActive
                    ? 'border-white/25 bg-white text-slate-950 shadow-lg'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
