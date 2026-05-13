'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND_LOGO_DARK_URL, BRAND_LOGO_URL } from '@/lib/brand';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { clearSessionCookies } from '@/views/auth/authSession';
import { logoutFromApi } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import { totalUnreadMessagesForViewer } from '@/lib/messaging';
import { subscribeChatSocket } from '@/lib/chat-socket';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  CalendarClock,
  ClipboardList,
  UsersRound,
  LogOut,
  ShieldCheck,
  UserCog,
  BarChart3,
  MessageSquare,
  ScrollText,
} from 'lucide-react';

const sidebarItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Daily Updates', href: '/daily-updates', icon: ScrollText },
  { name: 'Team Data', href: '/team-data', icon: BarChart3 },
  { name: 'Project Manager', href: '/project-manager', icon: Calendar },
  { name: 'Timesheet', href: '/timesheet', icon: Clock },
  { name: 'Availability', href: '/availability', icon: CalendarClock },
  { name: 'My Requests', href: '/my-requests', icon: ClipboardList },
  { name: 'Request Management', href: '/request-management', icon: UsersRound },
  { name: 'Team assign to TL', href: '/team-tl', icon: UserCog },
  { name: 'Admin Control', href: '/admin', icon: ShieldCheck },
];

const bottomItems = [{ name: 'Logout', href: '/logout', icon: LogOut }];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const users = useStore((s) => s.users);
  const chatThreads = useStore((s) => s.chatThreads);
  const [socketRev, setSocketRev] = useState(0);
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

  return (
    <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pt-6 pb-6 shadow-sm lg:min-h-dvh">
      <div className="px-6 mb-8 flex justify-center items-center">
        <div className="flex flex-col items-center select-none">
          <div className="relative mx-auto h-16 w-[180px]">
            <Image
              src={BRAND_LOGO_URL}
              alt="Global Digital Care"
              fill
              className="object-contain object-center dark:hidden"
              sizes="180px"
              priority
            />
            <Image
              src={BRAND_LOGO_DARK_URL}
              alt="Global Digital Care"
              fill
              className="hidden object-contain object-center dark:block"
              sizes="180px"
            />
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {filteredSidebarItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin' || pathname.startsWith('/admin/')
              : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-50 border-l-4 border-slate-900 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-50'
              )}
            >
              <span className="flex min-w-0 items-center">
                <Icon className={cn('mr-3 h-5 w-5 shrink-0', isActive ? 'text-slate-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500')} />
                {item.name}
              </span>
              {item.href === '/messages' && messagesUnreadTotal > 0 && (
                <span
                  className="inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm"
                  aria-label={`${messagesUnreadTotal} unread messages`}
                >
                  {messagesUnreadTotal > 99 ? '99+' : messagesUnreadTotal}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 space-y-1 mt-8">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          if (item.name === 'Logout') {
            return (
              <button
                key={item.name}
                onClick={() => {
                  void logoutFromApi();
                  clearSessionCookies();
                  setCurrentUser(null);
                  router.push('/auth/login');
                  router.refresh();
                }}
                className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-50 transition-colors"
              >
                <Icon className="mr-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                {item.name}
              </button>
            );
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-50 transition-colors"
            >
              <Icon className="mr-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
