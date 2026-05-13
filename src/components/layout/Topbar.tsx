'use client';

import { Bell, CheckCheck, Menu, Trash2, User as UserIcon, X } from 'lucide-react';
import { useStore, type User } from '@/lib/store';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileSidebarDrawer } from '@/components/layout/MobileSidebarDrawer';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { fetchMyNotificationsApi } from '@/services/notification.service';

function getInitials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Label beside avatar: account role (not display name). */
function headerPillLabel(user: User): string {
  switch (user.role) {
    case 'Admin':
      return 'Admin';
    case 'HR':
      return 'HR';
    case 'Team Leader':
      return 'Team Leader';
    case 'Employee':
      return 'Employee';
    case 'Pending User':
      return 'Pending';
    default:
      return 'User';
  }
}

function relativeTimeLabel(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Topbar() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const notifications = useStore((s) => s.notifications);
  const setNotifications = useStore((s) => s.setNotifications);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useStore((s) => s.clearNotifications);
  const removeNotification = useStore((s) => s.removeNotification);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [notifOpen]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const run = async () => {
        try {
          const rows = await fetchMyNotificationsApi(100);
          if (cancelled) return;
          setNotifications(
            rows.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              category: r.category,
              read: r.read,
              createdAt: r.createdAt,
              ...(r.eventKey ? { eventKey: r.eventKey } : {}),
              ...(r.targetPath ? { targetPath: r.targetPath } : {}),
            }))
          );
        } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[notifications] fetch failed', e);
        }
      }
    };
    void run();
    const id = window.setInterval(() => {
      void run();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentUser?.id, setNotifications]);

  const pillLabel = currentUser ? headerPillLabel(currentUser) : 'User';
  const avatarSrc = currentUser?.avatar;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const openNotification = (id: string, targetPath?: string) => {
    markNotificationRead(id);
    setNotifOpen(false);
    if (targetPath) router.push(targetPath);
  };

  return (
    <>
      <MobileSidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <header className="relative z-50 flex h-20 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 shadow-sm sm:px-8">
        <div className="flex min-w-0 max-w-xl flex-1 items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />
          </button>
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <div className="relative" ref={notifWrapRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-slate-700 dark:text-slate-200" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Notifications</h3>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead()}
                      disabled={notifications.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                    <button
                      type="button"
                      onClick={() => clearNotifications()}
                      disabled={notifications.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-200 dark:hover:border-rose-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Clear all notifications"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="max-h-[22rem] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3 ${
                          n.read ? 'bg-white dark:bg-slate-900' : 'bg-sky-50/40 dark:bg-sky-950/30'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openNotification(n.id, n.targetPath)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{n.title}</p>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.description}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {relativeTimeLabel(n.createdAt)}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNotification(n.id)}
                          className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                          aria-label="Remove notification"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* w-fit + shrink-0: menu width matches pill; dropdown stays under pill (not under bell). */}
          <div className="relative w-fit shrink-0" ref={menuWrapRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex max-w-[260px] items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-1.5 pr-4 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-500 ring-2 ring-white dark:ring-slate-700">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or data URL
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white">{getInitials(pillLabel)}</span>
                )}
              </span>
              <span className="hidden min-w-0 max-w-[180px] truncate text-left text-sm font-semibold text-slate-900 dark:text-slate-50 sm:block">
                {pillLabel}
              </span>
            </button>

            {menuOpen ? (
              <div
                className="absolute left-0 top-full z-50 mt-2 w-max min-w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-lg"
                role="menu"
              >
                <Link
                  href="/profile"
                  role="menuitem"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => setMenuOpen(false)}
                >
                  <UserIcon className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
                  View Profile
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
