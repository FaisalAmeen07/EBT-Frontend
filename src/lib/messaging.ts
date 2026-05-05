import type { Role, User } from '@/lib/store';

export type ChatScope = 'dm' | 'group' | 'hr_group' | 'tl_group';

/** Client-side attachment (data URL); demo / local persistence only. */
export interface ChatAttachment {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

/** Shown when this message was forwarded from another chat (like WhatsApp). */
export interface ForwardedFromMeta {
  /** Chat name / DM peer title where the message came from. */
  sourceChatTitle: string;
  originalAuthorId: string;
  originalAuthorName: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  /** Sender (same as authorId; kept for clarity vs DB-style naming). */
  senderId?: string;
  authorId: string;
  body: string;
  createdAt: string;
  /** DM: the peer user id this message is for; groups: null. */
  receiverId?: string | null;
  /** Group / channel id when message is to a group (usually same as chatId). */
  groupId?: string | null;
  /**
   * User IDs who have read this message (read receipts).
   * Unread for viewer = incoming message where viewer id is not in this list.
   */
  readByUserIds?: string[];
  /** Optional file or image sent with the message. */
  attachment?: ChatAttachment;
  /** Set when message text was edited. */
  editedAt?: string;
  /** Soft-delete: content hidden, id kept for reply chains. */
  deleted?: boolean;
  /** Reply to another message in the same thread. */
  replyToId?: string;
  /** Copied from another conversation; original sender preserved for clarity. */
  forwardedFrom?: ForwardedFromMeta;
}

/** Whether `userId` has read this message (derived from readByUserIds). */
export function isMessageReadByUser(m: ChatMessage, userId: string): boolean {
  return (m.readByUserIds ?? []).includes(userId);
}

/** DM: other member; group: null / group id via groupId. */
export function resolveMessageRecipients(
  thread: ChatThread,
  authorId: string
): { receiverId: string | null; groupId: string | null } {
  if (thread.kind === 'dm') {
    const other = thread.memberIds.find((id) => id !== authorId) ?? null;
    return { receiverId: other, groupId: null };
  }
  return { receiverId: null, groupId: thread.id };
}

export function normalizeChatMessage(m: ChatMessage, thread: ChatThread): ChatMessage {
  const { receiverId, groupId } = resolveMessageRecipients(thread, m.authorId);
  return {
    ...m,
    senderId: m.senderId ?? m.authorId,
    readByUserIds: m.readByUserIds ?? [],
    receiverId: m.receiverId ?? receiverId,
    groupId: m.groupId ?? groupId,
  };
}

/** Migrate persisted threads: fill read receipts + ids; optional last-read watermark from legacy store. */
export function migrateChatThreadsForReadReceipts(
  threads: ChatThread[],
  legacyChatLastReadAt?: Record<string, string>
): ChatThread[] {
  return threads.map((thread) => {
    const lr = legacyChatLastReadAt?.[thread.id];
    const lrMs = lr ? new Date(lr).getTime() : 0;
    return {
      ...thread,
      messages: thread.messages.map((m) => {
        const base = normalizeChatMessage(m, thread);
        if ((base.readByUserIds?.length ?? 0) > 0) return base;
        const t = new Date(base.createdAt).getTime();
        const impliedRead =
          lrMs > 0 && t <= lrMs
            ? thread.memberIds.filter((id) => id !== base.authorId)
            : [];
        return { ...base, readByUserIds: impliedRead };
      }),
    };
  });
}

export interface ChatThread {
  id: string;
  kind: 'dm' | 'group';
  scope: ChatScope;
  /** Group: display name */
  name?: string;
  /** Group: optional photo (data URL, client-only). */
  avatarUrl?: string;
  /** When set, this thread is the auto team chat for this team name. */
  teamKey?: string;
  createdById?: string;
  /** Present on group chats: CRM user ids promoted as group admins. */
  adminIds?: string[];
  /** When true, only group admins (+ scope rules) may add members. */
  privacyLockedInvites?: boolean;
  /** When true, only group admins may send messages (announcements-style). */
  adminsOnlyMessages?: boolean;
  /** DM: two user ids sorted; same as memberIds for dm */
  memberIds: string[];
  messages: ChatMessage[];
}

/** Stable id for the auto-created team group chat. */
export function teamGroupChatId(teamName: string): string {
  const slug = teamName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `team-g-${slug || 'team'}`;
}

/** DM permission matrix (From → To). Pending users cannot DM. */
export function canDm(from: Role, to: Role): boolean {
  if (from === 'Pending User' || to === 'Pending User') return false;
  if (from === 'Admin') return to === 'HR' || to === 'Team Leader' || to === 'Employee';
  if (from === 'HR') return to === 'Admin' || to === 'Team Leader' || to === 'Employee';
  if (from === 'Team Leader') return to === 'HR' || to === 'Employee';
  if (from === 'Employee') return to === 'Admin' || to === 'HR' || to === 'Team Leader';
  return false;
}

export function dmKeyFor(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

/** Sidebar / header title for a thread (same logic as chat list labels). */
export function chatThreadTitle(
  thread: ChatThread,
  currentUserId: string,
  userName: (id: string) => string
): string {
  if (thread.kind === 'dm') {
    const other = thread.memberIds.find((id) => id !== currentUserId);
    return other ? userName(other) : 'Direct message';
  }
  return thread.name || 'Group';
}

/**
 * Unread = messages from others where current user is a recipient and has not read yet
 * (readByUserIds does not include currentUserId).
 */
export function unreadCountForThread(thread: ChatThread, currentUserId: string): number {
  return thread.messages.filter((m) => isIncomingUnreadForUser(m, currentUserId)).length;
}

function isIncomingUnreadForUser(m: ChatMessage, viewerId: string): boolean {
  if (m.deleted) return false;
  if (m.authorId === viewerId) return false;
  return !isMessageReadByUser(m, viewerId);
}

/** Total unread across all chats the viewer can see (sidebar badge). */
export function totalUnreadMessagesForViewer(threads: ChatThread[], viewer: User, allUsers: User[]): number {
  let n = 0;
  for (const t of threads) {
    if (!isThreadVisibleToViewer(t, viewer, allUsers)) continue;
    n += unreadCountForThread(t, viewer.id);
  }
  return n;
}

function roleOf(userId: string, users: User[]): Role | null {
  return users.find((u) => u.id === userId)?.role ?? null;
}

/** Whether `viewer` may see this thread in the sidebar / open it. */
export function isThreadVisibleToViewer(
  thread: ChatThread,
  viewer: User,
  _users: User[]
): boolean {
  if (viewer.role === 'Pending User') return false;

  if (thread.kind === 'dm') {
    return thread.memberIds.includes(viewer.id);
  }

  if (!thread.memberIds.includes(viewer.id)) return false;

  if (thread.scope === 'group') return true;

  if (thread.scope === 'hr_group') {
    return true;
  }

  if (thread.scope === 'tl_group') {
    return true;
  }

  return false;
}

function effectiveGroupAdminIds(thread: ChatThread): string[] {
  if (thread.kind !== 'group') return [];
  const explicit = (thread.adminIds ?? []).map((x) => String(x).trim()).filter(Boolean);
  if (explicit.length > 0) return [...new Set(explicit)];
  if (thread.createdById) return [String(thread.createdById).trim()];
  return [];
}

/** Group chat: user is a group admin (can post when admins-only mode is on). Mirrors chat-backend `isGroupAdmin`. */
export function isGroupMessagingAdmin(thread: ChatThread, user: User): boolean {
  if (thread.kind !== 'group') return true;
  return effectiveGroupAdminIds(thread).includes(String(user.id).trim());
}

/** Whether `user` may post a new message in this thread. */
export function canSendInThread(
  thread: ChatThread,
  user: User,
  users: User[]
): boolean {
  if (user.role === 'Pending User') return false;
  const isMember = thread.memberIds.some((mid) => String(mid) === String(user.id));
  if (!isMember) return false;

  if (thread.kind === 'dm') {
    const otherId = thread.memberIds.find((id) => String(id) !== String(user.id));
    if (!otherId) return false;
    const otherRole = roleOf(String(otherId), users);
    const otherUser = users.find((u) => String(u.id) === String(otherId));
    if (!otherRole) return true;
    if (!otherUser) return canDm(user.role, otherRole);
    return canDmPair(user, otherUser);
  }

  if (thread.kind === 'group') {
    if (thread.adminsOnlyMessages && !isGroupMessagingAdmin(thread, user)) return false;
    const r = user.role;
    if (thread.scope === 'group') return true;
    if (thread.scope === 'hr_group') {
      return r === 'Admin' || r === 'HR' || r === 'Team Leader' || r === 'Employee';
    }
    if (thread.scope === 'tl_group') {
      return r === 'Admin' || r === 'HR' || r === 'Team Leader' || r === 'Employee';
    }
  }

  return false;
}

/** DM pair check (includes same-team employees messaging each other). */
export function canDmPair(viewer: User, target: User): boolean {
  if (!viewer || !target || viewer.role === 'Pending User' || target.role === 'Pending User') {
    return false;
  }
  if (!canDm(viewer.role, target.role)) return false;

  // Employee restriction:
  // - Employees may DM Admin/HR.
  // - Employees may DM only their Team Leader (same team).
  // - Employees may not DM other employees.
  if (viewer.role === 'Employee') {
    if (target.role === 'Admin' || target.role === 'HR') return true;
    if (target.role === 'Team Leader') {
      const vt = viewer.team?.trim();
      const tt = target.team?.trim();
      return !!vt && !!tt && vt === tt;
    }
    return false;
  }

  return true;
}

/** Users that can be picked as DM targets for `viewer`. */
export function dmTargetUserIds(viewer: User, users: User[]): string[] {
  if (!viewer || viewer.role === 'Pending User') return [];
  return users
    .filter((u) => u.id !== viewer.id && u.role !== 'Pending User')
    .filter((u) => canDmPair(viewer, u))
    .map((u) => u.id);
}

/** Who can be added to a new HR-scoped group (creator is HR). */
export function canAddToHrGroup(user: User): boolean {
  return (
    user.role === 'Admin' || user.role === 'HR' || user.role === 'Team Leader' || user.role === 'Employee'
  );
}

/** Who can be added to a new TL-scoped group (creator is TL). */
export function canAddToTlGroup(user: User): boolean {
  return user.role === 'HR' || user.role === 'Team Leader' || user.role === 'Employee';
}

/** Who can be added to a normal group chat. */
export function canAddToGroup(user: User): boolean {
  return user.role !== 'Pending User';
}
