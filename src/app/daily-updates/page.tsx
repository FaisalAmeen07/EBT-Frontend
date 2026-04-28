'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Filter,
  Layers,
  ListChecks,
  ScrollText,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { useStore, useShallow } from '@/lib/store';
import type { EmployeeDailyUpdate, Role, TeamLeaderDailySummary, User } from '@/lib/store';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  fetchLeadershipOverviewApi,
  fetchMyEmployeeDailyUpdatesApi,
  fetchTeamLeaderDailyBundleApi,
  upsertHrSummaryApi,
  upsertMyEmployeeDailyUpdateApi,
  upsertTeamLeaderSummaryApi,
} from '@/services/dailyUpdates.service';

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
  return 'Request failed';
}

/** Single-line preview for table cells; full text opens in `TextDetailModal`. */
function oneLinePreview(s: string): string {
  return s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function TextDetailModal({
  open,
  onClose,
  title,
  subtitle,
  body,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  body: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-detail-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2 id="text-detail-modal-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{body}</p>
        </div>
      </div>
    </div>
  );
}

/** Shared TL rollup table — same data and filters for HR and Admin. */
function TeamLeadSummariesPanel({
  date,
  users,
  teamLeaderDailySummaries,
  teams: teamRegistry,
}: {
  date: string;
  users: User[];
  teamLeaderDailySummaries: TeamLeaderDailySummary[];
  teams: string[];
}) {
  const [teamFilter, setTeamFilter] = useState<string>('__all__');
  const [summarySearch, setSummarySearch] = useState('');

  const tlSummariesForDate = useMemo(() => {
    // Data is already fetched scoped to `date` from the API; don't re-filter client-side.
    return [...teamLeaderDailySummaries].sort((a, b) => a.team.localeCompare(b.team));
  }, [teamLeaderDailySummaries]);

  const filteredTlSummaries = useMemo(() => {
    let rows = tlSummariesForDate;
    if (teamFilter !== '__all__') {
      rows = rows.filter((s) => s.team === teamFilter);
    }
    const q = summarySearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) =>
          s.team.toLowerCase().includes(q) ||
          s.body.toLowerCase().includes(q) ||
          userLabel(users.find((u) => u.id === s.authorId)).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [tlSummariesForDate, teamFilter, summarySearch, users]);

  const teamOptions = useMemo(() => {
    const fromData = new Set(tlSummariesForDate.map((s) => s.team));
    for (const t of teamRegistry) {
      if (t?.trim()) fromData.add(t.trim());
    }
    return [...fromData].sort((a, b) => a.localeCompare(b));
  }, [tlSummariesForDate, teamRegistry]);

  const [detail, setDetail] = useState<{ title: string; subtitle: string; body: string } | null>(null);

  return (
    <>
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Team lead summaries</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Building2 className="h-4 w-4 text-slate-400" />
            Team
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              <option value="__all__">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={summarySearch}
              onChange={(e) => setSummarySearch(e.target.value)}
              placeholder="Search summaries…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
        </div>
      </div>

      {filteredTlSummaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No summaries match your filters for this date.</p>
          <p className="mt-1 text-xs text-slate-400">Try another date or clear search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTlSummaries.map((s) => {
                const author = users.find((u) => u.id === s.authorId);
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-violet-50/30"
                    onClick={() =>
                      setDetail({
                        title: 'Team lead summary',
                        subtitle: `${s.team} · ${userLabel(author)}`,
                        body: s.body,
                      })
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-900">{s.team}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600">{userLabel(author)}</td>
                    <td className="max-w-0 min-w-[140px] px-4 py-3 align-middle text-slate-700">
                      <p className="truncate" title={oneLinePreview(s.body)}>
                        {oneLinePreview(s.body)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    {detail ? (
      <TextDetailModal
        open
        onClose={() => setDetail(null)}
        title={detail.title}
        subtitle={detail.subtitle}
        body={detail.body}
      />
    ) : null}
    </>
  );
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, mo, d] = s.split('-').map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1);
}

function formatHeaderDate(ymd: string): string {
  try {
    return format(parseYmd(ymd), 'EEEE, MMMM d, yyyy');
  } catch {
    return ymd;
  }
}

/** Shown when reporting date ≠ calendar today — saves are blocked for Emp / TL / HR. */
function SubmitTodayOnlyHint() {
  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Today-only submission</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
            You can view past dates, but saving is only allowed for <span className="font-semibold">today</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

const DAILY_UPDATES_ROLES: Role[] = ['Employee', 'Team Leader', 'HR', 'Admin'];

function userLabel(u: User | undefined): string {
  if (!u) return 'Unknown';
  return u.name || u.email;
}

export default function DailyUpdatesPage() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'Pending User') {
      router.replace('/pending');
      return;
    }
    if (!DAILY_UPDATES_ROLES.includes(currentUser.role)) {
      router.replace('/');
    }
  }, [currentUser, router]);

  if (!currentUser || currentUser.role === 'Pending User') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Loading…</div>
    );
  }

  if (!DAILY_UPDATES_ROLES.includes(currentUser.role)) {
    return null;
  }

  return <DailyUpdatesContent role={currentUser.role} />;
}

