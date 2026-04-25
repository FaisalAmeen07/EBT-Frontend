'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  ChevronLeft,
  X,
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
} from 'lucide-react';
import { useStore, useShallow, canManageGroupSettings, canDeleteGroup } from '@/lib/store';
import type { User } from '@/lib/store';
import type { ChatAttachment, ChatMessage, ChatThread } from '@/lib/messaging';
import {
  isThreadVisibleToViewer,
  canSendInThread,
  dmTargetUserIds,
  canAddToOfficialGroup,
  canAddToHrGroup,
  canAddToTlGroup,
  chatThreadTitle,
  unreadCountForThread,
} from '@/lib/messaging';
import { format, isSameDay } from 'date-fns';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/file-upload-limits';

function lastActivityMs(thread: ChatThread): number {
  const last = thread.messages[thread.messages.length - 1];
  return last ? new Date(last.createdAt).getTime() : 0;
}

function messageSnippet(m: ChatMessage): string {
  if (m.deleted) return 'Message deleted';
  if (m.body.trim()) return m.body.length > 100 ? `${m.body.slice(0, 100)}…` : m.body;
  if (m.attachment) return `📎 ${m.attachment.fileName}`;
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
}: {
  userId: string;
  users: User[];
  size?: 'sm' | 'md' | 'lg';
  /** list | message: availability dot (no role letters on bubbles) */
  variant?: 'message' | 'list';
}) {
  const u = users.find((x) => x.id === userId);
  const initial = u?.name?.charAt(0).toUpperCase() ?? '?';
  const src = u?.avatar;
  const dim = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  const dotDim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <div className="relative shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or data URL
        <img src={src} alt="" className={`rounded-2xl object-cover ${dim}`} />
      ) : (
        <div
          className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#7c3aed] font-bold text-white shadow-inner ring-2 ring-white ${dim}`}
        >
          {initial}
        </div>
      )}
      {(variant === 'list' || variant === 'message') && u && (
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
}: {
  thread: ChatThread;
  currentUserId: string;
  users: User[];
}) {
  if (thread.kind === 'dm') {
    const other = thread.memberIds.find((id) => id !== currentUserId);
    if (!other) return <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-200" />;
    return <UserAvatar userId={other} users={users} size="md" variant="list" />;
  }
  if (thread.avatarUrl) {
    return (
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element -- group avatar data URL */}
        <img src={thread.avatarUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner ring-2 ring-white">
      <Hash className="h-5 w-5" strokeWidth={2} />
      <span className="absolute -bottom-0.5 -right-0.5 rounded-md border-2 border-white bg-indigo-600 px-0.5 text-[7px] font-bold text-white">
        G
      </span>
    </div>
  );
}

export default function MessagesPage() {
  const {
    currentUser,
    users,
    chatThreads,
    syncChatThreads,
    syncChatMessages,
    sendChatMessage,
    editChatMessage,
    deleteChatMessage,
    forwardChatMessage,
    openOrCreateDm,
    createGroupChat,
    addMembersToGroup,
    removeMembersFromGroup,
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
      sendChatMessage: s.sendChatMessage,
      editChatMessage: s.editChatMessage,
      deleteChatMessage: s.deleteChatMessage,
      forwardChatMessage: s.forwardChatMessage,
      openOrCreateDm: s.openOrCreateDm,
      createGroupChat: s.createGroupChat,
      addMembersToGroup: s.addMembersToGroup,
      removeMembersFromGroup: s.removeMembersFromGroup,
      updateGroupChat: s.updateGroupChat,
      deleteGroupChat: s.deleteGroupChat,
      markChatRead: s.markChatRead,
    }))
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [addUserIds, setAddUserIds] = useState<string[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [groupModalAddIds, setGroupModalAddIds] = useState<string[]>([]);
  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  const visibleThreads = useMemo(() => {
    if (!currentUser) return [];
    const filtered = chatThreads.filter((t) => isThreadVisibleToViewer(t, currentUser, users));
    const official = filtered.filter((t) => t.kind === 'group' && t.scope === 'official');
    const rest = filtered.filter((t) => !(t.kind === 'group' && t.scope === 'official'));
    const byActivity = (a: ChatThread, b: ChatThread) => lastActivityMs(b) - lastActivityMs(a);
    official.sort(byActivity);
    rest.sort(byActivity);
    return [...official, ...rest];
  }, [chatThreads, currentUser, users]);

  const selected = useMemo(
    () => visibleThreads.find((t) => t.id === selectedId) ?? visibleThreads[0] ?? null,
    [visibleThreads, selectedId]
  );

  useEffect(() => {
    if (!selectedId && visibleThreads[0]) setSelectedId(visibleThreads[0].id);
  }, [visibleThreads, selectedId]);

  useEffect(() => {
    if (!selectedId || !currentUser) return;
    void markChatRead(selectedId);
  }, [selectedId, selected?.messages.length, currentUser, markChatRead]);

  useEffect(() => {
    if (!currentUser) return;
    void syncChatThreads();
  }, [currentUser?.id, syncChatThreads]);

  useEffect(() => {
    if (!currentUser) return;
    const id = window.setInterval(() => {
      void syncChatThreads();
    }, 5000);
    return () => window.clearInterval(id);
  }, [currentUser?.id, syncChatThreads]);

  useEffect(() => {
    if (!selectedId || !currentUser) return;
    void syncChatMessages(selectedId);
  }, [selectedId, currentUser?.id, syncChatMessages]);

  useEffect(() => {
    if (!selectedId || !currentUser) return;
    const id = window.setInterval(() => {
      void syncChatMessages(selectedId);
    }, 2500);
    return () => window.clearInterval(id);
  }, [selectedId, currentUser?.id, syncChatMessages]);

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
    if (!forwardingMessage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForwardingMessage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forwardingMessage]);

  useEffect(() => {
    if (groupInfoOpen && selected?.kind === 'group') {
      setGroupNameEdit(selected.name ?? '');
      setGroupModalAddIds([]);
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
    setReplyingTo(null);
    setEditingId(null);
    setDraft('');
    setPendingAttachment(null);
  }, [selectedId]);

  const canSend = currentUser && selected ? canSendInThread(selected, currentUser, users) : false;

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

  const dmTargets = currentUser ? dmTargetUserIds(currentUser, users) : [];

  const groupScope = (): 'official' | 'hr_group' | 'tl_group' | null => {
    if (!currentUser) return null;
    if (currentUser.role === 'Admin') return 'official';
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
    if (sc === 'official') return canAddToOfficialGroup(u);
    if (sc === 'hr_group') return canAddToHrGroup(u);
    return canAddToTlGroup(u);
  });

  const eligibleToAddToSelected = useMemo(() => {
    if (!selected || selected.kind !== 'group' || !currentUser) return [];
    return users.filter((u) => {
      if (u.id === currentUser.id || selected.memberIds.includes(u.id)) return false;
      if (selected.scope === 'official') return canAddToOfficialGroup(u);
      if (selected.scope === 'hr_group') return canAddToHrGroup(u);
      if (selected.scope === 'tl_group') return canAddToTlGroup(u);
      return false;
    });
  }, [selected, users, currentUser]);

  const canShowAddMembers =
    selected?.kind === 'group' &&
    ((selected.scope === 'official' && currentUser?.role === 'Admin') ||
      (selected.scope === 'hr_group' && currentUser?.role === 'HR') ||
      (selected.scope === 'tl_group' && currentUser?.role === 'Team Leader'));

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
    const r = await removeMembersFromGroup(selected.id, [userId]);
    if (!r.ok) {
      setErrorHint(r.error ?? 'Could not update members');
      return;
    }
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
      <div className="mx-auto max-w-lg py-20 text-center text-slate-600">
        <p>Sign in to use Messages.</p>
      </div>
    );
  }

  if (currentUser.role === 'Pending User') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-100 bg-amber-50/80 p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-amber-600" />
        <p className="mt-4 font-semibold text-slate-800">Messages are unavailable</p>
        <p className="mt-2 text-sm text-slate-600">Complete account approval to access messaging.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
      {/* Full-width chat shell — list + conversation scroll inside only (long threads) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* Thread list — ONLY this column scrolls vertically */}
          <div
            className={`flex min-h-0 min-w-0 w-full shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-slate-100 md:w-[min(100%,400px)] lg:max-w-md ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-slate-100 px-4 py-3.5">
              <p className="text-[15px] font-semibold tracking-tight text-slate-900">Chat</p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setErrorHint(null);
                    setDmOpen(true);
                  }}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="New group"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-100 px-2 pb-3 pt-1">
              {visibleThreads.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No conversations yet.</p>
              ) : (
                visibleThreads.map((t) => {
                  const active = selected?.id === t.id;
                  const last = t.messages[t.messages.length - 1];
                  const unread = unreadCountForThread(t, currentUser.id);
                  const previewLine = lastMessagePreviewWithSender(last, currentUser.id, userName);
                  const hasUnread = unread > 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(t.id);
                        setErrorHint(null);
                      }}
                      className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        active
                          ? 'bg-slate-200 text-slate-900'
                          : hasUnread
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-50'
                            : 'text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      <ThreadListAvatar thread={t} currentUserId={currentUser.id} users={users} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`min-w-0 truncate ${
                              hasUnread && !active ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'
                            }`}
                          >
                            {chatThreadTitle(t, currentUser.id, userName)}
                          </span>
                          {last && (
                            <span
                              className={`shrink-0 whitespace-nowrap text-[11px] tabular-nums ${
                                hasUnread && !active
                                  ? 'font-semibold text-slate-600'
                                  : 'font-medium text-slate-400'
                              }`}
                            >
                              {format(new Date(last.createdAt), 'h:mm a')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-end justify-between gap-2">
                          <p
                            className={`line-clamp-2 min-w-0 flex-1 text-xs leading-snug ${
                              hasUnread && !active ? 'font-medium text-slate-700' : 'text-slate-500'
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
                              className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm"
                              aria-label={`${unread} unread messages`}
                            >
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversation — ONLY message list scrolls; header + composer fixed in column */}
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100 ${!selected ? 'hidden md:flex' : 'flex'}`}
          >
            {selected ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/70 bg-slate-100 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3.5">
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <ThreadListAvatar thread={selected} currentUserId={currentUser.id} users={users} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">
                      {chatThreadTitle(selected, currentUser.id, userName)}
                    </p>
                    {selected.kind === 'dm' && (() => {
                      const other = selected.memberIds.find((id) => id !== currentUser.id);
                      const u = other ? users.find((x) => x.id === other) : undefined;
                      if (!u) return null;
                      return (
                        <p className={`mt-0.5 truncate text-[11px] font-medium ${presenceTextClass(u)}`}>
                          <span
                            className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${presenceDotClass(u)}`}
                            aria-hidden
                          />
                          {presenceLabel(u)}
                        </p>
                      );
                    })()}
                    {selected.kind === 'group' && (
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {selected.teamKey
                          ? `Team chat · ${selected.teamKey}`
                          : selected.scope === 'official'
                            ? 'Official · everyone'
                            : selected.scope === 'hr_group'
                              ? 'HR group'
                              : 'Team group'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {selected.kind === 'group' && (
                      <button
                        type="button"
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                      className="shrink-0 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
                    >
                      Add people
                    </button>
                  )}
                </div>

                <div className="scrollbar-hide min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-200/60 px-4 py-5 sm:px-8">
                  <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
                    {selected.messages.map((m, idx) => {
                      const mine = m.authorId === currentUser.id;
                      const prev = idx > 0 ? selected.messages[idx - 1] : null;
                      const showDay =
                        !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
                      const d = new Date(m.createdAt);
                      return (
                        <div key={m.id}>
                          {showDay && (
                            <div className="my-4 flex justify-center">
                              <span className="rounded-full bg-slate-200/80 px-4 py-1 text-[11px] font-semibold text-slate-500">
                                {format(d, 'EEEE, MMM d · HH:mm')}
                              </span>
                            </div>
                          )}
                          <div
                            className={`flex w-full min-w-0 items-end gap-2 ${mine ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`}
                          >
                            {!mine && (
                              <UserAvatar userId={m.authorId} users={users} size="sm" variant="message" />
                            )}
                            <div className="group/message relative min-w-0 max-w-[min(100%,26rem)] shrink-0 sm:max-w-md">
                              {!m.deleted && (
                                <div
                                  className={`absolute -top-2 z-20 flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-white px-0.5 py-0.5 shadow-md opacity-0 transition-opacity group-hover/message:opacity-100 ${mine ? 'right-0' : 'left-0'}`}
                                >
                                  <button
                                    type="button"
                                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                                    title="Reply"
                                    onClick={() => {
                                      setReplyingTo(m);
                                      setEditingId(null);
                                    }}
                                  >
                                    <Reply className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                                    title="Forward"
                                    onClick={() => {
                                      setErrorHint(null);
                                      setForwardingMessage(m);
                                      setEditingId(null);
                                      setReplyingTo(null);
                                    }}
                                  >
                                    <Forward className="h-3.5 w-3.5" />
                                  </button>
                                  {mine && (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                                        title="Edit"
                                        onClick={() => startEditMessage(m)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                                        title="Delete"
                                        onClick={() => handleDeleteMessage(m)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                              <div
                                className={`rounded-3xl px-4 py-3 text-sm shadow-sm ${
                                  mine
                                    ? 'rounded-br-lg bg-gradient-to-br from-[#6366f1] to-[#5b5bd6] text-white'
                                    : 'rounded-bl-lg border border-slate-100 bg-white text-slate-800'
                                }`}
                              >
                                {m.replyToId && (() => {
                                  const parent = selected.messages.find((x) => x.id === m.replyToId);
                                  if (!parent) return null;
                                  return (
                                    <div
                                      className={`mb-2 rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug ${
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
                                    <p className={`mt-0.5 ${mine ? 'text-indigo-100/95' : 'text-slate-700'}`}>
                                      <span className="font-semibold">{m.forwardedFrom.sourceChatTitle}</span>
                                      <span className={mine ? 'text-indigo-200/90' : 'text-slate-400'}>
                                        {' '}
                                        ·{' '}
                                      </span>
                                      <span className="font-medium">{m.forwardedFrom.originalAuthorName}</span>
                                    </p>
                                  </div>
                                )}
                                {!mine && selected.kind === 'group' && (
                                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500">
                                    {userName(m.authorId)}
                                  </p>
                                )}
                                {m.deleted ? (
                                  <p className={`text-sm italic ${mine ? 'text-indigo-100' : 'text-slate-400'}`}>
                                    This message was deleted
                                  </p>
                                ) : (
                                  <>
                                    {m.body.trim() ? (
                                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                                    ) : null}
                                    {m.attachment && (
                                      <button
                                        type="button"
                                        onClick={() => setLightbox(m.attachment!)}
                                        className={`mt-2 w-full overflow-hidden rounded-xl text-left transition hover:opacity-95 ${
                                          mine ? 'ring-1 ring-white/40' : 'ring-1 ring-slate-200'
                                        }`}
                                      >
                                        {m.attachment.mimeType.startsWith('image/') ? (
                                          // eslint-disable-next-line @next/next/no-img-element -- data URL from chat
                                          <img
                                            src={m.attachment.dataUrl}
                                            alt=""
                                            className="max-h-48 w-full object-cover"
                                          />
                                        ) : (
                                          <div
                                            className={`flex items-center gap-2 px-3 py-2.5 text-xs ${
                                              mine ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-800'
                                            }`}
                                          >
                                            <FileText className="h-4 w-4 shrink-0" />
                                            <span className="min-w-0 truncate font-medium">{m.attachment.fileName}</span>
                                          </div>
                                        )}
                                      </button>
                                    )}
                                  </>
                                )}
                                <p
                                  className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}
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
                              </div>
                            </div>
                            {mine && (
                              <UserAvatar userId={m.authorId} users={users} size="sm" variant="message" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={listEndRef} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-100/70 bg-slate-50 px-4 py-3 sm:px-8 sm:py-4">
                  {errorHint && (
                    <p className="mb-2 text-xs font-medium text-rose-600">{errorHint}</p>
                  )}
                  {!canSend && selected.kind === 'group' && selected.scope === 'official' && (
                    <p className="mb-2 text-xs text-slate-500">Read-only for employees in official channels.</p>
                  )}
                  <div className="mx-auto w-full min-w-0 max-w-3xl">
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
                          <p className="truncate text-slate-600">{messageSnippet(replyingTo)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white/90"
                          aria-label="Cancel reply"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {pendingAttachment && !editingId && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate font-medium text-slate-700">
                          📎 {pendingAttachment.fileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachment(null)}
                          className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-200"
                          aria-label="Remove attachment"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        disabled={!canSend || !!editingId}
                        onClick={handlePickFile}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                        aria-label="Attach file"
                      >
                        <Paperclip className="h-5 w-5" />
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
                          !canSend
                            ? 'You cannot post here'
                            : editingId
                              ? 'Edit your message…'
                              : 'Write a message…'
                        }
                        rows={1}
                        className="min-h-[38px] max-h-28 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm leading-snug text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#7c3aed] text-white shadow-md transition hover:brightness-105 disabled:opacity-40"
                        aria-label={editingId ? 'Save edit' : 'Send'}
                      >
                        {editingId ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden bg-slate-100/60 p-10 text-center text-slate-500">
                <MessageSquare className="h-14 w-14 text-slate-200" />
                <p className="font-semibold text-slate-700">Select a conversation</p>
                <p className="max-w-xs text-sm">Choose a chat from the list or start a new DM.</p>
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
            className="scrollbar-hide flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Group details</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
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
                    className="text-xs font-medium text-slate-500 hover:text-rose-600"
                    onClick={() => {
                      setErrorHint(null);
                      updateGroupChat(selected.id, { avatarUrl: null });
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Group name
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={groupNameEdit}
                  onChange={(e) => setGroupNameEdit(e.target.value)}
                  disabled={!canEditSelectedGroup}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
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
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Add members
                  </p>
                  {eligibleToAddToSelected.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No one else can be added right now.</p>
                  ) : (
                    <>
                      <div className="scrollbar-hide mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
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
                            <span className="text-sm text-slate-800">
                              {u.name} <span className="text-slate-500">({u.role})</span>
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
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Members ({selected.memberIds.length})
              </p>
              <ul className="mt-2 space-y-2">
                {[...selected.memberIds]
                  .sort((a, b) => userName(a).localeCompare(userName(b)))
                  .map((id) => {
                    const u = users.find((x) => x.id === id);
                    const isSelf = id === currentUser.id;
                    const canLeaveGroup = isSelf && selected.memberIds.length > 1;
                    const canRemoveOther = !isSelf && canShowAddMembers;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <UserAvatar userId={id} users={users} size="sm" variant="list" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{userName(id)}</p>
                          <p className="truncate text-xs text-slate-500">{u?.role ?? ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {canRemoveOther && (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
            className="flex max-h-[92vh] max-w-[min(96vw,56rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="min-w-0 truncate text-sm font-medium text-slate-800">{lightbox.fileName}</p>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
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
                  className="mx-auto h-[min(80vh,720px)] w-full min-w-[min(90vw,48rem)] rounded-lg border border-slate-200"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <FileText className="h-14 w-14 text-slate-400" />
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
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {errorHint && (
              <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {errorHint}
              </p>
            )}
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">Forward to…</h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {messageSnippet(forwardingMessage)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setForwardingMessage(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {forwardTargets.length === 0 ? (
              <p className="text-sm text-slate-500">
                No other chat available where you can send messages. Open or create a DM or group first.
              </p>
            ) : (
              <ul className="scrollbar-hide max-h-72 space-y-1 overflow-y-auto">
                {forwardTargets.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50"
                      onClick={() => runForwardTo(t.id)}
                    >
                      <ThreadListAvatar thread={t} currentUserId={currentUser.id} users={users} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
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
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New direct message</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setDmOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {dmTargets.length === 0 ? (
              <p className="text-sm text-slate-500">No allowed contacts for your role.</p>
            ) : (
              <ul className="scrollbar-hide max-h-64 space-y-1 overflow-y-auto">
                {dmTargets.map((id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50"
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
                          <span className="font-semibold text-slate-800">{u.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{u.role}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New group</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setGroupOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Name
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="e.g. Project Alpha"
            />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Members</p>
            <div className="scrollbar-hide mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
              {eligibleForNewGroup.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={groupMemberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id, groupMemberIds, setGroupMemberIds)}
                  />
                  <span className="text-sm">
                    {u.name} <span className="text-slate-400">({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                const sc = groupScope();
                if (!sc) return;
                const r = await createGroupChat({ name: groupName, memberIds: groupMemberIds, scope: sc });
                if (r.ok) {
                  setSelectedId(r.chatId);
                  setGroupOpen(false);
                } else setErrorHint(r.error ?? 'Could not create');
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#7c3aed] py-3 text-sm font-semibold text-white shadow-md"
            >
              Create
            </button>
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
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">Add people</h2>
            <div className="scrollbar-hide mt-3 max-h-48 space-y-1 overflow-y-auto">
              {eligibleToAddToSelected.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
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
    </div>
  );
}
