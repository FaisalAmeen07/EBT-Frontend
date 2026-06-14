'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Send,
  Users,
  ChevronLeft,
  ChevronDown,
  X,
  Search,
  Lock,
  Hash,
  SquarePen,
  MoreVertical,
  Paperclip,
  FileText,
  Reply,
  Pencil,
  Trash2,
  Forward,
  Camera,
  UserMinus,
  Check,
  CheckCheck,
  Pin,
  Crown,
  Info,
  Copy,
  Download,
} from 'lucide-react';
import {
  useStore,
  useShallow,
  canManageGroupSettings,
  canDeleteGroup,
  canAddMembersToGroupThread,
  isGroupThreadAdmin,
  groupThreadAdminIds,
} from '@/lib/store';
import type { User } from '@/lib/store';
import type { ChatAttachment, ChatMessage, ChatThread } from '@/lib/messaging';
import {
  isThreadVisibleToViewer,
  canSendInThread,
  isGroupMessagingAdmin,
  dmTargetUserIds,
  canAddToGroup,
  canAddToHrGroup,
  canAddToTlGroup,
  chatThreadTitle,
  unreadCountForThread,
} from '@/lib/messaging';
import { format, isSameDay, isToday } from 'date-fns';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/file-upload-limits';
import { useSearchParams } from 'next/navigation';
import { useGdcChatRoomSocket } from '@/hooks/useGdcChatRoomSocket';

function lastActivityMs(thread: ChatThread): number {
  const last = thread.messages[thread.messages.length - 1];
  return last ? new Date(last.createdAt).getTime() : 0;
}

const CHAT_PINS_STORAGE_PREFIX = 'gdc-crm-chat-pins:';
const MAX_PINNED_CHATS = 30;

