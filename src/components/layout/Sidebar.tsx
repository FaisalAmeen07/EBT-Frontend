'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BrandSidebarLockup } from '@/components/brand/BrandLogo';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { clearSessionCookies } from '@/views/auth/authSession';
import { logoutFromApi } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import { totalUnreadMessagesForViewer } from '@/lib/messaging';
import { subscribeChatSocket } from '@/lib/chat-socket';
import {
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PlugZap,
  ScrollText,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';

const sidebarItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Daily Updates', href: '/daily-updates', icon: ScrollText },
  { name: 'Team Data', href: '/team-data', icon: BarChart3 },
  { name: 'Project Manager', href: '/project-manager', icon: Calendar },
  { name: 'App Integrations', href: '/app/integrations', icon: PlugZap },
  { name: 'Desktop Work diary', href: '/desktop-work-diary', icon: Clock },
  { name: 'Timesheet', href: '/timesheet', icon: Clock },
  { name: 'Availability', href: '/availability', icon: CalendarClock },
  { name: 'My Requests', href: '/my-requests', icon: ClipboardList },
  { name: 'Request Management', href: '/request-management', icon: UsersRound },
  { name: 'Team assign to TL', href: '/team-tl', icon: UserCog },
  { name: 'Admin Control', href: '/admin', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const users = useStore((s) => s.users);
  const chatThreads = useStore((s) => s.chatThreads);
  const [socketRev, setSocketRev] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => subscribeChatSocket(() => setSocketRev((n) => n + 1)), []);

  const messagesUnreadTotal = useMemo(() => {
    if (!currentUser) return 0;
    return totalUnreadMessagesForViewer(chatThreads, currentUser, users);
  }, [chatThreads, currentUser, users, socketRev]);

  const filteredSidebarItems = sidebarItems.filter((item) => {
    if (item.name === 'Admin Control' && currentUser?.role !== 'Admin') return false;
    if (item.name === 'My Requests' && currentUser?.role === 'Admin') return false;
    if (item.name === 'Request Management' && currentUser?.role !== 'Admin' && currentUser?.role !== 'HR')
      return false;
    if (item.name === 'Team assign to TL' && currentUser?.role !== 'Admin' && currentUser?.role !== 'HR') return false;
    if (item.name === 'Team Data' && currentUser?.role !== 'Team Leader') return false;
    if (item.name === 'Desktop Work diary' && currentUser?.role !== 'Employee' && currentUser?.role !== 'Team Leader')
      return false;
    if (
      item.name === 'Daily Updates' &&
      currentUser?.role !== 'Employee' &&
      currentUser?.role !== 'Team Leader' &&
      currentUser?.role !== 'HR' &&
      currentUser?.role !== 'Admin'
    ) {
      return false;
    }
    return true;
  });

  const logout = () => {
    void logoutFromApi();
    clearSessionCookies();
    setCurrentUser(null);
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-300 dark:border-slate-700 dark:bg-slate-900 lg:min-h-dvh',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className={cn('shrink-0 border-b border-transparent px-3 py-5 dark:border-slate-800', collapsed && 'px-2')}>
        <div className={cn('flex items-center justify-center', collapsed ? 'py-1' : 'px-1 py-0')}>
          <BrandSidebarLockup collapsed={collapsed} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="absolute -right-3 bottom-7 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-slate-900 shadow-lg ring-2 ring-white transition hover:bg-emerald-300 dark:ring-slate-900"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <nav
        className={cn(
          'min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 [scrollbar-color:#94a3b8_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/70 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5',
          collapsed && 'px-2'
        )}
      >
        {filteredSidebarItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin' || pathname.startsWith('/admin/')
              : item.href === '/app/integrations'
                ? pathname === item.href
                : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                'group flex items-center rounded-xl text-sm font-semibold transition-colors',
                collapsed ? 'justify-center px-0 py-3' : 'justify-between gap-2 border-l-4 px-4 py-3',
                isActive
                  ? 'border-[#0f172a] bg-[#f0f2ff] text-[#0f172a] dark:border-indigo-400 dark:bg-slate-800 dark:text-slate-50'
                  : 'border-transparent text-[#64748b] hover:bg-[#f7f8ff] hover:text-[#0f172a] dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-50'
              )}
            >
              <span className={cn('flex min-w-0 items-center', collapsed && 'justify-center')}>
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    collapsed ? 'mr-0' : 'mr-3',
                    isActive ? 'text-[#475569] dark:text-indigo-300' : 'text-[#94a3b8] dark:text-slate-500'
                  )}
                />
                {!collapsed ? <span className="truncate">{item.name}</span> : null}
              </span>
              {!collapsed && item.href === '/messages' && messagesUnreadTotal > 0 && (
                <span
                  className="inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm"
                  aria-label={`${messagesUnreadTotal} unread messages`}
                >
                  {messagesUnreadTotal > 99 ? '99+' : messagesUnreadTotal}
                </span>
              )}
              {collapsed && item.href === '/messages' && messagesUnreadTotal > 0 && (
                <span className="absolute ml-6 mt-[-1.5rem] h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn('shrink-0 px-3 py-4', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center rounded-xl text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#f0f2ff] dark:text-slate-100 dark:hover:bg-slate-800/80',
            collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
          )}
        >
          <LogOut className={cn('h-5 w-5 shrink-0 text-[#94a3b8] dark:text-slate-500', collapsed ? 'mr-0' : 'mr-3')} />
          {!collapsed ? 'Logout' : null}
        </button>
      </div>
    </aside>
  );
}
