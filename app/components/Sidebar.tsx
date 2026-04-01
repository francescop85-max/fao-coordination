'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FolderOpen, CalendarDays, LogOut, BarChart3 } from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays },
  { href: '/portfolio', label: 'Portfolio Analysis', icon: BarChart3 },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('fao_auth');
    localStorage.removeItem('fao_user');
    router.replace('/login');
  };

  const user = typeof window !== 'undefined' ? localStorage.getItem('fao_user') ?? '' : '';

  return (
    <aside className="w-56 flex flex-col bg-[#003f7d] text-white shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center shrink-0">
            <span className="text-[#003f7d] font-bold text-xs">FAO</span>
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">FAO Ukraine</div>
            <div className="text-blue-300 text-xs leading-tight">Programme Hub</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#007bc0] text-white font-medium'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-blue-800">
        {user && (
          <div className="text-blue-300 text-xs px-2 mb-2 truncate">{user}</div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