function DailyUpdatesContent({ role }: { role: Role }) {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const todayYmd = toDateInputValue(new Date());
  const yesterday = toDateInputValue(subDays(new Date(), 1));
  const canSubmitToday = date === todayYmd;

  const roleLabel =
    role === 'Employee'
      ? 'Employee'
      : role === 'Team Leader'
        ? 'Team lead'
        : role === 'HR'
          ? 'Human resources'
          : 'Administrator';

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-7xl px-0 sm:px-4 lg:px-6">
        {/* Hero header */}
        <div className="relative overflow-hidden border-y border-slate-200/80 bg-gradient-to-b from-white to-slate-50 sm:rounded-2xl sm:border sm:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500" />
          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <h1 className="flex flex-wrap items-center gap-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_10px_30px_rgba(79,70,229,0.25)]">
                    <ScrollText className="h-6 w-6" aria-hidden />
                  </span>
                  <span>Daily updates</span>
                </h1>
              </div>

              <div className="w-full shrink-0 sm:max-w-sm lg:w-[360px]">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reporting date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatHeaderDate(date)}</p>

                  <div className="mt-3 inline-flex w-full rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setDate(todayYmd)}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
                        date === todayYmd ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(yesterday)}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
                        date === yesterday ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Yesterday
                    </button>
                  </div>

                  <div className="relative mt-3">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
          {role === 'Employee' ? <EmployeeSection date={date} canSubmitToday={canSubmitToday} /> : null}
          {role === 'Team Leader' ? <TeamLeaderSection date={date} canSubmitToday={canSubmitToday} /> : null}
          {role === 'HR' ? <HRSection date={date} canSubmitToday={canSubmitToday} /> : null}
          {role === 'Admin' ? <AdminSection date={date} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ——— Employee ——— */

function EmployeeSection({ date, canSubmitToday }: { date: string; canSubmitToday: boolean }) {
  const { currentUser } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
    }))
  );
  const [body, setBody] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPreset, setHistoryPreset] = useState<'all' | '30d' | '7d'>('30d');
  const [historyDetail, setHistoryDetail] = useState<{ title: string; subtitle: string; body: string } | null>(null);
  const [myUpdates, setMyUpdates] = useState<EmployeeDailyUpdate[]>([]);
  const [loading, setLoading] = useState(false);

  const mine = useMemo(() => {
    if (!currentUser) return [];
    return myUpdates
      .filter((e) => e.userId === currentUser.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [myUpdates, currentUser]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    const cutoff =
      historyPreset === '7d'
        ? subDays(now, 7)
        : historyPreset === '30d'
          ? subDays(now, 30)
          : null;
    let rows = mine;
    if (cutoff) {
      rows = rows.filter((r) => parseYmd(r.date) >= startOfDayLocal(cutoff));
    }
    const q = historySearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.body.toLowerCase().includes(q) || r.date.includes(q));
    }
    return rows;
  }, [mine, historyPreset, historySearch]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Employee') return;
    const row = myUpdates.find((e) => e.userId === currentUser.id && e.date === date);
    setBody(row?.body ?? '');
  }, [currentUser, date, myUpdates]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Employee') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await fetchMyEmployeeDailyUpdatesApi();
        if (!cancelled) setMyUpdates(list);
      } catch (e) {
        if (!cancelled) toast(apiErrorMessage(e), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role]);

  if (!currentUser || currentUser.role !== 'Employee') return null;

  const onSave = async () => {
    if (!canSubmitToday) return;
    try {
      const saved = await upsertMyEmployeeDailyUpdateApi({ date, body });
      setMyUpdates((prev) => {
        const next = prev.filter((x) => !(x.userId === saved.userId && x.date === saved.date));
        return [saved, ...next];
      });
      toast('Saved successfully.');
    } catch (e) {
      toast(apiErrorMessage(e), 'error');
    }
  };

  const hasEntryForSelectedDate = mine.some((r) => r.date === date);

  return (
    <section className="overflow-hidden border-y border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 sm:rounded-2xl sm:border">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your daily update</h2>
            </div>
          </div>
          {hasEntryForSelectedDate && (
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              Saved for {date}
            </span>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 p-6 sm:p-8">
        <div className="w-full min-w-0 space-y-4">
          {!canSubmitToday ? <SubmitTodayOnlyHint /> : null}
          <label className="block w-full min-w-0">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Update text</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              readOnly={!canSubmitToday}
              rows={8}
              placeholder="Tasks completed, focus areas, blockers, tomorrow’s plan…"
              className={cn(
                'box-border w-full min-w-0 max-w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10',
                canSubmitToday ? 'bg-slate-50/50 focus:bg-white' : 'cursor-default bg-slate-100/80 text-slate-700'
              )}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSubmitToday || !body.trim()}
              title={!canSubmitToday ? 'Switch reporting date to today to save' : undefined}
              className={cn(
                'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md transition',
                canSubmitToday
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500'
              )}
            >
              {canSubmitToday ? (loading ? 'Saving…' : `Save`) : 'Today only'}
            </button>
            <span className="text-xs text-slate-500">
              {body.trim().length === 0 ? 'Write an update to enable save.' : `${body.trim().length} characters`}
            </span>
          </div>
        </div>

      </div>
      {historyDetail ? (
        <TextDetailModal
          open
          onClose={() => setHistoryDetail(null)}
          title={historyDetail.title}
          subtitle={historyDetail.subtitle}
          body={historyDetail.body}
        />
      ) : null}
    </section>
  );
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* ——— Team Leader ——— */

function TeamLeaderSection({ date, canSubmitToday }: { date: string; canSubmitToday: boolean }) {
  const { currentUser, users } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
    }))
  );
  const [summaryBody, setSummaryBody] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'missing'>('all');
  const [memberDetail, setMemberDetail] = useState<{ title: string; subtitle: string; body: string } | null>(null);
  const [employeeDailyUpdates, setEmployeeDailyUpdates] = useState<EmployeeDailyUpdate[]>([]);
  const [teamLeaderDailySummaries, setTeamLeaderDailySummaries] = useState<TeamLeaderDailySummary[]>([]);
  const [rosterMembers, setRosterMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>(
    []
  );
  const [loading, setLoading] = useState(false);

  const myTeam = currentUser?.team?.trim();

  const teamEmployees = useMemo(() => {
    // Prefer roster from API so TL always sees correct roster.
    const fromApi = rosterMembers
      .filter((m) => String(m.role).toLowerCase().includes('employee'))
      .map((m) => ({ id: m.id, name: m.name, email: m.email }));
    if (fromApi.length > 0) return fromApi;

    if (!myTeam) return [];
    // Fallback when offline: directory users filtered by team.
    return users
      .filter((u) => (u.team?.trim() ?? '') === myTeam && u.role === 'Employee')
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  }, [rosterMembers, users, myTeam]);

  useEffect(() => {
    setMemberDetail(null);
  }, [date]);

  const updatesByUserId = useMemo(() => {
    const map = new Map<string, EmployeeDailyUpdate>();
    for (const e of employeeDailyUpdates) {
      // API already scopes by `date`; don't re-filter here (prevents false “Missing” on date format edge-cases).
      map.set(e.userId, e);
    }
    return map;
  }, [employeeDailyUpdates]);

  const filteredMembers = useMemo(() => {
    let list = teamEmployees;
    const q = memberSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (statusFilter === 'submitted') {
      list = list.filter((u) => updatesByUserId.has(u.id));
    } else if (statusFilter === 'missing') {
      list = list.filter((u) => !updatesByUserId.has(u.id));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamEmployees, memberSearch, statusFilter, updatesByUserId]);

  const stats = useMemo(() => {
    const submitted = teamEmployees.filter((u) => updatesByUserId.has(u.id)).length;
    return { total: teamEmployees.length, submitted, missing: teamEmployees.length - submitted };
  }, [teamEmployees, updatesByUserId]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Team Leader') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const bundle = await fetchTeamLeaderDailyBundleApi(date);
        if (cancelled) return;
        setEmployeeDailyUpdates(bundle.employeeUpdates);
        setTeamLeaderDailySummaries(bundle.mySummary ? [bundle.mySummary] : []);
        setRosterMembers(bundle.members || []);
        if (bundle.mySummary?.body != null) setSummaryBody(bundle.mySummary.body);
        else setSummaryBody('');
      } catch (e) {
        if (!cancelled) toast(apiErrorMessage(e), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, date]);

  if (!currentUser || currentUser.role !== 'Team Leader') return null;

  if (!myTeam) {
    return (
      <section className="border-y border-amber-200/80 bg-amber-50/60 p-6 shadow-sm sm:rounded-2xl sm:border sm:p-8">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-amber-950">No team assigned</h2>
            <p className="mt-1 text-sm text-amber-900/90">
              Ask HR or an administrator to place you on a team roster before you can review member updates.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const onSaveSummary = async () => {
    if (!canSubmitToday) return;
    try {
      const saved = await upsertTeamLeaderSummaryApi({ date, body: summaryBody });
      setTeamLeaderDailySummaries([saved]);
      toast('Team summary saved.');
    } catch (e) {
      toast(apiErrorMessage(e), 'error');
    }
  };

  return (
    <section className="overflow-hidden border-y border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 sm:rounded-2xl sm:border">
      <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Employees Data</h2>
              <p className="mt-1 text-xs text-slate-500">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                    Loading updates for <span className="font-semibold">{date}</span>
                  </span>
                ) : (
                  <>
                    Loaded <span className="font-semibold">{employeeDailyUpdates.length}</span> updates for{' '}
                    <span className="font-semibold">{date}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Members" value={stats.total} />
            <StatPill label="Submitted" value={stats.submitted} variant="ok" />
            <StatPill label="Missing" value={stats.missing} variant={stats.missing > 0 ? 'warn' : 'muted'} />
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['all', 'All'],
                ['submitted', 'Has update'],
                ['missing', 'Missing only'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  statusFilter === key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && employeeDailyUpdates.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading roster</p>
            <div className="mt-4">
              <SkeletonRows rows={5} />
            </div>
          </div>
        ) : teamEmployees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-500">
            No employees on this team yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table
              key={`tl-emp-${date}`}
              className="w-full min-w-[640px] border-collapse text-left text-sm"
            >
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredMembers.map((emp) => {
                  const upd = updatesByUserId.get(emp.id);
                  return (
                    <tr
                      key={`${date}-${emp.id}`}
                      className={cn('hover:bg-slate-50/80', upd && 'cursor-pointer')}
                      onClick={() => {
                        if (!upd) return;
                        setMemberDetail({
                          title: emp.name,
                          subtitle: `${date} · ${emp.email}`,
                          body: upd.body,
                        });
                      }}
                    >
                      <td className="px-4 py-3 align-middle">
                        <p className="font-semibold text-slate-900">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        {upd ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="max-w-0 min-w-[120px] px-4 py-3 align-middle text-slate-700">
                        {upd ? (
                          <p className="truncate" title={oneLinePreview(upd.body)}>
                            {oneLinePreview(upd.body)}
                          </p>
                        ) : (
                          <span className="text-sm italic text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-6">
          <h3 className="text-sm font-bold text-slate-900">Team summary for HR</h3>
          {!canSubmitToday ? <div className="mt-3"><SubmitTodayOnlyHint /></div> : null}
          <textarea
            value={summaryBody}
            onChange={(e) => setSummaryBody(e.target.value)}
            readOnly={!canSubmitToday}
            rows={5}
            placeholder="Roll up themes, risks, and wins for HR…"
            className={cn(
              'mt-4 w-full resize-y rounded-xl border border-indigo-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10',
              canSubmitToday ? 'bg-white' : 'cursor-default bg-slate-100/80'
            )}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveSummary}
              disabled={!canSubmitToday}
              title={!canSubmitToday ? 'Switch reporting date to today to save' : undefined}
              className={cn(
                'rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md transition',
                canSubmitToday
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500'
              )}
            >
              {canSubmitToday ? (loading ? 'Saving…' : 'Save team summary') : 'Save team summary (today only)'}
            </button>
          </div>
        </div>
      </div>
      {memberDetail ? (
        <TextDetailModal
          open
          onClose={() => setMemberDetail(null)}
          title={memberDetail.title}
          subtitle={memberDetail.subtitle}
          body={memberDetail.body}
        />
      ) : null}
    </section>
  );
}

function StatPill({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'ok' | 'warn' | 'muted';
}) {
  const styles = {
    default: 'border-slate-200 bg-white text-slate-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-950',
    muted: 'border-slate-200 bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm',
        styles[variant]
      )}
    >
      {label}
      <span className="tabular-nums text-[13px]">{value}</span>
    </span>
  );
}

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={cn('h-3 rounded bg-slate-200/80', w)} />;
}

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine w="w-48" />
          <SkeletonLine w="w-full" />
        </div>
      ))}
    </div>
  );
}

