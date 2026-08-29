import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { supabase } from '../lib/api';
import {
  LayoutDashboard, FileText, Image, Users, Mail,
  BarChart2, Settings, LogOut, Zap, Menu, X
} from 'lucide-react';

const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || 'https://apps.stellarglobalsupplies.com';

const nav = [
  { to: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/campaigns',     label: 'Campaigns',     icon: Mail            },
  { to: '/templates',     label: 'Templates',     icon: FileText        },
  { to: '/images',        label: 'Image Library', icon: Image           },
  { to: '/contact-lists', label: 'Contact Lists', icon: Users           },
  { to: '/analytics',     label: 'Analytics',     icon: BarChart2       },
  { to: '/settings',      label: 'Settings',      icon: Settings        },
];

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ✅ Sign out of Supabase then return to portal
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.replace(LANDING_URL);
  };

  const sidebarContent = (
    <>
      <div className="p-5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900">Stellar Advertise</span>
        </div>
        {/* Close button only shown inside the mobile drawer */}
        <button
          className="md:hidden text-slate-400"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to} to={to}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t">
        <button onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-sm">Stellar Advertise</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="text-slate-600 p-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden md:flex w-60 bg-white border-r flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer — overlay + slide-in panel, only rendered when open */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r flex flex-col h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
