'use client';

import {
  fetchLeaveRequestsApi,
  fetchManualRequestsApi,
} from '@/services/attendance-requests.service';
import {
  buildUsersWithResolvedTeams,
  fetchVisibleDirectory,
  visibleDirectoryMembersToUsers,
} from '@/services/team.service';
import { useStore } from '@/lib/store';
import { resolveSocketBaseUrl } from '@/lib/api/api-base-urls';
import { io } from 'socket.io-client';
import { useEffect } from 'react';

const APP_BACKGROUND_SYNC_MS = 35_000;

async function refreshDirectoryFromApi() {
  const { currentUser, replaceDirectoryUsers } = useStore.getState();
  if (!currentUser) return;
  try {
    if (currentUser.role === 'Admin' || currentUser.role === 'HR') {
      const merged = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(merged);
    } else if (currentUser.role === 'Team Leader' || currentUser.role === 'Employee') {
      const dir = await fetchVisibleDirectory();
      replaceDirectoryUsers(visibleDirectoryMembersToUsers(dir));
    }
  } catch {
    /* best-effort */
  }
}

async function runAppBackgroundSync() {
  const st = useStore.getState();
  if (!st.currentUser) return;
  await st.refreshAttendanceFromApi().catch(() => {});
  await st.refreshTasksFromApi({ bumpList: false }).catch(() => {});
  try {
    const [leaveRows, manualRows] = await Promise.all([
      fetchLeaveRequestsApi(),
      fetchManualRequestsApi(),
    ]);
    st.setLeaveRequests(leaveRows);
    st.setManualTimeRequests(manualRows);
  } catch {
    /* keep lists */
  }
  await refreshDirectoryFromApi();
  await st.refreshNotificationsFromApi().catch(() => {});
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser?.id) return;
    void runAppBackgroundSync();
    const id = window.setInterval(() => void runAppBackgroundSync(), APP_BACKGROUND_SYNC_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void runAppBackgroundSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const base = resolveSocketBaseUrl();
    if (!base || !currentUser) {
      return;
    }

    const pending = new Set<string>();
    let chatMessageTarget: string | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      flushTimer = undefined;
      const scopes = [...pending];
      pending.clear();
      const focusChatId = chatMessageTarget;
      chatMessageTarget = null;

      void (async () => {
        const st = useStore.getState();
        try {
          if (scopes.includes('notifications')) await st.refreshNotificationsFromApi();
          if (scopes.includes('tasks')) await st.refreshTasksFromApi();
          if (scopes.includes('attendance')) await st.refreshAttendanceFromApi();
          if (scopes.includes('requests')) {
            await st.refreshAttendanceFromApi();
            try {
              const [leaveRows, manualRows] = await Promise.all([
                fetchLeaveRequestsApi(),
                fetchManualRequestsApi(),
              ]);
              st.setLeaveRequests(leaveRows);
              st.setManualTimeRequests(manualRows);
            } catch {
              /* keep lists */
            }
          }
          if (scopes.includes('chat')) {
            await st.syncChatThreads();
            if (focusChatId) {
              await st.syncChatMessages(focusChatId);
            } else {
              // Fallback when upstream event has no chatId: still refresh unread count quickly.
              await st.syncAllChatMessagesForUnread();
            }
          }
          if (scopes.includes('directory')) await refreshDirectoryFromApi();
          if (scopes.includes('daily')) {
            window.dispatchEvent(
              new CustomEvent<{ scopes: string[] }>('gdc-realtime-dirty', {
                detail: { scopes: ['daily-updates'] },
              }),
            );
          }
        } catch {
          /* best-effort */
        }
      })();
    };

    const schedule = (scopes: string[], opts?: { messageChatId?: string }) => {
      for (const s of scopes) pending.add(s);
      if (opts?.messageChatId) chatMessageTarget = opts.messageChatId;
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 450);
    };

    const socket = io(base, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const onConnect = () => {
      socket.emit('register', {
        userId: currentUser.id,
        joinAdminRoom: currentUser.role === 'Admin' || currentUser.role === 'HR',
      });
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    // Join/leave chat rooms when the chat screen focus changes (WhatsApp-like)
    let lastJoined: string | null = null;
    let lastSeenActiveId: string | null = useStore.getState().activeMessagesChatId;
    const unsub = useStore.subscribe((s) => {
      const next: string | null = s.activeMessagesChatId;
      if (next === lastSeenActiveId) return;
      lastSeenActiveId = next;
      if (lastJoined) socket.emit('leaveRoom', lastJoined);
      lastJoined = next ? String(next) : null;
      if (lastJoined) socket.emit('joinRoom', lastJoined);
    });

    socket.on('receiveMessage', (payload: { chatId?: string; message?: any }) => {
      const st = useStore.getState();
      const chatId = payload?.chatId != null ? String(payload.chatId) : '';
      const hasThreadAlready = chatId
        ? st.chatThreads.some((t) => String(t.id) === chatId)
        : false;
      st.applyRealtimeReceivedMessage({
        chatId,
        message: payload?.message ?? null,
      });
      // Only fallback-sync when this thread is not yet in local list.
      if (chatId && !hasThreadAlready) {
        void st.syncChatThreads().then(() => st.syncChatMessages(chatId, { skipReconcile: false }));
      }
    });

    socket.on('newNotification', () => schedule(['notifications']));
    socket.on('task.updated', () => schedule(['tasks']));
    socket.on('chat.message', (payload: { chatId?: string }) => {
      const id = payload?.chatId != null ? String(payload.chatId) : '';
      schedule(['chat'], id ? { messageChatId: id } : undefined);
    });
    socket.on('chat.thread.updated', () => schedule(['chat']));
    socket.on('leave.updated', () => schedule(['requests']));
    socket.on('manualTime.updated', () => schedule(['requests']));
    socket.on('attendance.updated', () => schedule(['attendance']));
    socket.on('dailyUpdates.updated', () => schedule(['daily']));
    socket.on('team.roster.updated', () => schedule(['directory', 'tasks']));
    socket.on('admin.directory.updated', () => schedule(['directory']));

    return () => {
      unsub();
      socket.off('connect', onConnect);
      socket.disconnect();
      if (flushTimer !== undefined) clearTimeout(flushTimer);
    };
    // Intentionally keyed on id + role so reconnects do not fire when the same user is re-instantiated by the store.
 
  }, [currentUser?.id, currentUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps -- see above

  return <>{children}</>;
}