/* ——— HR ——— */

function HRSection({ date, canSubmitToday }: { date: string; canSubmitToday: boolean }) {
  const { currentUser, users, teams: teamRegistry } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      teams: s.teams,
    }))
  );
  const [hrBody, setHrBody] = useState('');
  const [teamLeaderDailySummaries, setTeamLeaderDailySummaries] = useState<TeamLeaderDailySummary[]>([]);
  const [hrDailySummaries, setHrDailySummaries] = useState<{ date: string; body: string; authorId: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'HR') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchLeadershipOverviewApi(date);
        if (cancelled) return;
        setTeamLeaderDailySummaries(data.teamLeaderSummaries);
        setHrDailySummaries(data.hrSummary ? [data.hrSummary] : []);
        setHrBody(data.hrSummary?.body ?? '');
      } catch (e) {
        if (!cancelled) toast(apiErrorMessage(e), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, date]);

  if (!currentUser || currentUser.role !== 'HR') return null;

  const onSaveHr = async () => {
    if (!canSubmitToday) return;
    try {
      const saved = await upsertHrSummaryApi({ date, body: hrBody });
      setHrDailySummaries([saved]);
      toast('Saved.');
    } catch (e) {
      toast(apiErrorMessage(e), 'error');
    }
  };

  return (
    <section className="overflow-hidden border-y border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 sm:rounded-2xl sm:border">
      <div className="space-y-8 p-6 sm:p-8">
        {loading && teamLeaderDailySummaries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Team lead summaries</h3>
              <span className="text-xs font-semibold text-slate-500">Loading…</span>
            </div>
            <div className="mt-4">
              <SkeletonRows rows={6} />
            </div>
          </div>
        ) : (
          <TeamLeadSummariesPanel
            date={date}
            users={users}
            teamLeaderDailySummaries={teamLeaderDailySummaries}
            teams={teamRegistry}
          />
        )}

        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-6">
          <h3 className="text-sm font-bold text-slate-900">HR note for leadership</h3>
          {!canSubmitToday ? <div className="mt-3"><SubmitTodayOnlyHint /></div> : null}
          <textarea
            value={hrBody}
            onChange={(e) => setHrBody(e.target.value)}
            readOnly={!canSubmitToday}
            rows={5}
            placeholder="Organization-level narrative for leadership…"
            className={cn(
              'mt-4 w-full resize-y rounded-xl border border-violet-100 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10',
              canSubmitToday ? 'bg-white' : 'cursor-default bg-slate-100/80'
            )}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveHr}
              disabled={!canSubmitToday}
              title={!canSubmitToday ? 'Switch reporting date to today to save' : undefined}
              className={cn(
                'rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md transition',
                canSubmitToday
                  ? 'bg-violet-600 text-white hover:bg-violet-500'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500'
              )}
            >
              {canSubmitToday ? (loading ? 'Saving…' : 'Save') : 'Today only'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Admin ——— */

function AdminSection({ date }: { date: string }) {
  const { currentUser, users, teams: teamRegistry } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      teams: s.teams,
    }))
  );
  const [teamLeaderDailySummaries, setTeamLeaderDailySummaries] = useState<TeamLeaderDailySummary[]>([]);
  const [hrDailySummaries, setHrDailySummaries] = useState<{ date: string; body: string; authorId: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Data is fetched scoped to `date`; keep first row if present.
  const hrNote = hrDailySummaries[0] ?? null;
  const hrAuthor = hrNote ? users.find((u) => u.id === hrNote.authorId) : undefined;

  const teamsSorted = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.team?.trim()) set.add(u.team.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const adminStats = useMemo(() => {
    return { teams: teamsSorted.length, tlSummaries: teamLeaderDailySummaries.length };
  }, [teamsSorted.length, teamLeaderDailySummaries.length]);

  const [hrNoteModalOpen, setHrNoteModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchLeadershipOverviewApi(date);
        if (cancelled) return;
        setTeamLeaderDailySummaries(data.teamLeaderSummaries);
        setHrDailySummaries(data.hrSummary ? [data.hrSummary] : []);
      } catch (e) {
        if (!cancelled) toast(apiErrorMessage(e), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, date]);

  if (!currentUser || currentUser.role !== 'Admin') return null;

  return (
    <section className="overflow-hidden border-y border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 sm:rounded-2xl sm:border">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-100/80 to-white px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Admin</h2>            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Teams" value={adminStats.teams} />
            <StatPill label="TL summaries (this date)" value={adminStats.tlSummaries} variant="ok" />
          </div>
        </div>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        {loading && teamLeaderDailySummaries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Team lead summaries</h3>
              <span className="text-xs font-semibold text-slate-500">Loading…</span>
            </div>
            <div className="mt-4">
              <SkeletonRows rows={6} />
            </div>
          </div>
        ) : (
          <TeamLeadSummariesPanel
            date={date}
            users={users}
            teamLeaderDailySummaries={teamLeaderDailySummaries}
            teams={teamRegistry}
          />
        )}

        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-6">
          <h3 className="text-sm font-bold text-slate-900">HR note for leadership</h3>
          <button
            type="button"
            disabled={!hrNote}
            onClick={() => hrNote && setHrNoteModalOpen(true)}
            className={cn(
              'mt-4 w-full rounded-xl border border-violet-100 bg-white px-4 py-3 text-left text-sm text-slate-800 transition',
              hrNote ? 'cursor-pointer hover:bg-violet-50/50' : 'cursor-default'
            )}
          >
            {hrNote ? (
              <p className="truncate">{oneLinePreview(hrNote.body)}</p>
            ) : (
              <p className="italic text-slate-400">No HR note has been saved for this date.</p>
            )}
          </button>
          <p className="mt-2 text-[11px] text-slate-500">Click to read the full message.</p>
        </div>
      </div>
      {hrNote ? (
        <TextDetailModal
          open={hrNoteModalOpen}
          onClose={() => setHrNoteModalOpen(false)}
          title="HR note for leadership"
          subtitle={`${userLabel(hrAuthor)} · ${date}`}
          body={hrNote.body}
        />
      ) : null}
    </section>
  );
}
