import { BellRing, Radar, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/profile', label: 'Profile', icon: UserRound, end: true },
  { to: '/profile/notifications', label: 'Notifications', icon: BellRing },
  { to: '/alerts', label: 'Premium alerts', icon: Radar },
];

export default function AccountNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm lg:flex-col" aria-label="Account settings">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              isActive ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-ink'
            }`
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
