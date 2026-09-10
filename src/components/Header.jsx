import { LogIn, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import NotificationMenu from './NotificationMenu';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const navItems = [
  ['Blog', '/blog'],
  ['Shop', '/shop'],
  ['Jobs', '/jobs'],
  ['Services', '/services'],
  ['Business', '/business'],
  ['Tools', '/tools'],
  ['LINE', '/line'],
  ['Pricing', '/pricing'],
];

function NavItem({ label, to, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-2.5 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const admin = user?.app_metadata?.role === 'admin';

  useEffect(() => setMobileOpen(false), [location.pathname]);

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Signed out.');
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="KM Afaq home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-sm font-black text-white">KM</span>
          <span className="hidden text-lg font-extrabold tracking-tight text-ink sm:inline">KM Afaq</span>
        </NavLink>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
          {navItems.map(([label, to]) => <NavItem key={to} label={label} to={to} />)}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationMenu />
          {admin ? (
            <button type="button" onClick={() => navigate('/admin/revenue')} className="hidden items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 xl:inline-flex">
              <ShieldCheck className="h-4 w-4" /> Admin
            </button>
          ) : null}
          {user ? (
            <>
              <button type="button" onClick={() => navigate('/profile')} className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:inline-flex">
                <UserRound className="h-4 w-4" aria-hidden="true" /> Profile
              </button>
              <button type="button" onClick={signOut} className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:inline-flex">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </>
          ) : (
            <button type="button" onClick={() => navigate('/login')} className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:inline-flex">
              <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
            </button>
          )}
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-gray-950/45" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink">KM Afaq</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-gray-700 hover:bg-gray-100" aria-label="Close menu"><X className="h-6 w-6" /></button>
            </div>
            <nav className="mt-8 flex flex-col gap-2" aria-label="Mobile navigation">
              <NavItem label="Home" to="/" onClick={() => setMobileOpen(false)} />
              {navItems.map(([label, to]) => <NavItem key={to} label={label} to={to} onClick={() => setMobileOpen(false)} />)}
              {admin ? <NavItem label="Admin" to="/admin/revenue" onClick={() => setMobileOpen(false)} /> : null}
            </nav>
            <div className="mt-auto border-t border-gray-100 pt-5">
              {user ? (
                <div className="space-y-1">
                  <button type="button" onClick={() => navigate('/profile')} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 font-semibold text-gray-700 hover:bg-gray-50"><UserRound className="h-5 w-5" /> Profile</button>
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 font-semibold text-gray-700 hover:bg-gray-50"><LogOut className="h-5 w-5" /> Sign out</button>
                </div>
              ) : (
                <button type="button" onClick={() => navigate('/login')} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 font-semibold text-gray-700 hover:bg-gray-50"><LogIn className="h-5 w-5" /> Sign in</button>
              )}
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
