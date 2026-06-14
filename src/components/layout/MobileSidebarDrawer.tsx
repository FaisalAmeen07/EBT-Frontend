'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BrandSidebarLockup } from '@/components/brand/BrandLogo';
import { usePathname, useRouter } from 'next/navigation';
import { clearSessionCookies } from '@/views/auth/authSession';
import { logoutFromApi } from '@/services/auth.service';
import { useStore } from '@/lib/store';
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
  PlugZap,
  ScrollText,
  X,
} from 'lucide-react';

const navItems = [
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
 
 const bottomItems = [{ name: 'Logout', href: '/logout', icon: LogOut }];
 
 export function MobileSidebarDrawer({
   open,
   onClose,
 }: {
   open: boolean;
   onClose: () => void;
 }) {
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
 
   const filtered = navItems.filter((item) => {
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
 
   return (
     <div
       className={`fixed inset-0 z-[60] lg:hidden ${
         open ? 'pointer-events-auto' : 'pointer-events-none'
       }`}
       aria-hidden={!open}
     >
       <div
         className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity ${
           open ? 'opacity-100' : 'opacity-0'
         }`}
         onClick={onClose}
       />
 
       <div
         className={`absolute left-0 top-0 h-full w-[84%] max-w-[320px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ${
           open ? 'translate-x-0' : '-translate-x-full'
         }`}
         role="dialog"
         aria-modal="true"
       >
         <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-700">
           <BrandSidebarLockup />
           <button
             onClick={onClose}
             className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
             aria-label="Close menu"
           >
             <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
           </button>
         </div>
 
         <nav className="px-4 py-4 space-y-1">
           {filtered.map((item) => {
             const Icon = item.icon;
             const isActive =
               item.href === '/admin'
                 ? pathname === '/admin' || pathname.startsWith('/admin/')
                 : pathname === item.href;
             return (
               <Link
                 key={item.name}
                 href={item.href}
                 onClick={onClose}
                 className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                   isActive
                     ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-50 border-l-4 border-slate-900 dark:border-indigo-400'
                     : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-50'
                 }`}
               >
                 <span className="flex min-w-0 items-center">
                   <Icon
                     className={`mr-3 h-5 w-5 shrink-0 ${
                       isActive ? 'text-slate-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'
                     }`}
                   />
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
 
         <div className="mt-auto px-4 pb-6 space-y-1">
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
                     onClose();
                     router.push('/auth/login');
                     router.refresh();
                   }}
                   className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-colors"
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
                 onClick={onClose}
                 className="flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-colors"
               >
                 <Icon className="mr-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                 {item.name}
               </Link>
             );
           })}
         </div>
       </div>
     </div>
   );
 }

