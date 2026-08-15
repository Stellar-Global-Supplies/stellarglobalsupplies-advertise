import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/api';
import {
  LayoutDashboard, FileText, Image, Users, Mail,
  BarChart2, Settings, LogOut, Zap
} from 'lucide-react';

const nav = [
  { to: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/campaigns',     label: 'Campaigns',     icon: Mail },
  { to: '/templates',     label: 'Templates',     icon: FileText },
  { to: '/images',        label: 'Image Library', icon: Image },
  { to: '/contact-lists', label: 'Contact Lists', icon: Users },
  { to: '/analytics',     label: 'Analytics',     icon: BarChart2 },
  { to: '/settings',      label: 'Settings',      icon: Settings },
];

export default function Layout() {
  const navigate = useNavigate();
  const signOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col shrink-0">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900">AdPlatform</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