function readPinnedThreadIds(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${CHAT_PINS_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePinnedThreadIds(userId: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${CHAT_PINS_STORAGE_PREFIX}${userId}`, JSON.stringify(ids));
  } catch {
    /* storage full / private mode */
  }
}

/** Rough size from base64 data URL (for file subtitle like WhatsApp). */
function approxSizeFromDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : '';
  if (!base64) return '';
  let pad = 0;
  if (base64.endsWith('==')) pad = 2;
  else if (base64.endsWith('=')) pad = 1;
  const bytes = (base64.length * 3) / 4 - pad;
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} KB`;
  return `${(bytes / 1024).toFixed(1)} MB`;
}

function fileExtensionBadge(fileName: string, mimeType: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).trim() : '';
  if (ext && ext.length <= 8) return ext.toUpperCase();
  const sub = mimeType.split('/')[1];
  return sub ? sub.split('+')[0].toUpperCase().slice(0, 8) : 'FILE';
}

function mimeShortLabel(mimeType: string): string {
  const sub = mimeType.split('/')[1];
  return sub ? sub.split('+')[0].toUpperCase() : 'FILE';
}

function VoiceMenuDivider() {
  return <div className="mx-1.5 my-0.5 h-px bg-gradient-to-r from-transparent via-violet-200/80 to-transparent dark:via-slate-600/80" role="separator" />;
}

function VoiceMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium leading-tight tracking-tight transition-colors ${
        danger
          ? 'text-rose-600 hover:bg-rose-50/95 [&_.menu-icon]:text-rose-500'
          : 'text-slate-700 dark:text-slate-200 hover:bg-violet-50/95 active:bg-violet-100/60 [&_.menu-icon]:text-violet-600'
      }`}
      onClick={onClick}
    >
      <span className="menu-icon flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:stroke-[1.9]">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function messageSnippet(m: ChatMessage): string {
  if (m.deleted) return 'Message deleted';
  if (m.body.trim()) return m.body.length > 100 ? `${m.body.slice(0, 100)}…` : m.body;
  if (m.attachment) {
    return `📎 ${m.attachment.fileName}`;
  }
  return '';
}

/** Sidebar preview: "You: …" / "Name: …" so sender is obvious (like WhatsApp). */
function lastMessagePreviewWithSender(
  last: ChatMessage | undefined,
  currentUserId: string,
  userName: (id: string) => string
): string | null {
  if (!last) return null;
  const snippet = messageSnippet(last);
  const who = last.authorId === currentUserId ? 'You' : userName(last.authorId);
  return `${who}: ${snippet}`;
}

/** Green = available, yellow = unavailable, red = offline / on leave / pending */
function presenceDotClass(user: User | undefined): string {
  if (!user) return 'bg-red-500';
  if (user.role === 'Pending User') return 'bg-red-500';
  if (user.status === 'Unavailable') return 'bg-yellow-400';
  if (user.status === 'Leave') return 'bg-red-500';
  if (user.status === 'Available') return 'bg-emerald-500';
  return 'bg-emerald-500';
}

function presenceTextClass(user: User | undefined): string {
  if (!user) return 'text-red-600';
  if (user.role === 'Pending User') return 'text-red-600';
  if (user.status === 'Unavailable') return 'text-yellow-600';
  if (user.status === 'Leave') return 'text-red-600';
  if (user.status === 'Available') return 'text-emerald-600';
  return 'text-emerald-600';
}

function presenceLabel(user: User | undefined): string {
  if (!user) return 'Offline';
  if (user.role === 'Pending User') return 'Offline';
  if (user.status === 'Unavailable') return 'Unavailable';
  if (user.status === 'Leave') return 'Offline';
  if (user.status === 'Available') return 'Available';
  return 'Available';
}

function UserAvatar({
  userId,
  users,
  size = 'md',
  variant = 'message',
  shape = 'rounded',
  presenceDot = true,
}: {
  userId: string;
  users: User[];
  size?: 'sm' | 'md' | 'lg';
  /** list | message: availability dot (no role letters on bubbles) */
  variant?: 'message' | 'list';
  shape?: 'rounded' | 'circle';
  /** Hide green/yellow presence dot when a custom badge is shown instead */
  presenceDot?: boolean;
}) {
  const u = users.find((x) => String(x.id) === String(userId));
  const initial = u?.name?.charAt(0).toUpperCase() ?? '?';
  const src = u?.avatar;
  const dim = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  const dotDim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const roundClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  return (
    <div className="relative shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or data URL
        <img src={src} alt="" className={`${roundClass} object-cover ${dim}`} />
      ) : (
        <div
          className={`flex items-center justify-center ${roundClass} bg-gradient-to-br from-[#6366f1] to-[#7c3aed] font-bold text-white shadow-inner ring-2 ring-white ${dim}`}
        >
          {initial}
        </div>
      )}
      {(variant === 'list' || variant === 'message') && u && presenceDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white ${dotDim} ${presenceDotClass(u)}`}
          title={presenceLabel(u)}
          aria-hidden
        />
      )}
    </div>
  );
}

function ThreadListAvatar({
  thread,
  currentUserId,
  users,
  compact = false,
}: {
  thread: ChatThread;
  currentUserId: string;
  users: User[];
  /** Narrow sidebar rows: smaller avatar */
  compact?: boolean;
}) {
  const box = compact ? 'h-9 w-9' : 'h-11 w-11';
  if (thread.kind === 'dm') {
    const other = thread.memberIds.find((id) => String(id) !== String(currentUserId));
    if (!other) return <div className={`${box} shrink-0 rounded-xl bg-slate-200`} />;
    return <UserAvatar userId={other} users={users} size={compact ? 'sm' : 'md'} variant="list" />;
  }
  if (thread.kind === 'group') {
    const fallbackAvatar =
      thread.createdById != null &&
      thread.createdById !== '' &&
      users.find((u) => String(u.id) === String(thread.createdById))?.avatar;
    const src = thread.avatarUrl || fallbackAvatar;
    if (src) {
      return (
        <div className={`relative ${box} shrink-0 overflow-hidden rounded-xl ring-2 ring-white/90 shadow-inner`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user or group avatar URL */}
          <img src={src} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className={`relative flex ${box} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner ring-2 ring-white/90`}
      >
        <Hash className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2} />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-md border-2 border-white bg-indigo-600 px-0.5 text-[7px] font-bold text-white">
          G
        </span>
      </div>
    );
  }
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const {
    currentUser,
    users,
    chatThreads,
    syncChatThreads,
    syncChatMessages,
    searchChatMessages,
    hydrateChatParticipantUsers,
    promoteGroupAdmin,
    demoteGroupAdmin,
    sendChatMessage,
    editChatMessage,
    deleteChatMessage,
    forwardChatMessage,
    openOrCreateDm,
    createGroupChat,
    addMembersToGroup,
    removeMembersFromGroup,
    leaveGroupChat,
    updateGroupChat,
    deleteGroupChat,
    markChatRead,
  } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      chatThreads: s.chatThreads,
      syncChatThreads: s.syncChatThreads,
      syncChatMessages: s.syncChatMessages,
      searchChatMessages: s.searchChatMessages,
      hydrateChatParticipantUsers: s.hydrateChatParticipantUsers,
      promoteGroupAdmin: s.promoteGroupAdmin,
      demoteGroupAdmin: s.demoteGroupAdmin,
      sendChatMessage: s.sendChatMessage,
      editChatMessage: s.editChatMessage,
      deleteChatMessage: s.deleteChatMessage,
      forwardChatMessage: s.forwardChatMessage,
      openOrCreateDm: s.openOrCreateDm,
      createGroupChat: s.createGroupChat,
      addMembersToGroup: s.addMembersToGroup,
      removeMembersFromGroup: s.removeMembersFromGroup,
      leaveGroupChat: s.leaveGroupChat,
      updateGroupChat: s.updateGroupChat,
      deleteGroupChat: s.deleteGroupChat,
      markChatRead: s.markChatRead,
    }))
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchQ, setMsgSearchQ] = useState('');
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  const [msgSearchResults, setMsgSearchResults] = useState<ChatMessage[]>([]);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearchQ, setThreadSearchQ] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [newGroupPrivacyLocked, setNewGroupPrivacyLocked] = useState(false);
  const [newGroupAdminsOnlyMessages, setNewGroupAdminsOnlyMessages] = useState(false);
  const [addUserIds, setAddUserIds] = useState<string[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [messageBubbleMenu, setMessageBubbleMenu] = useState<{
    messageId: string;
    top: number;
    left: number;
    message: ChatMessage;
    mine: boolean;
  } | null>(null);
  const [messageBubbleInfo, setMessageBubbleInfo] = useState<ChatMessage | null>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [groupModalAddIds, setGroupModalAddIds] = useState<string[]>([]);
  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetChatId = searchParams.get('chatId');
  const targetMessageId = searchParams.get('messageId');

  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!currentUser?.id) {
        setPinnedThreadIds([]);
        return;
      }
      setPinnedThreadIds(readPinnedThreadIds(currentUser.id));
    });
  }, [currentUser?.id]);

  const togglePinThread = useCallback(
    (threadId: string) => {
      if (!currentUser?.id) return;
      setPinnedThreadIds((prev) => {
        const i = prev.indexOf(threadId);
        if (i >= 0) {
          const next = prev.filter((id) => id !== threadId);
          writePinnedThreadIds(currentUser.id!, next);
          queueMicrotask(() => setErrorHint(null));
          return next;
        }
        if (prev.length >= MAX_PINNED_CHATS) {
          queueMicrotask(() =>
            setErrorHint(`You can pin up to ${MAX_PINNED_CHATS} chats. Unpin one first.`),
          );
          return prev;
        }
        const next = [threadId, ...prev];
        writePinnedThreadIds(currentUser.id!, next);
        queueMicrotask(() => setErrorHint(null));
        return next;
      });
    },
    [currentUser],
  );

  const userName = useCallback(
    (id: string) => users.find((u) => String(u.id) === String(id))?.name ?? 'Unknown',
    [users],
  );

  const visibleThreads = useMemo(() => {
    if (!currentUser) return [];
    const filtered = chatThreads.filter((t) => isThreadVisibleToViewer(t, currentUser, users));
    const byActivity = (a: ChatThread, b: ChatThread) => lastActivityMs(b) - lastActivityMs(a);
    const pinSet = new Set(pinnedThreadIds);
    const pinned: ChatThread[] = [];
    for (const id of pinnedThreadIds) {
      const t = filtered.find((x) => x.id === id);
      if (t) pinned.push(t);
    }
    const unpinned = filtered.filter((t) => !pinSet.has(t.id)).sort(byActivity);
    return [...pinned, ...unpinned];
  }, [chatThreads, currentUser, users, pinnedThreadIds]);

  const visibleThreadsFiltered = useMemo(() => {
    const q = threadSearchQ.trim().toLowerCase();
    if (!q) return visibleThreads;
    return visibleThreads.filter((t) => {
      const title = chatThreadTitle(t, currentUser?.id ?? '', userName).toLowerCase();
      const last = t.messages[t.messages.length - 1];
      const preview = last ? messageSnippet(last).toLowerCase() : '';
      return title.includes(q) || preview.includes(q);
    });
  }, [visibleThreads, threadSearchQ, currentUser?.id, userName]);

  const selected = useMemo(
    () => visibleThreads.find((t) => t.id === selectedId) ?? visibleThreads[0] ?? null,
    [visibleThreads, selectedId]
  );

  useEffect(() => {
    if (!currentUser) return;
    const ids = new Set<string>();
    for (const t of visibleThreads) {
      for (const mid of t.memberIds) ids.add(String(mid));
      for (const m of t.messages) ids.add(String(m.authorId));
    }
    void hydrateChatParticipantUsers([...ids]);
  }, [currentUser, visibleThreads, hydrateChatParticipantUsers]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!selectedId && visibleThreads[0]) setSelectedId(visibleThreads[0].id);
    });
  }, [visibleThreads, selectedId]);

  useEffect(() => {
    if (!targetChatId) return;
    const exists = visibleThreads.some((t) => t.id === targetChatId);
    if (!exists) return;
    queueMicrotask(() => {
      setSelectedId((prev) => (prev === targetChatId ? prev : targetChatId));
    });
  }, [targetChatId, visibleThreads]);

  useEffect(() => {
    const { setActiveMessagesChatId } = useStore.getState();
    setActiveMessagesChatId(selectedId);
    return () => {
      setActiveMessagesChatId(null);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !currentUser) return;
    void markChatRead(selectedId);
  }, [selectedId, selected?.messages.length, currentUser, markChatRead]);

  useEffect(() => {
    if (!currentUser) return;
    void syncChatThreads();
  }, [currentUser, syncChatThreads]);

  useEffect(() => {
    if (!selectedId || !currentUser) return;
    void syncChatMessages(selectedId);
  }, [selectedId, currentUser, syncChatMessages]);

  useEffect(() => {
    if (!targetChatId || !targetMessageId) return;
    if (selected?.id !== targetChatId) return;
    const node = messageRefs.current[targetMessageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [targetChatId, targetMessageId, selected?.id, selected?.messages.length]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length, selected?.id]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!messageBubbleMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMessageBubbleMenu(null);
    };
    const onScroll = () => setMessageBubbleMenu(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [messageBubbleMenu]);

  useEffect(() => {
    if (!messageBubbleInfo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMessageBubbleInfo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [messageBubbleInfo]);

  useEffect(() => {
    if (!forwardingMessage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForwardingMessage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forwardingMessage]);

  useEffect(() => {
    if (groupInfoOpen && selected?.kind === 'group') {
      queueMicrotask(() => {
        setGroupNameEdit(selected.name ?? '');
        setGroupModalAddIds([]);
      });
    }
  }, [groupInfoOpen, selected?.id, selected?.kind, selected?.name]);

  useEffect(() => {
    if (!groupInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGroupInfoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [groupInfoOpen]);

  useEffect(() => {
    queueMicrotask(() => {
      setReplyingTo(null);
      setEditingId(null);
      setDraft('');
      setPendingAttachment(null);
      setMessageBubbleMenu(null);
      setMessageBubbleInfo(null);
    });
  }, [selectedId]);

  const canSend = currentUser && selected ? canSendInThread(selected, currentUser, users) : false;

  /** Socket.IO: refetch messages when peers post (gdc-backend relay + chat-backend persistence). */
  useGdcChatRoomSocket({
    chatId: selectedId,
    userId: currentUser?.id,
    enabled: Boolean(currentUser?.id && selectedId),
  });

  const handleSend = async () => {
    if (!selected || !canSend) return;
    setErrorHint(null);
    if (editingId) {
      const r = await editChatMessage(selected.id, editingId, draft);
      if (r.ok) {
        setDraft('');
        setEditingId(null);
      } else setErrorHint(r.error ?? 'Could not save');
      return;
    }
    const r = await sendChatMessage(selected.id, {
      body: draft,
      attachment: pendingAttachment,
      replyToId: replyingTo?.id ?? null,
    });
    if (r.ok) {
      setDraft('');
      setPendingAttachment(null);
      setReplyingTo(null);
    } else setErrorHint(r.error ?? 'Could not send');
  };

  const startEditMessage = (m: ChatMessage) => {
    setReplyingTo(null);
    setEditingId(m.id);
    setDraft(m.body);
    setPendingAttachment(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const handleDeleteMessage = async (m: ChatMessage) => {
    if (!selected || !currentUser || m.authorId !== currentUser.id) return;
    if (!window.confirm('Delete this message for everyone?')) return;
    setErrorHint(null);
    const r = await deleteChatMessage(selected.id, m.id);
    if (!r.ok) setErrorHint(r.error ?? 'Could not delete');
    if (editingId === m.id) cancelEdit();
  };

  const openMessageBubbleMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>, m: ChatMessage, isMine: boolean) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 176;
    const left = Math.min(window.innerWidth - menuW - 8, Math.max(8, rect.right - menuW));
    const estH = 260;
    let top = rect.bottom + 6;
    if (top + estH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estH - 6);
    }
    setMessageBubbleMenu((prev) =>
      prev?.messageId === m.id
        ? null
        : {
            messageId: m.id,
            top,
            left,
            message: m,
            mine: isMine,
          },
    );
  }, []);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      setErrorHint(`File too large (max ${MAX_UPLOAD_FILE_MB} MB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setErrorHint(null);
      setPendingAttachment({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const dmTargets = useMemo(
    () => (currentUser ? dmTargetUserIds(currentUser, users) : []),
    [currentUser, users],
  );
  const dmTargetsFiltered = useMemo(() => {
    const q = dmSearch.trim().toLowerCase();
    if (!q) return dmTargets;
    return dmTargets.filter((id) => {
      const u = users.find((x) => x.id === id);
      if (!u) return false;
      return `${u.name ?? ''} ${u.role ?? ''}`.toLowerCase().includes(q);
    });
  }, [dmTargets, users, dmSearch]);

  const runMessageSearch = async () => {
    if (!selected) return;
    setMsgSearchLoading(true);
    setErrorHint(null);
    const r = await searchChatMessages(selected.id, msgSearchQ);
    setMsgSearchLoading(false);
    if (!r.ok) {
      setMsgSearchResults([]);
      setErrorHint(r.error ?? 'Search failed');
      return;
    }
    setMsgSearchResults(r.data);
  };

  const groupScope = (): 'group' | 'hr_group' | 'tl_group' | null => {
    if (!currentUser) return null;
    if (currentUser.role === 'Admin') return 'group';
    if (currentUser.role === 'HR') return 'hr_group';
    if (currentUser.role === 'Team Leader') return 'tl_group';
    return null;
  };

  const canCreateGroup = groupScope() !== null;

  const toggleMember = (id: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else setList([...list, id]);
  };

  const eligibleForNewGroup = users.filter((u) => {
    if (!currentUser || u.id === currentUser.id) return false;
    const sc = groupScope();
    if (!sc) return false;
    if (sc === 'group') return canAddToGroup(u);
    if (sc === 'hr_group') return canAddToHrGroup(u);
    return canAddToTlGroup(u);
  });

  const eligibleToAddToSelected = useMemo(() => {
    if (!selected || selected.kind !== 'group' || !currentUser) return [];
    return users.filter((u) => {
      if (u.id === currentUser.id || selected.memberIds.some((mid) => String(mid) === String(u.id))) return false;
      if (selected.scope === 'group') return canAddToGroup(u);
      if (selected.scope === 'hr_group') return canAddToHrGroup(u);
      if (selected.scope === 'tl_group') return canAddToTlGroup(u);
      return false;
    });
  }, [selected, users, currentUser]);

  const selectedGroupAdmins = useMemo(
    () => (selected?.kind === 'group' ? groupThreadAdminIds(selected) : []),
    [selected]
  );

  const canShowAddMembers =
    !!selected &&
    selected.kind === 'group' &&
    !!currentUser &&
    canAddMembersToGroupThread(selected, currentUser);

  const forwardTargets = useMemo(() => {
    if (!currentUser || !selected || !forwardingMessage) return [];
    return visibleThreads.filter(
      (t) => t.id !== selected.id && canSendInThread(t, currentUser, users)
    );
  }, [visibleThreads, selected, forwardingMessage, currentUser, users]);

  const runForwardTo = async (targetChatId: string) => {
    if (!selected || !forwardingMessage) return;
    setErrorHint(null);
    const r = await forwardChatMessage(targetChatId, {
      sourceChatId: selected.id,
      messageId: forwardingMessage.id,
    });
    if (r.ok) {
      setForwardingMessage(null);
      setSelectedId(targetChatId);
    } else setErrorHint(r.error ?? 'Could not forward');
  };

  const canEditSelectedGroup =
    selected?.kind === 'group' && currentUser ? canManageGroupSettings(selected, currentUser) : false;

  const canRemoveSelectedGroup =
    selected?.kind === 'group' && currentUser ? canDeleteGroup(selected, currentUser) : false;

  const saveGroupDetailsName = async () => {
    if (!selected || selected.kind !== 'group') return;
    setErrorHint(null);
    const r = await updateGroupChat(selected.id, { name: groupNameEdit });
    if (!r.ok) setErrorHint(r.error ?? 'Could not update name');
  };

  const handleGroupAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected || selected.kind !== 'group') return;
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      setErrorHint(`Image too large (max ${MAX_UPLOAD_FILE_MB} MB).`);
      e.target.value = '';
      return;
    }
    setErrorHint(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await updateGroupChat(selected.id, { avatarUrl: reader.result as string });
      if (!r.ok) setErrorHint(r.error ?? 'Could not update photo');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteSelectedGroup = async () => {
    if (!selected || selected.kind !== 'group') return;
    if (!window.confirm('Delete this group for everyone? All messages in it will be removed.')) return;
    setErrorHint(null);
    const id = selected.id;
    const r = await deleteGroupChat(id);
    if (r.ok) {
      setGroupInfoOpen(false);
      setSelectedId(null);
    } else setErrorHint(r.error ?? 'Could not delete');
  };

  const confirmRemoveOrLeaveMember = async (userId: string) => {
    if (!selected || selected.kind !== 'group' || !currentUser) return;
    const isSelf = userId === currentUser.id;
    const u = users.find((x) => x.id === userId);
    const msg = isSelf
      ? 'Leave this group? You will stop receiving messages here.'
      : `Remove ${u?.name ?? 'this person'} from the group?`;
    if (!window.confirm(msg)) return;
    setErrorHint(null);
    const r = isSelf ? await leaveGroupChat(selected.id) : await removeMembersFromGroup(selected.id, [userId]);
    if (!r.ok) {
      setErrorHint(r.error ?? 'Could not update members');
      return;
    }
    // Force-refresh thread state so the member list updates immediately.
    await syncChatThreads();
    await syncChatMessages(selected.id);
    if (isSelf) {
      setGroupInfoOpen(false);
      setSelectedId(null);
    }
  };

  const addSelectedMembersInGroupModal = async () => {
    if (!selected || selected.kind !== 'group' || groupModalAddIds.length === 0) return;
    setErrorHint(null);
    const r = await addMembersToGroup(selected.id, groupModalAddIds);
    if (r.ok) setGroupModalAddIds([]);
    else setErrorHint(r.error ?? 'Could not add');
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center text-slate-600 dark:text-slate-300">
        <p>Sign in to use Messages.</p>
      </div>
    );
  }

  if (currentUser.role === 'Pending User') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-100 bg-amber-50/80 p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-amber-600" />
        <p className="mt-4 font-semibold text-slate-800 dark:text-slate-100">Messages are unavailable</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Complete account approval to access messaging.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-violet-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Full-width chat shell — list + conversation scroll inside only (long threads) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-slate-800/70 dark:shadow-[inset_0_1px_0_rgba(0,0,0,0.25)]">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* Thread list — ONLY this column scrolls vertically */}
          <div
            className={`flex min-h-0 min-w-0 w-full shrink-0 flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700/70 bg-gradient-to-b from-white via-slate-50/95 to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 shadow-[1px_0_0_rgba(15,23,42,0.06)] dark:shadow-[1px_0_0_rgba(0,0,0,0.35)] backdrop-blur-xl md:w-64 md:max-w-[16rem] lg:w-72 lg:max-w-[18rem] ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 px-3 py-2.5 backdrop-blur-md">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Messages</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setThreadSearchOpen((v) => {
                      const next = !v;
                      if (!next) setThreadSearchQ('');
                      return next;
                    });
                  }}
                  className={`rounded-lg p-2 transition ${
                    threadSearchOpen
                      ? 'bg-violet-100 text-violet-700 shadow-inner ring-1 ring-violet-200/80'
                      : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600'
                  }`}
                  aria-label="Search chats"
                  title="Search chats"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorHint(null);
                    setDmSearch('');
                    setDmOpen(true);
                  }}
                  className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600"
                  aria-label="New message"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
                {canCreateGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName('');
                      setGroupMemberIds([]);
                      setGroupOpen(true);
                      setErrorHint(null);
                    }}
                    className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600"
                    aria-label="New group"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {threadSearchOpen && (
              <div className="shrink-0 border-b border-slate-200 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60 px-2.5 pb-2.5 pt-1.5 backdrop-blur-sm">
                <input
                  value={threadSearchQ}
                  onChange={(e) => setThreadSearchQ(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-50 shadow-sm placeholder:text-slate-400 outline-none ring-violet-500/0 transition focus:border-violet-300 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>
            )}
            <div className="scrollbar-hide min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-3 pt-1.5">
              {visibleThreadsFiltered.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/90 bg-white/60 dark:bg-slate-900/60 px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400 backdrop-blur-sm">
                  No conversations yet.
                </p>
              ) : (
                visibleThreadsFiltered.map((t) => {
                  const active = selected?.id === t.id;
                  const last = t.messages[t.messages.length - 1];
                  const unread = unreadCountForThread(t, currentUser.id);
                  const previewLine = lastMessagePreviewWithSender(last, currentUser.id, userName);
                  const hasUnread = unread > 0;
                  const isPinned = pinnedThreadIds.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`flex w-full gap-0.5 rounded-xl transition-colors duration-150 ${
                        active
                          ? 'border-l-4 border-slate-900 bg-slate-50 dark:border-indigo-400 dark:bg-slate-800'
                          : hasUnread
                            ? 'border-l-4 border-transparent bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            : 'border-l-4 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(t.id);
                          setErrorHint(null);
                        }}
                        className={`flex min-w-0 flex-1 gap-2.5 rounded-l-xl px-2 py-2 text-left transition-colors ${
                          active
                            ? 'text-slate-900 dark:text-slate-50'
                            : hasUnread
                              ? 'text-slate-900 dark:text-slate-50'
                              : 'text-slate-900 dark:text-slate-50'
                        }`}
                      >
                      <ThreadListAvatar
                        thread={t}
                        currentUserId={currentUser.id}
                        users={users}
                        compact
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span
                              className={`min-w-0 truncate text-[13px] leading-tight ${
                              active
                                ? 'font-semibold text-slate-900 dark:text-slate-50'
                                : hasUnread
                                  ? 'font-bold text-slate-950 dark:text-slate-50'
                                  : 'font-semibold text-slate-900 dark:text-slate-50'
                            }`}
                          >
                            {chatThreadTitle(t, currentUser.id, userName)}
                          </span>
                          {last && (
                            <span
                              className={`shrink-0 whitespace-nowrap text-[10px] tabular-nums ${
                                active
                                  ? 'font-medium text-slate-500 dark:text-slate-400'
                                  : hasUnread && !active
                                    ? 'font-semibold text-slate-600 dark:text-slate-300'
                                    : 'font-medium text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {format(new Date(last.createdAt), 'h:mm a')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-end justify-between gap-1.5">
                          <p
                            className={`line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug ${
                              active
                                ? 'text-slate-600 dark:text-slate-300'
                                : hasUnread && !active
                                  ? 'font-medium text-slate-700 dark:text-slate-200'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {previewLine
                              ? previewLine
                              : t.kind === 'group'
                                ? 'Group chat'
                                : 'No messages yet'}
                          </p>
                          {hasUnread && (
                            <span
                              className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-none"
                              aria-label={`${unread} unread messages`}
                            >
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePinThread(t.id);
                        }}
                        className={`shrink-0 self-stretch rounded-r-xl px-1.5 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/80 ${
                          isPinned ? 'text-amber-600' : 'text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400'
                        }`}
                        title={isPinned ? 'Unpin from top' : 'Pin to top'}
                        aria-label={isPinned ? 'Unpin chat' : 'Pin chat to top'}
                      >
                        <Pin
                          className={`mx-auto h-4 w-4 ${isPinned ? 'fill-amber-500 text-amber-600' : ''}`}
                          aria-hidden
                        />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversation — ONLY message list scrolls; header + composer fixed in column */}
          <div
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50/35 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${!selected ? 'hidden md:flex' : 'flex'}`}
          >
            {selected ? (
              <>
                <div className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/80 bg-white/75 px-3 py-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-none sm:gap-3 sm:px-7 sm:py-4">
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200 md:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="rounded-2xl p-0.5 shadow-none ring-2 ring-slate-200/90 transition-colors hover:bg-slate-50 dark:ring-slate-600 dark:hover:bg-slate-800/80">
                    <ThreadListAvatar thread={selected} currentUserId={currentUser.id} users={users} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                      {chatThreadTitle(selected, currentUser.id, userName)}
                    </p>
                    {selected.kind === 'dm' && (() => {
                      const other = selected.memberIds.find((id) => String(id) !== String(currentUser.id));
                      const u = other ? users.find((x) => String(x.id) === String(other)) : undefined;
                      if (!u) return null;
                      return (
                        <p className={`mt-1 truncate text-[12px] font-medium ${presenceTextClass(u)}`}>
                          <span
                            className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle shadow-sm ${presenceDotClass(u)}`}
                            aria-hidden
                          />
                          {presenceLabel(u)}
                        </p>
                      );
                    })()}
                    {selected.kind === 'group' && (
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400">
                        {selected.teamKey
                          ? `Team chat · ${selected.teamKey}`
                        : selected.scope === 'group'
                          ? 'Group'
                            : selected.scope === 'hr_group'
                              ? 'HR group'
                              : 'Team group'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 hover:shadow-none dark:text-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
                      aria-label="Search messages"
                      onClick={() => {
                        setMsgSearchQ('');
                        setMsgSearchResults([]);
                        setMsgSearchOpen(true);
                        setErrorHint(null);
                      }}
                    >
                      <Search className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl p-2.5 transition hover:shadow-none ${
                        pinnedThreadIds.includes(selected.id)
                          ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800/80'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'
                      }`}
                      aria-label={
                        pinnedThreadIds.includes(selected.id) ? 'Unpin chat from top' : 'Pin chat to top'
                      }
                      title={pinnedThreadIds.includes(selected.id) ? 'Unpin from top' : 'Pin to top'}
                      onClick={() => togglePinThread(selected.id)}
                    >
                      <Pin
                        className={`h-5 w-5 ${pinnedThreadIds.includes(selected.id) ? 'fill-amber-500' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {selected.kind === 'group' && (
                      <button
                        type="button"
                        className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 hover:shadow-none dark:text-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
                        aria-label="Group details"
                        onClick={() => {
                          setErrorHint(null);
                          setGroupInfoOpen(true);
                        }}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  {canShowAddMembers && eligibleToAddToSelected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddUserIds([]);
                        setAddOpen(true);
                      }}
                      className="shrink-0 rounded-xl border border-violet-200/90 bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-none transition hover:brightness-105 sm:px-3.5"
                    >
                      Add people
                    </button>
                  )}
                </div>

                <div className="scrollbar-hide relative min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,rgba(124,92,252,0.06)_1px,transparent_0)] bg-[length:22px_22px] px-4 py-6 dark:bg-slate-950/90 dark:bg-[radial-gradient(circle_at_1px_1px,rgba(124,92,252,0.04)_1px,transparent_0)] sm:px-8">
                  <div className="mx-auto w-full min-w-0 max-w-3xl space-y-3">
                    {selected.messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 shadow-none ring-4 ring-white/80 dark:ring-slate-800/80">
                          <MessageSquare className="h-11 w-11 text-white" strokeWidth={1.25} />
                        </div>
                        <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Start the conversation</p>
                        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                          Send a message to start chatting with{' '}
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {chatThreadTitle(selected, currentUser.id, userName)}
                          </span>
                          .
                        </p>
                      </div>
                    ) : (
                      selected.messages.map((m, idx) => {
                      const mine = m.authorId === currentUser.id;
                      const hasAttachment = Boolean(m.attachment && !m.deleted);
                      const bodyText = m.body.trim();
                      const outgoingFlush = mine && hasAttachment && !bodyText;
                      const outgoingCaptionThenMedia = mine && hasAttachment && Boolean(bodyText);
                      const overlayMetaOnImage =
                        mine &&
                        outgoingFlush &&
                        m.attachment &&
                        !m.deleted &&
                        m.attachment.mimeType.startsWith('image/');
                      const prev = idx > 0 ? selected.messages[idx - 1] : null;
                      const showDay =
                        !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
                      const d = new Date(m.createdAt);
                      return (
                        <div
                          key={m.id}
                          ref={(el) => {
                            messageRefs.current[m.id] = el;
                          }}
                        >
                          {showDay && (
                            <div className="my-5 flex justify-center">
                              <span className="rounded-full border border-white/90 bg-white/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600 shadow-none backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-violet-400">
                                {isToday(d) ? 'Today' : format(d, 'EEEE, MMM d')}
                              </span>
                            </div>
                          )}
                          <div
                            className={`flex w-full min-w-0 items-end gap-2.5 ${mine ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`}
                          >
                            <div className="relative min-w-0 max-w-[min(100%,26rem)] shrink-0 sm:max-w-md">
                              <div
                                className={`rounded-[1.35rem] text-[15px] leading-relaxed ${
                                  mine
                                    ? `rounded-br-md bg-gradient-to-br from-[#6366f1] via-[#5b5bd6] to-[#7c3aed] text-white shadow-none ring-1 ring-white/15 ${
                                        outgoingFlush
                                          ? 'overflow-hidden p-0'
                                          : outgoingCaptionThenMedia
                                            ? 'overflow-hidden px-4 pb-0 pt-3'
                                            : 'px-4 py-3'
                                      }`
                                    : 'rounded-bl-md border border-white/90 bg-white/95 dark:bg-slate-900/95 px-4 py-3 text-slate-800 dark:text-slate-100 shadow-sm backdrop-blur-sm ring-1 ring-slate-100 dark:border-slate-700/80 dark:shadow-none dark:ring-slate-800/90'
                                } relative`}
                              >
                                {!m.deleted && (
                                  <button
                                    type="button"
                                    className={`absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                                      mine
                                        ? 'text-indigo-50 hover:bg-black/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                    aria-label="Message options"
                                    aria-expanded={messageBubbleMenu?.messageId === m.id}
                                    aria-haspopup="menu"
                                    onClick={(e) => openMessageBubbleMenu(e, m, mine)}
                                  >
                                    <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                                  </button>
                                )}
                                {m.replyToId && (() => {
                                  const parent = selected.messages.find((x) => x.id === m.replyToId);
                                  if (!parent) return null;
                                  return (
                                    <div
                                      className={`mb-2 rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug ${
                                        outgoingFlush ? 'mx-3 mt-3' : ''
                                      } ${
                                        mine
                                          ? 'border-white/70 bg-black/20'
                                          : 'border-indigo-500 bg-slate-100'
                                      }`}
                                    >
                                      <p className="font-semibold">{userName(parent.authorId)}</p>
                                      <p className="line-clamp-2 opacity-90">{messageSnippet(parent)}</p>
                                    </div>
                                  );
                                })()}
                                {m.forwardedFrom && !m.deleted && (
                                  <div
                                    className={`mb-2 rounded-lg border-l-2 px-2 py-1.5 text-[11px] leading-snug ${
                                      mine && outgoingFlush ? 'mx-3 mt-3' : ''
                                    } ${
                                      mine
                                        ? 'border-emerald-300/90 bg-black/15'
                                        : 'border-emerald-500 bg-emerald-50/90'
                                    }`}
                                  >
                                    <p
                                      className={`font-bold uppercase tracking-wide ${
                                        mine ? 'text-indigo-100' : 'text-emerald-900'
                                      }`}
                                    >
                                      Forwarded
                                    </p>
                                    <p className={`mt-0.5 ${mine ? 'text-indigo-100/95' : 'text-slate-700 dark:text-slate-200'}`}>
                                      <span className="font-semibold">{m.forwardedFrom.sourceChatTitle}</span>
                                      <span className={mine ? 'text-indigo-200/90' : 'text-slate-400 dark:text-slate-500'}>
                                        {' '}
                                        ·{' '}
                                      </span>
                                      <span className="font-medium">{m.forwardedFrom.originalAuthorName}</span>
                                    </p>
                                  </div>
                                )}
                                {!mine && selected.kind === 'group' && (
                                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                                    {userName(m.authorId)}
                                  </p>
                                )}
                                {m.deleted ? (
                                  <p className={`text-sm italic ${mine ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                    This message was deleted
                                  </p>
                                ) : (
                                  <>
                                    {m.body.trim() ? (
                                      <p
                                        className={`whitespace-pre-wrap break-words leading-relaxed ${outgoingCaptionThenMedia ? 'pb-1' : ''}`}
                                      >
                                        {m.body}
                                      </p>
                                    ) : null}
                                    {m.attachment && (
                                      <>
                                        {m.attachment.mimeType.startsWith('image/') ? (
                                          overlayMetaOnImage ? (
                                            <div className="relative w-full overflow-hidden">
                                              <button
                                                type="button"
                                                onClick={() => setLightbox(m.attachment!)}
                                                className="block w-full overflow-hidden text-left transition hover:opacity-95"
                                              >
                                                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from chat */}
                                                <img
                                                  src={m.attachment.dataUrl}
                                                  alt=""
                                                  className="block max-h-72 w-full object-cover sm:max-h-96"
                                                />
                                              </button>
                                              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/65 via-black/35 to-transparent px-2 pb-1 pt-10">
                                                <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium leading-none text-white">
                                                  <span>{format(d, 'HH:mm')}</span>
                                                  {m.editedAt && !m.deleted && (
                                                    <span className="text-white/75">(edited)</span>
                                                  )}
                                                </div>
                                                {(() => {
                                                  const readers = new Set(m.readByUserIds ?? []);
                                                  const othersWhoRead = Array.from(readers).filter(
                                                    (id) => id !== m.authorId,
                                                  );
                                                  const seen = othersWhoRead.length > 0;
                                                  const Icon = seen ? CheckCheck : Check;
                                                  return (
                                                    <span
                                                      className={`inline-flex shrink-0 items-center ${seen ? 'text-sky-300' : 'text-white'}`}
                                                    >
                                                      <Icon className="h-3.5 w-3.5" />
                                                    </span>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setLightbox(m.attachment!)}
                                              className={
                                                mine
                                                  ? outgoingCaptionThenMedia
                                                    ? '-mx-4 mt-2 block w-[calc(100%+2rem)] max-w-none overflow-hidden text-left transition hover:opacity-95'
                                                    : outgoingFlush
                                                      ? 'block w-full overflow-hidden text-left transition hover:opacity-95'
                                                      : 'mt-2 block w-full overflow-hidden rounded-2xl text-left ring-1 ring-slate-200 transition hover:opacity-95 dark:ring-slate-700/80 dark:shadow-none'
                                                  : 'mt-2 w-full overflow-hidden rounded-2xl text-left ring-1 ring-slate-200 transition hover:opacity-95 dark:ring-slate-700/80 dark:shadow-none'
                                              }
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from chat */}
                                              <img
                                                src={m.attachment.dataUrl}
                                                alt=""
                                                className="max-h-72 w-full object-cover sm:max-h-96"
                                              />
                                            </button>
                                          )
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setLightbox(m.attachment!)}
                                            className={
                                              mine
                                                ? outgoingCaptionThenMedia
                                                  ? '-mx-4 mt-2 block w-[calc(100%+2rem)] overflow-hidden text-left transition hover:opacity-95'
                                                  : outgoingFlush
                                                    ? 'block w-full overflow-hidden text-left transition hover:opacity-95'
                                                    : 'mt-2 block w-full overflow-hidden rounded-2xl text-left transition hover:opacity-95'
                                                : 'mt-2 w-full overflow-hidden rounded-2xl text-left ring-1 ring-slate-200 dark:ring-slate-700 transition hover:opacity-95'
                                            }
                                          >
                                            <div
                                              className={`flex gap-3 px-4 pb-3 pt-4 text-left ${
                                                mine ? 'text-white' : ''
                                              }`}
                                            >
                                              <div
                                                className={`flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-xl font-bold leading-none ${
                                                  mine ? 'bg-white/25 dark:bg-white/10 text-[11px] text-white' : 'bg-slate-200 text-[11px] text-slate-700 dark:text-slate-200'
                                                }`}
                                              >
                                                {fileExtensionBadge(m.attachment.fileName, m.attachment.mimeType)}
                                              </div>
                                              <div className="min-w-0 flex-1 pt-0.5">
                                                <p
                                                  className={`truncate text-[15px] font-semibold leading-snug ${
                                                    mine ? 'text-white' : 'text-slate-900 dark:text-slate-50'
                                                  }`}
                                                >
                                                  {m.attachment.fileName}
                                                </p>
                                                <p
                                                  className={`mt-1 text-[12px] leading-snug ${mine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
                                                >
                                                  {mimeShortLabel(m.attachment.mimeType)} •{' '}
                                                  {approxSizeFromDataUrl(m.attachment.dataUrl)}
                                                </p>
                                              </div>
                                            </div>
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                                {!overlayMetaOnImage && (
                                <p
                                  className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'} ${
                                    mine && outgoingCaptionThenMedia ? 'px-4 pb-3 pt-1.5' : ''
                                  } ${mine && outgoingFlush && !outgoingCaptionThenMedia ? 'px-3 pb-2.5 pt-1.5' : ''}`}
                                >
                                  <span>{format(d, 'HH:mm')}</span>
                                  {m.editedAt && !m.deleted && (
                                    <span className={mine ? 'text-indigo-300/90' : 'text-slate-300'}>
                                      (edited)
                                    </span>
                                  )}
                                  {mine && !m.deleted && (() => {
                                    // WhatsApp-style read receipt ticks:
                                    // - 1 tick: sent (default once saved)
                                    // - 2 ticks: someone else has read (readByUserIds contains any non-author member)
                                    const readers = new Set(m.readByUserIds ?? []);
                                    const othersWhoRead = Array.from(readers).filter((id) => id !== m.authorId);
                                    const seen = othersWhoRead.length > 0;
                                    const Icon = seen ? CheckCheck : Check;
                                    return (
                                      <span className={`ml-auto inline-flex items-center ${seen ? 'text-sky-200' : 'text-indigo-200'}`}>
                                        <Icon className="h-3.5 w-3.5" />
                                      </span>
                                    );
                                  })()}
                                </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                    )}
                    <div ref={listEndRef} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/40 bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,rgba(124,92,252,0.06)_1px,transparent_0)] bg-[length:22px_22px] px-4 py-2.5 dark:bg-slate-950/95 dark:bg-[radial-gradient(circle_at_1px_1px,rgba(124,92,252,0.04)_1px,transparent_0)] sm:px-8 sm:py-3">
                  {errorHint && (
                    <p className="mb-2 text-xs font-medium text-rose-600">{errorHint}</p>
                  )}
                  <div className="mx-auto w-full min-w-0 max-w-3xl space-y-3">
                    {selected.kind === 'group' &&
                      selected.adminsOnlyMessages &&
                      currentUser &&
                      !isGroupMessagingAdmin(selected, currentUser) && (
                        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950">
                          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <p>
                            <span className="font-semibold"></span> Only group admins can send
                            messages here.
                          </p>
                        </div>
                      )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                    />
                    {editingId && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950">
                        <span className="font-semibold">Editing message</span>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="shrink-0 font-medium text-amber-900 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {replyingTo && !editingId && (
                      <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/95 px-3 py-2 text-xs">
                        <div className="min-w-0 border-l-2 border-indigo-500 pl-2">
                          <p className="font-semibold text-indigo-950">
                            Replying to {userName(replyingTo.authorId)}
                          </p>
                          <p className="truncate text-slate-600 dark:text-slate-300">{messageSnippet(replyingTo)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="shrink-0 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-white/90"
                          aria-label="Cancel reply"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {pendingAttachment && !editingId && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-violet-100/90 bg-gradient-to-r from-violet-50/90 to-white px-3 py-2.5 text-xs shadow-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                          <span className="truncate">📎 {pendingAttachment.fileName}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachment(null)}
                          className="shrink-0 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200"
                          aria-label="Remove attachment"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1 rounded-[22px] border border-slate-200/80 bg-[#E4E1EC] px-3 py-1.5 shadow-sm dark:border-slate-700/90 dark:bg-slate-900 dark:shadow-none sm:gap-1.5 sm:rounded-[26px] sm:px-4 sm:py-2">
                      <button
                        type="button"
                        disabled={!canSend || !!editingId}
                        onClick={handlePickFile}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4B4D7E] transition-colors hover:bg-[#4B4D7E]/[0.08] active:bg-[#4B4D7E]/[0.12] disabled:pointer-events-none disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800 sm:h-9 sm:w-9"
                        aria-label="Attach file"
                      >
                        <Paperclip className="h-[17px] w-[17px]" strokeWidth={1.75} />
                      </button>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        disabled={!canSend}
                        placeholder={
                          !canSend &&
                          selected?.kind === 'group' &&
                          selected.adminsOnlyMessages &&
                          currentUser &&
                          !isGroupMessagingAdmin(selected, currentUser)
                            ? 'Only group admins can send messages…'
                            : !canSend
                              ? 'You cannot post here'
                              : editingId
                                ? 'Edit your message…'
                                : 'Your message'
                        }
                        rows={1}
                        className="min-h-[34px] max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-[15px] font-normal leading-snug tracking-tight text-[#252847] placeholder:text-[#6B6E88] outline-none ring-0 selection:bg-violet-400/25 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={
                          !canSend ||
                          (editingId
                            ? !draft.trim() &&
                              !selected?.messages.find((x) => x.id === editingId)?.attachment
                            : !draft.trim() && !pendingAttachment)
                        }
                        onClick={handleSend}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4B4D7E] transition-colors hover:bg-[#4B4D7E]/[0.08] active:bg-[#4B4D7E]/[0.12] disabled:pointer-events-none disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800 sm:h-9 sm:w-9"
                        aria-label={editingId ? 'Save edit' : 'Send'}
                      >
                        {editingId ? (
                          <Pencil className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
                        ) : (
                          <Send className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-slate-50/80 to-violet-50/30 p-10 text-center dark:from-slate-900 dark:to-slate-950">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-50 shadow-inner ring-1 ring-white/80 dark:from-violet-950/50 dark:to-indigo-950/40 dark:ring-slate-700/80">
                  <MessageSquare className="h-10 w-10 text-violet-400" strokeWidth={1.25} />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">Select a conversation</p>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Choose a chat from the list or start a new direct message.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {groupInfoOpen && selected?.kind === 'group' && (
        <div
          className="fixed inset-0 z-[103] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Group details"
          onClick={(e) => e.target === e.currentTarget && setGroupInfoOpen(false)}
        >
          <div
            className="scrollbar-hide flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Group details</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setGroupInfoOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {errorHint && (
                <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {errorHint}
                </p>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <ThreadListAvatar thread={selected} currentUserId={currentUser.id} users={users} />
                  {canEditSelectedGroup && (
                    <>
                      <input
                        ref={groupAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleGroupAvatarPick}
                      />
                      <button
                        type="button"
                        onClick={() => groupAvatarInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                        aria-label="Change group photo"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {canEditSelectedGroup && selected.avatarUrl && (
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600"
                    onClick={() => {
                      setErrorHint(null);
                      updateGroupChat(selected.id, { avatarUrl: null });
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                  checked={!!selected.privacyLockedInvites}
                  disabled={!canEditSelectedGroup}
                  onChange={async (e) => {
                    setErrorHint(null);
                    const r = await updateGroupChat(selected.id, { privacyLockedInvites: e.target.checked });
                    if (!r.ok) setErrorHint(r.error ?? 'Could not update privacy setting');
                  }}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Lock className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                    Privacy lock
                  </span>
                </span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                  checked={!!selected.adminsOnlyMessages}
                  disabled={!canEditSelectedGroup}
                  onChange={async (e) => {
                    setErrorHint(null);
                    const r = await updateGroupChat(selected.id, { adminsOnlyMessages: e.target.checked });
                    if (!r.ok) setErrorHint(r.error ?? 'Could not update messaging mode');
                  }}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Crown className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                    Only admins can send messages
                  </span>
                </span>
              </label>
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Group name
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={groupNameEdit}
                  onChange={(e) => setGroupNameEdit(e.target.value)}
                  disabled={!canEditSelectedGroup}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm disabled:bg-slate-50"
                />
                {canEditSelectedGroup && (
                  <button
                    type="button"
                    onClick={saveGroupDetailsName}
                    className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                )}
              </div>
              {canShowAddMembers && (
                <>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Add members
                  </p>
                  {eligibleToAddToSelected.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No one else can be added right now.</p>
                  ) : (
                    <>
                      <div className="scrollbar-hide mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2">
                        {eligibleToAddToSelected.map((u) => (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={groupModalAddIds.includes(u.id)}
                              onChange={() => toggleMember(u.id, groupModalAddIds, setGroupModalAddIds)}
                            />
                            <span className="text-sm text-slate-800 dark:text-slate-100">
                              {u.name} <span className="text-slate-500 dark:text-slate-400">({u.role})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={groupModalAddIds.length === 0}
                        onClick={addSelectedMembersInGroupModal}
                        className="mt-2 w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add selected
                      </button>
                    </>
                  )}
                </>
              )}
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Members ({selected.memberIds.length})
              </p>
              <ul className="mt-2 space-y-2">
                {[...selected.memberIds]
                  .sort((a, b) => userName(a).localeCompare(userName(b)))
                  .map((id) => {
                    const u = users.find((x) => String(x.id) === String(id));
                    const isSelf = String(id) === String(currentUser.id);
                    const canLeaveGroup = isSelf && selected.memberIds.length > 1;
                    const canRemoveOther = !isSelf && isGroupThreadAdmin(selected, currentUser);
                    const isRowAdmin = selectedGroupAdmins.some((a) => String(a) === String(id));
                    const canPromote =
                      isGroupThreadAdmin(selected, currentUser) && !isSelf && !isRowAdmin;
                    const canDemote =
                      isGroupThreadAdmin(selected, currentUser) &&
                      isRowAdmin &&
                      selectedGroupAdmins.length > 1;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-3 py-2"
                      >
                        <UserAvatar userId={id} users={users} size="sm" variant="list" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                            <span className="min-w-0 truncate">{userName(id)}</span>
                            {isRowAdmin && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                                <Crown className="h-3 w-3" aria-hidden />
                                Admin
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{u?.role ?? ''}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                          {canPromote && (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"
                              title="Make group admin"
                              aria-label={`Make ${userName(id)} a group admin`}
                              onClick={() => {
                                setErrorHint(null);
                                void promoteGroupAdmin(selected.id, id).then((r) => {
                                  if (!r.ok) setErrorHint(r.error ?? 'Could not promote');
                                });
                              }}
                            >
                              <Crown className="h-4 w-4" />
                            </button>
                          )}
                          {canDemote && (
                            <button
                              type="button"
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Remove admin role"
                              onClick={() => {
                                setErrorHint(null);
                                void demoteGroupAdmin(selected.id, id).then((r) => {
                                  if (!r.ok) setErrorHint(r.error ?? 'Could not remove admin role');
                                });
                              }}
                            >
                              Revoke admin
                            </button>
                          )}
                          {canRemoveOther && (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Remove ${userName(id)} from group`}
                              onClick={() => confirmRemoveOrLeaveMember(id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                          {canLeaveGroup && (
                            <button
                              type="button"
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              onClick={() => confirmRemoveOrLeaveMember(id)}
                            >
                              Leave
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {canRemoveSelectedGroup && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedGroup}
                  className="mt-6 w-full rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Delete group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-label="Attachment preview"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-[92vh] max-w-[min(96vw,56rem)] flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <p className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{lightbox.fileName}</p>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
              {lightbox.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightbox.dataUrl}
                  alt=""
                  className="mx-auto max-h-[80vh] w-auto max-w-full object-contain"
                />
              ) : lightbox.mimeType === 'application/pdf' ? (
                <iframe
                  title={lightbox.fileName}
                  src={lightbox.dataUrl}
                  className="mx-auto h-[min(80vh,720px)] w-full min-w-[min(90vw,48rem)] rounded-lg border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <FileText className="h-14 w-14 text-slate-400 dark:text-slate-500" />
                  <a
                    href={lightbox.dataUrl}
                    download={lightbox.fileName}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals unchanged structure, styled */}
      {forwardingMessage && (
        <div
          className="fixed inset-0 z-[101] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Forward message"
          onClick={(e) => e.target === e.currentTarget && setForwardingMessage(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {errorHint && (
              <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {errorHint}
              </p>
            )}
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Forward to…</h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {messageSnippet(forwardingMessage)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setForwardingMessage(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {forwardTargets.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No other chat available where you can send messages. Open or create a DM or group first.
              </p>
            ) : (
              <ul className="scrollbar-hide max-h-72 space-y-1 overflow-y-auto">
                {forwardTargets.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      onClick={() => runForwardTo(t.id)}
                    >
                      <ThreadListAvatar thread={t} currentUserId={currentUser.id} users={users} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">
                        {chatThreadTitle(t, currentUser.id, userName)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {dmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setDmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">New direct message</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setDmOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {dmTargets.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No allowed contacts for your role.</p>
            ) : (
              <>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Search
                </label>
                <input
                  value={dmSearch}
                  onChange={(e) => setDmSearch(e.target.value)}
                  placeholder="Type a name or role…"
                  className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                />
                <ul className="scrollbar-hide mt-4 max-h-64 space-y-1 overflow-y-auto">
                  {dmTargetsFiltered.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches.</li>
                  ) : (
                    dmTargetsFiltered.map((id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={async () => {
                          const r = await openOrCreateDm(id);
                          if (r.ok) {
                            setSelectedId(r.chatId);
                            setDmOpen(false);
                          } else setErrorHint(r.error ?? 'Could not open DM');
                        }}
                      >
                        <UserAvatar userId={id} users={users} size="sm" variant="list" />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{u.name}</span>
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{u.role}</span>
                        </div>
                      </button>
                    </li>
                  );
                    })
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {groupOpen && canCreateGroup && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setGroupOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">New group</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setGroupOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {errorHint && (
              <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {errorHint}
              </p>
            )}
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Name
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
              placeholder="e.g. Project Alpha"
            />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Members</p>
            <div className="scrollbar-hide mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 p-2">
              {eligibleForNewGroup.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                >
                  <input
                    type="checkbox"
                    checked={groupMemberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id, groupMemberIds, setGroupMemberIds)}
                  />
                  <span className="text-sm">
                    {u.name} <span className="text-slate-400 dark:text-slate-500">({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                checked={newGroupPrivacyLocked}
                onChange={(e) => setNewGroupPrivacyLocked(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Lock className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                  Start with privacy lock
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Only admins can add people later. You can change this anytime in group details.
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                checked={newGroupAdminsOnlyMessages}
                onChange={(e) => setNewGroupAdminsOnlyMessages(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Crown className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                  Only admins can send messages
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Announcements-style group; you can turn this off later in group details.
                </span>
              </span>
            </label>
            <button
              type="button"
              disabled={groupMemberIds.length < 1 || !groupName.trim()}
              onClick={async () => {
                const sc = groupScope();
                if (!sc) return;
                setErrorHint(null);
                const r = await createGroupChat({
                  name: groupName,
                  memberIds: groupMemberIds,
                  scope: sc,
                  privacyLockedInvites: newGroupPrivacyLocked,
                  adminsOnlyMessages: newGroupAdminsOnlyMessages,
                });
                if (r.ok) {
                  setSelectedId(r.chatId);
                  setGroupOpen(false);
                  setGroupMemberIds([]);
                  setNewGroupPrivacyLocked(false);
                  setNewGroupAdminsOnlyMessages(false);
                } else setErrorHint(r.error ?? 'Could not create');
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#7c3aed] py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {msgSearchOpen && selected && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setMsgSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Search in chat</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMsgSearchOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Query</label>
            <div className="mt-1 flex gap-2">
              <input
                value={msgSearchQ}
                onChange={(e) => setMsgSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runMessageSearch();
                }}
                placeholder="Search text…"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={() => void runMessageSearch()}
                disabled={msgSearchLoading || !msgSearchQ.trim()}
                className="shrink-0 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {msgSearchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>

            <div className="mt-4">
              {msgSearchResults.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No results.</p>
              ) : (
                <ul className="scrollbar-hide max-h-80 space-y-1 overflow-y-auto">
                  {msgSearchResults.map((m) => {
                    const author = users.find((u) => String(u.id) === String(m.authorId));
                    const label = author?.name ?? (m.authorId === currentUser?.id ? 'You' : 'Unknown');
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-1 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                          onClick={() => {
                            const el = messageRefs.current[m.id];
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setMsgSearchOpen(false);
                            } else {
                              // Message isn't in current loaded window; keep modal open for now.
                              setErrorHint('Message not in the loaded list yet. Scroll up to load more, then search again.');
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                              {format(new Date(m.createdAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-900 dark:text-slate-50">{messageSnippet(m) || '—'}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {addOpen && selected?.kind === 'group' && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Add people</h2>
            <div className="scrollbar-hide mt-3 max-h-48 space-y-1 overflow-y-auto">
              {eligibleToAddToSelected.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                >
                  <input
                    type="checkbox"
                    checked={addUserIds.includes(u.id)}
                    onChange={() => toggleMember(u.id, addUserIds, setAddUserIds)}
                  />
                  <span className="text-sm">
                    {u.name} ({u.role})
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!selected) return;
                const r = await addMembersToGroup(selected.id, addUserIds);
                if (r.ok) {
                  setAddOpen(false);
                  setAddUserIds([]);
                } else setErrorHint(r.error ?? 'Could not add');
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#7c3aed] py-3 text-sm font-semibold text-white"
            >
              Add selected
            </button>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' &&
        messageBubbleMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[195]"
              aria-hidden
              onClick={() => setMessageBubbleMenu(null)}
            />
            <div
              role="menu"
              aria-label="Message options"
              className="fixed z-[196] w-44 overflow-hidden rounded-lg border border-violet-200/70 bg-white/95 dark:bg-slate-900/95 py-0.5 text-[12px] shadow-lg shadow-violet-500/10 ring-1 ring-violet-100/50 backdrop-blur-md"
              style={{ top: messageBubbleMenu.top, left: messageBubbleMenu.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const m = messageBubbleMenu.message;
                const mine = messageBubbleMenu.mine;
                const att = m.attachment;
                const close = () => setMessageBubbleMenu(null);
                const notYet = () => {
                  setErrorHint('This option is not available in CRM chat yet.');
                  close();
                };
                const isImageAtt = Boolean(att && !m.deleted && att.mimeType.startsWith('image/'));
                const isAudioAtt = Boolean(
                  att && !m.deleted && att.mimeType.toLowerCase().startsWith('audio/'),
                );
                const showEdit = mine && !m.deleted && !isImageAtt && !isAudioAtt;
                return (
                  <>
                    <VoiceMenuItem
                      icon={<Info />}
                      label="Message info"
                      onClick={() => {
                        setMessageBubbleInfo(m);
                        close();
                      }}
                    />
                    <VoiceMenuItem
                      icon={<Reply />}
                      label="Reply"
                      onClick={() => {
                        setReplyingTo(m);
                        setEditingId(null);
                        close();
                      }}
                    />
                    <VoiceMenuItem
                      icon={<Copy />}
                      label="Copy"
                      onClick={() => {
                        void (async () => {
                          try {
                            const text = m.body.trim() || messageSnippet(m);
                            await navigator.clipboard.writeText(text);
                            setErrorHint(null);
                          } catch {
                            setErrorHint('Could not copy to clipboard.');
                          }
                          close();
                        })();
                      }}
                    />
                    <VoiceMenuItem
                      icon={<Forward />}
                      label="Forward"
                      onClick={() => {
                        setErrorHint(null);
                        setForwardingMessage(m);
                        setEditingId(null);
                        setReplyingTo(null);
                        close();
                      }}
                    />
                    {showEdit && (
                      <VoiceMenuItem
                        icon={<Pencil />}
                        label="Edit"
                        onClick={() => {
                          startEditMessage(m);
                          close();
                        }}
                      />
                    )}
                    <VoiceMenuItem icon={<Pin />} label="Pin" onClick={notYet} />
                    {att?.dataUrl && (
                      <VoiceMenuItem
                        icon={<Download />}
                        label="Save as"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = att.dataUrl;
                          a.download =
                            att.fileName ||
                            (att.mimeType.startsWith('image/')
                              ? 'image.jpg'
                              : att.mimeType.toLowerCase().startsWith('audio/')
                                ? 'audio.webm'
                                : 'attachment');
                          a.click();
                          close();
                        }}
                      />
                    )}
                    <VoiceMenuDivider />
                    {mine && currentUser && m.authorId === currentUser.id && !m.deleted && (
                      <VoiceMenuItem
                        icon={<Trash2 />}
                        label="Delete"
                        danger
                        onClick={() => {
                          close();
                          void handleDeleteMessage(m);
                        }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </>,
          document.body,
        )}

      {messageBubbleInfo && (
        <div
          className="fixed inset-0 z-[198] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Message info"
          onClick={(e) => e.target === e.currentTarget && setMessageBubbleInfo(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Message info</h2>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMessageBubbleInfo(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-500 dark:text-slate-400">From</dt>
                <dd className="text-slate-900 dark:text-slate-50">{userName(messageBubbleInfo.authorId)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 dark:text-slate-400">Sent</dt>
                <dd className="text-slate-900 dark:text-slate-50">{format(new Date(messageBubbleInfo.createdAt), 'PPpp')}</dd>
              </div>
              {messageBubbleInfo.editedAt && (
                <div>
                  <dt className="font-semibold text-slate-500 dark:text-slate-400">Edited</dt>
                  <dd className="text-slate-900 dark:text-slate-50">{format(new Date(messageBubbleInfo.editedAt), 'PPpp')}</dd>
                </div>
              )}
              {messageBubbleInfo.attachment && (
                <>
                  <div>
                    <dt className="font-semibold text-slate-500 dark:text-slate-400">Type</dt>
                    <dd className="text-slate-900 dark:text-slate-50">
                      {messageBubbleInfo.attachment.mimeType.toLowerCase().startsWith('audio/')
                        ? 'Audio'
                        : messageBubbleInfo.attachment.mimeType.startsWith('image/')
                          ? 'Image'
                          : 'Attachment'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500 dark:text-slate-400">Approx. size</dt>
                    <dd className="text-slate-900 dark:text-slate-50">
                      {approxSizeFromDataUrl(messageBubbleInfo.attachment.dataUrl) || '—'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
