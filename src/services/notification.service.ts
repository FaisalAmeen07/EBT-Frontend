import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiClient } from '@/lib/api/axios.config';
import { isAxiosError } from 'axios';

export type NotificationCategory = 'attendance' | 'task' | 'request' | 'system';

export interface NotificationDto {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  read: boolean;
  createdAt: string;
  eventKey?: string;
  targetPath?: string;
}

const CATEGORY_SET = new Set<string>(['attendance', 'task', 'request', 'system']);

function normalizeCategory(raw: unknown): NotificationCategory {
  const c = String(raw ?? 'system').toLowerCase();
  return (CATEGORY_SET.has(c) ? c : 'system') as NotificationCategory;
}

/** Normalize one row from GET/POST — supports camelCase or legacy snake_case. */
export function normalizeNotificationRow(raw: unknown): NotificationDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  const created =
    typeof r.createdAt === 'string'
      ? r.createdAt
      : typeof r.created_at === 'string'
        ? r.created_at
        : r.created_at instanceof Date
          ? (r.created_at as Date).toISOString()
          : new Date().toISOString();
  return {
    id,
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    category: normalizeCategory(r.category),
    read: Boolean(r.read ?? r.is_read),
    createdAt: created,
    ...(typeof r.eventKey === 'string' && r.eventKey
      ? { eventKey: r.eventKey }
      : typeof r.event_key === 'string' && r.event_key
        ? { eventKey: r.event_key }
        : {}),
    ...(typeof r.targetPath === 'string' && r.targetPath
      ? { targetPath: r.targetPath }
      : typeof r.target_path === 'string' && r.target_path
        ? { targetPath: r.target_path }
        : {}),
  };
}

interface NotificationApiResponse {
  success?: boolean;
  data?: unknown;
}

interface NotificationCreateResponse {
  success?: boolean;
  data?: unknown;
}

function extractList(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.data)) return b.data;
  if (Array.isArray(b)) return body as unknown[];
  return [];
}

export async function fetchMyNotificationsApi(limit = 100): Promise<NotificationDto[]> {
  const res = await apiClient.get<NotificationApiResponse>(API_PATHS.auth.notifications, {
    params: { limit },
  });
  return extractList(res.data)
    .map((item) => normalizeNotificationRow(item))
    .filter((n): n is NotificationDto => n != null);
}

export async function createMyNotificationApi(input: {
  title: string;
  description: string;
  category?: NotificationCategory;
  eventKey?: string;
  targetPath?: string;
}): Promise<NotificationDto | null> {
  try {
    const res = await apiClient.post<NotificationCreateResponse>(API_PATHS.auth.notifications, input);
    return normalizeNotificationRow(res.data?.data);
  } catch (e) {
    if (process.env.NODE_ENV === 'development' && isAxiosError(e)) {
      console.warn('[notifications] POST failed', e.response?.status, e.response?.data ?? e.message);
    }
    return null;
  }
}

export async function markMyNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(API_PATHS.auth.markNotificationRead(id));
}

export async function markAllMyNotificationsReadApi(): Promise<void> {
  await apiClient.patch(API_PATHS.auth.markAllNotificationsRead);
}

export async function deleteMyNotificationApi(id: string): Promise<void> {
  await apiClient.delete(API_PATHS.auth.deleteNotification(id));
}

export async function clearMyNotificationsApi(): Promise<void> {
  await apiClient.delete(API_PATHS.auth.notifications);
}
