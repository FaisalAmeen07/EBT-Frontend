'use client';

import { ToastViewport } from '@/components/ToastViewport';
import { clearLegacyDashboardLocalStorage } from '@/lib/clear-legacy-dashboard-storage';
import { mapProfileToStoreUser } from '@/lib/auth/map-api-user';
import { useStore, type Role } from '@/lib/store';
import { fetchAllUsersForAdmin, mapAdminUserRowToStoreUser } from '@/services/admin.service';
import { fetchVisibleDirectory, visibleDirectoryMembersToUsers } from '@/services/team.service';
import { getCurrentUserProfile } from '@/services/user.service';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import Cookies from 'js-cookie';
import { ACCESS_TOKEN_COOKIE } from '@/lib/api/axios.config';
import { clearSessionCookies } from '@/views/auth/authSession';

const noopSubscribe = () => () => {};

/** Client-only gate without `setState` inside an effect (satisfies `react-hooks/set-state-in-effect`). */
function useClientMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const upsertUser = useStore((s) => s.upsertUser);
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useClientMounted();

  useEffect(() => {
    clearLegacyDashboardLocalStorage();
  }, []);

  // Rehydrate session: auth cookies present but in-memory user empty (e.g. new tab / no PII in storage).
  /** Profile GET (`/api/profile/getProfile`) — same JWT source as a typical `/api/me` (Bearer or `accessToken` cookie per backend). */
  useEffect(() => {
    if (!mounted) return;
    const roleCookie = Cookies.get('auth-role');
    const idCookie = Cookies.get('auth-user-id');
    const tokenCookie = Cookies.get(ACCESS_TOKEN_COOKIE);
    if (!roleCookie || !idCookie || currentUser) return;
    if (!tokenCookie) {
      clearSessionCookies();
      return;
    }

    let cancelled = false;

    async function hydrate() {
      const id = idCookie as string;
      const role = roleCookie as Role;
      try {
        const profile = await getCurrentUserProfile();
        if (cancelled) return;
        const user = mapProfileToStoreUser(profile, id, role);

        const { replaceDirectoryUsers, users } = useStore.getState();
        if ((role === 'Admin' || role === 'HR') && users.length === 0) {
          try {
            const res = await fetchAllUsersForAdmin();
            if (cancelled) return;
            if (res.success && Array.isArray(res.data)) {
              replaceDirectoryUsers(res.data.map(mapAdminUserRowToStoreUser));
            }
          } catch {
            /* directory loads on dedicated views if this fails */
          }
        }

        setCurrentUser(user);
        upsertUser(user);
        void useStore.getState().refreshTasksFromApi();
        void useStore.getState().refreshAttendanceFromApi();
        void useStore.getState().refreshNotificationsFromApi();
      } catch {
        clearSessionCookies();
        router.push('/auth/login');
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [mounted, currentUser, setCurrentUser, upsertUser, router]);

  useEffect(() => {
    if (!mounted) return;
    const roleCookie = Cookies.get('auth-role');

    // If no cookie but user in state (e.g., cookie expired), clear state and go to login
    if (currentUser && !roleCookie) {
      setCurrentUser(null);
      router.push('/auth/login');
    }
  }, [currentUser, pathname, router, mounted, setCurrentUser]);

  useEffect(() => {
    if (!mounted || !currentUser) return;
    void useStore.getState().refreshAttendanceFromApi();
    const t = setInterval(() => {
      void useStore.getState().refreshTasksFromApi({ bumpList: false });
      void useStore.getState().refreshAttendanceFromApi();
    }, 120_000);
    return () => clearInterval(t);
  }, [mounted, currentUser?.id]);

  /** Team Leader / Employee: load same-team users into `users` so dashboard filters like `u.team === myTeam` work. */
  useEffect(() => {
    if (!mounted || !currentUser) return;
    if (currentUser.role !== 'Team Leader' && currentUser.role !== 'Employee') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchVisibleDirectory();
        if (cancelled) return;
        const { replaceDirectoryUsers, setCurrentUser } = useStore.getState();
        replaceDirectoryUsers(visibleDirectoryMembersToUsers(res));
        const latest = useStore.getState().currentUser;
        if (latest && res.team_name) {
          const ws = res.work_site?.trim();
          setCurrentUser({
            ...latest,
            team: res.team_name.trim(),
            workSite: ws && ws.length > 0 ? ws : latest.workSite,
          });
        }
      } catch {
        /* offline or not on a team yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, currentUser?.id, currentUser?.role]);

  return (
    <>
      {mounted ? <ToastViewport /> : null}
      {children}
    </>
  );
}
