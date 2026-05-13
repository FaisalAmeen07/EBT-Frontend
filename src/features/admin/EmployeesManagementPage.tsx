'use client';

import { employeeDisplayId } from '@/lib/attendanceSite';
import { useStore, useShallow, Role, User, mergeUsersWithSeed } from '@/lib/store';
import {
  approveUserApi,
  frontendRoleToApiRole,
  rejectUserApi,
  updateUserRoleApi,
} from '@/services/admin.service';
import { buildUsersWithResolvedTeams } from '@/services/team.service';
import { isAxiosError } from 'axios';
import {
  ShieldCheck,
  Users,
  Mail,
  Trash2,
  X,
  Check,
  Shield,
  Hash,
  Search,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function apiErrorMessage(e: unknown): string {
  if (
    isAxiosError(e) &&
    e.response?.data &&
    typeof e.response.data === 'object' &&
    e.response.data !== null &&
    'message' in e.response.data
  ) {
    return String((e.response.data as { message: unknown }).message);
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

type RoleFilter = 'All' | 'Employee' | 'Team Leader' | 'HR' | 'Pending User';

function roleBadgeClass(role: Role): string {
  if (role === 'HR')
    return 'bg-indigo-50 text-indigo-800 border-indigo-100 dark:bg-indigo-950/55 dark:text-indigo-100 dark:border-indigo-800';
  if (role === 'Team Leader')
    return 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/45 dark:text-amber-100 dark:border-amber-800';
  if (role === 'Employee') return 'bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  if (role === 'Pending User')
    return 'bg-violet-50 text-violet-800 border-violet-100 dark:bg-violet-950/45 dark:text-violet-100 dark:border-violet-800';
  return 'bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800';
}

/**
 * Promote modal targets only (matches backend: e.g. no Team Leader → Employee via API).
 * - Pending: Employee, Team Leader, or HR
 * - Employee: Team Leader or HR only
 * - Team Leader: HR only
 * - HR: HR only
 */
function promotableRolesForUser(currentRole: Role): Role[] {
  switch (currentRole) {
    case 'Pending User':
      return ['Employee', 'Team Leader', 'HR'];
    case 'Employee':
      return ['Team Leader', 'HR'];
    case 'Team Leader':
      return ['HR'];
    case 'HR':
      return ['HR'];
    default:
      return [];
  }
}

export function EmployeesManagementPage() {
  const searchParams = useSearchParams();
  const { users, replaceDirectoryUsers, currentUser } = useStore(
    useShallow((s) => ({
      users: s.users,
      replaceDirectoryUsers: s.replaceDirectoryUsers,
      currentUser: s.currentUser,
    }))
  );
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [idSearch, setIdSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoadError(null);
      setActionError(null);
      setLoading(true);
    }
    try {
      const merged = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(merged);
      setLoadError(null);
    } catch (e) {
      if (!silent) setLoadError(apiErrorMessage(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [replaceDirectoryUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadUsers({ silent: true });
    }, 35_000);
    return () => window.clearInterval(id);
  }, [loadUsers]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadUsers({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadUsers]);

  const directoryUsers = useMemo(() => mergeUsersWithSeed(users), [users]);
  const nonAdminUsers = useMemo(
    () => directoryUsers.filter((u) => u.role !== 'Admin'),
    [directoryUsers]
  );

  const promoteRoleOptions = useMemo(
    () => (editingUser ? promotableRolesForUser(editingUser.role) : []),
    [editingUser]
  );

  const filteredUsers = useMemo(() => {
    let list = nonAdminUsers;
    if (roleFilter !== 'All') {
      list = list.filter((u) => u.role === roleFilter);
    }
    const q = idSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const uid = employeeDisplayId(u).toLowerCase();
        return uid.includes(q) || u.id.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
      });
    }
    return list;
  }, [nonAdminUsers, roleFilter, idSearch]);

  const submitRoleChange = async (user: User, newRole: Role) => {
    if (newRole === user.role) {
      setEditingUser(null);
      return;
    }
    if (newRole === 'Pending User') {
      window.alert('You cannot set a user back to Pending from this screen.');
      return;
    }
    setActionError(null);
    setBusyRole(newRole);
    try {
      if (user.role === 'Pending User') {
        await approveUserApi(Number(user.id), frontendRoleToApiRole(newRole));
      } else {
        await updateUserRoleApi(user.id, frontendRoleToApiRole(newRole));
      }
      await loadUsers({ silent: true });
      setEditingUser(null);
    } catch (e) {
      setActionError(apiErrorMessage(e));
    } finally {
      setBusyRole(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (currentUser?.id === userId) {
      window.alert('You cannot remove your own account from here.');
      return;
    }
    if (!confirm(`Remove ${userName} from the system? This cannot be undone.`)) return;
    setActionError(null);
    setBusy(true);
    try {
      await rejectUserApi(Number(userId));
      await loadUsers({ silent: true });
    } catch (e) {
      setActionError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filterTabs: { key: RoleFilter; label: string }[] = [
    { key: 'All', label: 'All' },
    { key: 'Employee', label: 'Employee' },
    { key: 'Team Leader', label: 'Team Leader' },
    { key: 'HR', label: 'HR' },
    { key: 'Pending User', label: 'Pending' },
  ];

  useEffect(() => {
    const rawRole = searchParams.get('role');
    if (!rawRole) return;
    const decodedRole = decodeURIComponent(rawRole).trim();
    const allowedRoles: RoleFilter[] = ['All', 'Employee', 'Team Leader', 'HR', 'Pending User'];
    if (allowedRoles.includes(decodedRole as RoleFilter)) {
      setRoleFilter(decodedRole as RoleFilter);
    }
  }, [searchParams]);

  return (
    <div className="mx-auto min-h-full max-w-6xl space-y-8 pb-12">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 p-8 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:shadow-black/25">
        <div>
          <div className="flex flex-col gap-2">
            <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-slate-800 dark:text-slate-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-950/40">
                <ShieldCheck className="h-7 w-7" />
              </span>
              Employees management
            </h1>
          </div>
        </div>

        <div className="mt-8 space-y-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-4 shadow-inner backdrop-blur-sm sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Filters</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleFilter(tab.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    roleFilter === tab.key
                      ? 'bg-slate-900 text-white shadow-md dark:bg-indigo-600 dark:text-white'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/90'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-md lg:w-80">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Unique ID
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="search"
                  value={idSearch}
                  onChange={(e) => setIdSearch(e.target.value)}
                  placeholder="Search by code or internal ID…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-10 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none transition hover:border-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredUsers.length}</span> user
            {filteredUsers.length !== 1 ? 's' : ''}
            {roleFilter !== 'All' ? ` · ${roleFilter}` : ''}
            {loading ? ' · Loading…' : ''}
          </p>
          {loadError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{loadError}</p>
          ) : null}
          {actionError && !editingUser ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{actionError}</p>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
          <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          User directory
        </h2>
        {loading && filteredUsers.length === 0 ? (
          <div className="flex justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-20">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" aria-label="Loading users" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-16 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No users match these filters.</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Try another role tab or clear the Unique ID search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user) => {
              const uid = employeeDisplayId(user);
              return (
                <div
                  key={user.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-sm transition hover:border-blue-200/80 hover:shadow-md dark:hover:border-slate-600 dark:hover:bg-slate-800/30 dark:hover:shadow-black/25"
                >
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start gap-4">
                      <div className="relative flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-700/80">
                        {user.avatar?.trim() ? (
                          // eslint-disable-next-line @next/next/no-img-element -- CDN / data URL from profile API
                          <img
                            src={user.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200">
                            {user.name.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{user.name}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass(user.role)}`}
                          >
                            {user.role}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            {uid}
                          </span>
                          {user.isVerified === false ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100">
                              Email unverified
                            </span>
                          ) : null}
                          {user.isApproved === false ? (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-100">
                              Awaiting approval
                            </span>
                          ) : null}
                        </div>
                        {user.team ? (
                          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Team: <span className="font-medium text-slate-700 dark:text-slate-200">{user.team}</span>
                          </p>
                        ) : (
                          <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">No team assigned</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setEditingUser(user);
                        }}
                        disabled={busy || !!busyRole}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-blue-200/50 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 min-[360px]:flex-initial dark:shadow-blue-950/30 dark:hover:from-blue-500 dark:hover:to-indigo-500"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Promote / role
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user.id, user.name)}
                        disabled={busy || !!busyRole || currentUser?.id === user.id}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/45 disabled:opacity-50"
                        title="Remove user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingUser && (
        <div
          className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-300"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActionError(null);
              setEditingUser(null);
            }
          }}
        >
          <div
            className="animate-in zoom-in-95 w-full max-w-sm overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900 shadow-2xl duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 dark:border-slate-800 p-8 text-center">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setEditingUser(null);
                }}
                className="absolute right-6 top-6 rounded-full p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <X className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </button>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Shield className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Promote or change role</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{editingUser.name}</p>
              <p className="mt-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                ID {employeeDisplayId(editingUser)}
              </p>
            </div>
            <div className="space-y-3 p-8">
              {actionError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
                  {actionError}
                </p>
              ) : null}
              {promoteRoleOptions.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">No role changes available for this account.</p>
              ) : (
                promoteRoleOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={!!busyRole}
                    onClick={() => void submitRoleChange(editingUser, r)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-6 py-4 text-sm font-bold transition disabled:opacity-50 ${
                      editingUser.role === r
                        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-100'
                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/90'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {busyRole === r ? <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" /> : null}
                      {r}
                    </span>
                    {editingUser.role === r ? <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
