'use client';

/**
 * Subscribes to GDC Socket.IO chat rooms so other participants’ messages appear quickly.
 *
 * Flow: chat-backend persists to PostgreSQL and notifies gdc-backend → Socket.IO emits
 * `receiveMessage` / `chat.message` into `chat:{chatId}` rooms. This hook joins that room
 * and refetches messages (deduped server state). A future Mongo-backed service could swap
 * persistence without changing this client contract.
 */
import { resolveSocketBaseUrl } from '@/lib/api/api-base-urls';
import { useStore } from '@/lib/store';
import { io } from 'socket.io-client';
import { useEffect } from 'react';

export type UseGdcChatRoomSocketOptions = {
  /** Active thread id (PostgreSQL chat id from CRM store). */
  chatId: string | null;
  userId: string | undefined;
  /** Set false to disable (tests / SSR). */
  enabled?: boolean;
};

export function useGdcChatRoomSocket({ chatId, userId, enabled = true }: UseGdcChatRoomSocketOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !userId || !chatId) return;

    const base = resolveSocketBaseUrl();
    if (!base) return;

    const socket = io(base, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
    });
    const refetch = () => {
      void useStore.getState().syncChatMessages(chatId, {});
    };

    const onReceive = (payload: { chatId?: string } | null) => {
      const id = payload && typeof payload.chatId === 'string' ? payload.chatId : '';
      if (id && id === chatId) refetch();
    };

    socket.on('connect', () => {
      socket.emit('register', { userId });
      socket.emit('joinRoom', chatId);
    });

    socket.on('receiveMessage', onReceive);
    socket.on('chat.message', onReceive);

    socket.on('connect_error', () => {
      /* Dev without backend: stay silent; polling still works via periodic sync elsewhere */
    });

    return () => {
      socket.emit('leaveRoom', chatId);
      socket.off('receiveMessage', onReceive);
      socket.off('chat.message', onReceive);
      socket.disconnect();
    };
  }, [chatId, userId, enabled]);
}
