'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, AlertCircle, UserCheck, Clock, Activity, Filter } from 'lucide-react';
import { useStore, useShallow } from '@/lib/store';
import type { Role } from '@/lib/store';
import { fetchAttendanceSummaryApi, type AttendanceSummaryUser } from '@/services/attendance.service';

export default function AvailabilityPage() {
  const currentUser = useStore((s) => s.currentUser);

  if (currentUser?.role === 'Admin') {
    return <AdminAvailabilityBoard />;
  }

  return <EmployeeAvailabilityView />;
}

const BOARD_ROLES: Role[] = ['Employee', 'HR', 'Team Leader'];
type BoardRoleFilter = 'all' | Role;
type BoardStatusFilter = 'all' | 'Available' | 'Unavailable' | 'Leave';
type AttendanceLogPreset = 'today' | '7d' | '30d' | 'custom';

function displayStatusLabel(status?: string): string {
  if (!status) return 'Not Set';
  if (status === 'Available') return 'Present';
  if (status === 'Unavailable') return 'Absent';
  if (status === 'Not Set') return 'N/A';
  return status;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/** Calendar day in local time, comparable to other dates at midnight. */
function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isApprovedLeaveLeaveDay(
  date: Date,
  userId: string,
  leaves: { userId: string; type: string; status: string; startDate: string; endDate: string }[]
): boolean {
  const dayMs = dayStartMs(date);
  return leaves.some((l) => {
    const normalizedStatus = String(l.status || '').trim().toUpperCase();
    if (l.userId !== userId || l.type !== 'Leave' || normalizedStatus !== 'APPROVED') return false;
    const startMs = dayStartMs(fromDateInputValue(String(l.startDate || '').slice(0, 10)));
    const endMs = dayStartMs(fromDateInputValue(String(l.endDate || '').slice(0, 10)));
    return dayMs >= startMs && dayMs <= endMs;
  });
}

function normalizeApiRole(role?: string): Role | null {
  const r = String(role || '').trim().toLowerCase().replace(/[_-]/g, ' ');
  if (r === 'employee') return 'Employee';
  if (r === 'hr') return 'HR';
  if (r === 'team leader' || r === 'teamlead') return 'Team Leader';
  if (r === 'admin') return 'Admin';
  return null;
}

function isHiddenBoardRole(role?: string): boolean {
  const normalized = String(role || '').trim().toLowerCase().replace(/[_-]/g, ' ');
  return normalized.includes('admin') || normalized.includes('pending');
}

function toBoardStatus(
  attendanceStatus?: string,
  checkIn?: string | null
): 'Available' | 'Unavailable' | 'Leave' | 'Not Set' {
  const s = String(attendanceStatus || '').trim().toUpperCase();
  if (s === 'PRESENT') return 'Available';
  if (s === 'ABSENT' && !checkIn) return 'Not Set';
  if (s === 'ABSENT') return 'Unavailable';
  if (s === 'LEAVE') return 'Leave';
  return 'Not Set';
}

/** First and last calendar day of the previous month (local), as `YYYY-MM-DD` for date inputs. */
function getLastMonthDateRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: toDateInputValue(firstOfPrevMonth),
    end: toDateInputValue(lastOfPrevMonth),
  };
}

function getRollingDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

function AdminAvailabilityBoard() {
  const { currentUser, users } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
    }))
  );
  const [roleFilter, setRoleFilter] = useState<BoardRoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<BoardStatusFilter>('all');
  const [summaryUsers, setSummaryUsers] = useState<AttendanceSummaryUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    const roleParam =
      roleFilter === 'all'
        ? 'ALL'
        : roleFilter === 'Employee'
          ? 'employee'
          : roleFilter === 'Team Leader'
            ? 'team_leader'
            : 'HR';
    const attendanceParam =
      statusFilter === 'all'
        ? 'ALL'
        : statusFilter === 'Available'
          ? 'PRESENT'
          : statusFilter === 'Unavailable'
            ? 'ABSENT'
            : 'LEAVE';

    const loadLeaves = async () => {
      setLoading(true);
      try {
        const summary = await fetchAttendanceSummaryApi({
          role: roleParam as 'ALL' | 'employee' | 'HR' | 'team_leader',
          attendance: attendanceParam as 'ALL' | 'PRESENT' | 'ABSENT' | 'LEAVE',
        });
        if (!cancelled) setSummaryUsers(summary.users);
      } catch {
        if (!cancelled) setSummaryUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLeaves();
    const id = window.setInterval(() => {
      void loadLeaves();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentUser?.id, roleFilter, statusFilter]);

  const boardRows = useMemo(() => {
    return summaryUsers
      .filter((u) => !isHiddenBoardRole(u.role))
      .map((u) => {
      const role = normalizeApiRole(u.role) || 'Employee';
      const boardStatus = toBoardStatus(u.attendance_status, u.check_in);
      const enriched =
        users.find((x) => String(x.id) === String(u.id)) ||
        users.find((x) => String(x.employeeCode || '').trim() === String(u.gdc_id || '').trim()) ||
        users.find((x) => x.name?.trim().toLowerCase() === String(u.name || '').trim().toLowerCase()) ||
        null;
      return {
        id: String(u.id),
        name: u.name || enriched?.name || '—',
        role,
        team: enriched?.team || '—',
        gdcId: u.gdc_id || enriched?.employeeCode || '—',
        status: boardStatus,
        liveStatus: String(u.live_status || ''),
      };
    });
  }, [summaryUsers, users]);

  const getStatusAccent = (status?: string) => {
    switch (status) {
      case 'Available':
        return {
          dot: 'bg-emerald-500',
          ring: 'ring-emerald-500/25',
          border: 'border-emerald-200',
          cardBg: 'bg-gradient-to-br from-white to-emerald-50/40',
          stripe: 'bg-emerald-500',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
          iconWrap: 'bg-emerald-100 text-emerald-600',
        };
      case 'Unavailable':
        return {
          dot: 'bg-amber-400',
          ring: 'ring-amber-400/30',
          border: 'border-amber-200',
          cardBg: 'bg-gradient-to-br from-white to-amber-50/50',
          stripe: 'bg-amber-400',
          badge: 'bg-amber-100 text-amber-900 border-amber-200/80',
          iconWrap: 'bg-amber-100 text-amber-700',
        };
      case 'Leave':
        return {
          dot: 'bg-rose-500',
          ring: 'ring-rose-500/25',
          border: 'border-rose-200',
          cardBg: 'bg-gradient-to-br from-white to-rose-50/40',
          stripe: 'bg-rose-500',
          badge: 'bg-rose-100 text-rose-800 border-rose-200/80',
          iconWrap: 'bg-rose-100 text-rose-600',
        };
      default:
        return {
          dot: 'bg-slate-300',
          ring: 'ring-slate-300/25',
          border: 'border-slate-200',
          cardBg: 'bg-white',
          stripe: 'bg-slate-300',
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          iconWrap: 'bg-slate-100 text-slate-500',
        };
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Available': return UserCheck;
      case 'Leave': return AlertCircle;
      default: return Clock;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Team Status Board</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-slate-500">
          <Filter className="w-4 h-4 shrink-0" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Role</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                roleFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {BOARD_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                  roleFilter === r
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'Team Leader' ? 'TL' : r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {(
              [
                { value: 'Available' as const, label: 'Present' },
                { value: 'Unavailable' as const, label: 'Absent' },
                { value: 'Leave' as const, label: 'Leave' },
              ] as const
            ).map(({ value: s, label }) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border ${
                  statusFilter === s
                    ? s === 'Available'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : s === 'Unavailable'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                        : 'bg-rose-600 text-white border-rose-600 shadow-md'
                    : s === 'Available'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : s === 'Unavailable'
                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-500 py-12 text-sm">Loading team status…</p>
      ) : boardRows.length === 0 ? (
        <p className="text-center text-slate-500 py-12 text-sm">No people match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boardRows.map((user) => {
            const isClockedIn = ['WORKING', 'BREAK'].includes(user.liveStatus.toUpperCase());
            const effectiveStatus = user.status;
            const Icon = getStatusIcon(effectiveStatus);
            const accent = getStatusAccent(effectiveStatus);

            return (
              <div
                key={user.id}
                className={`relative rounded-2xl p-6 border shadow-sm hover:shadow-lg transition-all overflow-hidden ${accent.cardBg} ${accent.border}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent.stripe}`} aria-hidden />
                <div className="flex items-start gap-4 pl-1">
                  <div className="relative shrink-0">
                    <div
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm ${accent.iconWrap}`}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] border-white ring-2 ${accent.dot} ${accent.ring}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-base leading-snug truncate">{user.name}</h3>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                      {user.team}
                      <span className="text-slate-300 mx-1.5">·</span>
                      {user.role === 'Team Leader' ? 'TL' : user.role}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5 pl-1">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 backdrop-blur-sm px-3.5 py-3 border border-slate-100/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Status</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border shrink-0 ${accent.badge}`}>
                      {displayStatusLabel(effectiveStatus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 backdrop-blur-sm px-3.5 py-3 border border-slate-100/80">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4 shrink-0 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Activity</span>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                        isClockedIn
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200/80'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isClockedIn ? 'Working' : 'Away'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmployeeAvailabilityView() {
  const { currentUser, updateUser, timesheets, Leave } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      updateUser: s.updateUser,
      timesheets: s.timesheets,
      Leave: s.Leave,
    }))
  );
  const [status, setStatus] = useState(currentUser?.status || 'Available');
  const [now, setNow] = useState(new Date());
  const [logPreset, setLogPreset] = useState<AttendanceLogPreset>('30d');
  const [logRangeStart, setLogRangeStart] = useState(() => getRollingDateRange(30).start);
  const [logRangeEnd, setLogRangeEnd] = useState(() => getRollingDateRange(30).end);

  useEffect(() => {
    if (!currentUser) return;
    setStatus(currentUser.status || 'Available');
  }, [currentUser]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeEntry = useMemo(() => {
    if (!currentUser) return null;
    return timesheets.find((t) => t.userId === currentUser.id && !t.clockOut) || null;
  }, [currentUser, timesheets]);

  const activeBreak = useMemo(() => {
    if (!activeEntry?.breaks?.length) return null;
    const last = activeEntry.breaks[activeEntry.breaks.length - 1];
    return last && !last.endTime ? last : null;
  }, [activeEntry]);

  const attendanceDays = useMemo(() => {
    if (!currentUser) {
      return [] as { date: Date; entry?: any }[];
    }
    const userTimesheets = timesheets
      .filter((t) => t.userId === currentUser.id)
      .sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
    if (userTimesheets.length === 0) {
      // Do not render historical absent rows before the user's first actual check-in.
      return [] as { date: Date; entry?: any }[];
    }

    let start = fromDateInputValue(logRangeStart);
    let end = fromDateInputValue(logRangeEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (start > end) {
      const t = start.getTime();
      start = new Date(end);
      end = new Date(t);
    }
    const maxSpan = 90 * 86400000;
    if (end.getTime() - start.getTime() > maxSpan) {
      start = new Date(end.getTime() - maxSpan);
    }

    const firstCheckInDate = new Date(userTimesheets[0].clockIn);
    const firstCheckInDayStart = new Date(
      firstCheckInDate.getFullYear(),
      firstCheckInDate.getMonth(),
      firstCheckInDate.getDate()
    );
    if (firstCheckInDayStart > end) {
      return [] as { date: Date; entry?: any }[];
    }
    if (firstCheckInDayStart > start) {
      start = firstCheckInDayStart;
    }

    const sameYMD = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const days: { date: Date; entry?: any }[] = [];
    const cursor = new Date(end);
    while (cursor >= start) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const entry = userTimesheets.find((t) => sameYMD(new Date(t.clockIn), d));
      days.push({ date: d, entry });
      cursor.setDate(cursor.getDate() - 1);
    }
    return days;
  }, [currentUser, timesheets, logRangeStart, logRangeEnd]);

  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const computeRunningHours = (entry: any) => {
    if (!entry?.clockIn) return null;
    const clockInMs = new Date(entry.clockIn).getTime();
    const effectiveNowMs = activeBreak ? new Date(activeBreak.startTime).getTime() : now.getTime();
    if (!Number.isFinite(clockInMs) || !Number.isFinite(effectiveNowMs)) return null;

    const completedBreakMs = (entry.breaks || [])
      .filter((b: any) => !!b?.startTime && !!b?.endTime)
      .reduce((acc: number, b: any) => {
        return acc + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
      }, 0);

    const diffMs = Math.max(0, effectiveNowMs - clockInMs - completedBreakMs);
    return diffMs / 3600000;
  };

  const logSummary = useMemo(() => {
    if (!currentUser) {
      return {
        daysListed: 0,
        absentDays: 0,
        presentDays: 0,
        LeaveDays: 0,
        totalHours: 0,
      };
    }
    let absentDays = 0;
    let presentDays = 0;
    let LeaveDays = 0;
    let totalH = 0;
    for (const { date, entry } of attendanceDays) {
      const isLeaveDay = isApprovedLeaveLeaveDay(date, currentUser.id, Leave);
      if (isLeaveDay) {
        LeaveDays += 1;
        if (entry) {
          const isToday =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
          const isActiveToday = isToday && !!activeEntry && !entry.clockOut;
          if (isActiveToday && activeEntry) {
            const h = computeRunningHours(activeEntry);
            if (typeof h === 'number') totalH += h;
          } else if (typeof entry.totalHours === 'number') {
            totalH += entry.totalHours;
          }
        }
        continue;
      }
      if (entry) {
        presentDays += 1;
        const isToday =
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate();
        const isActiveToday = isToday && !!activeEntry && !entry.clockOut;
        if (isActiveToday && activeEntry) {
          const h = computeRunningHours(activeEntry);
          if (typeof h === 'number') totalH += h;
        } else if (typeof entry.totalHours === 'number') {
          totalH += entry.totalHours;
        }
      } else {
        absentDays += 1;
      }
    }
    return {
      daysListed: attendanceDays.length,
      absentDays,
      presentDays,
      LeaveDays,
      totalHours: totalH,
    };
  }, [attendanceDays, now, activeEntry, activeBreak, Leave, currentUser]);

  const applyPresetRange = (preset: AttendanceLogPreset) => {
    setLogPreset(preset);
    const { start, end } =
      preset === 'today'
        ? getRollingDateRange(1)
        : preset === '7d'
          ? getRollingDateRange(7)
          : preset === '30d'
            ? getRollingDateRange(30)
            : getLastMonthDateRange();
    setLogRangeStart(start);
    setLogRangeEnd(end);
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">Sign in to manage availability.</div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-14">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-6 sm:px-6">
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My availability</h1>
          </div>
          <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-800">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500 shrink-0" />
          Current status
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                { value: 'Available' as const, label: 'Present' },
                { value: 'Unavailable' as const, label: 'Absent' },
                { value: 'Leave' as const, label: 'Leave' },
              ] as const
            ).map(({ value: s, label }) => {
            const active =
              s === 'Available'
                ? 'ring-2 ring-emerald-500/40 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-md shadow-emerald-100/50'
                : s === 'Unavailable'
                  ? 'ring-2 ring-amber-400/50 border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-md shadow-amber-100/50'
                  : 'ring-2 ring-rose-500/35 border-rose-300 bg-gradient-to-br from-rose-50 to-white shadow-md shadow-rose-100/50';
            const idle =
              s === 'Available'
                ? 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-emerald-50/60 hover:border-emerald-200'
                : s === 'Unavailable'
                  ? 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-amber-50/60 hover:border-amber-200'
                  : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-rose-50/60 hover:border-rose-200';
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                  updateUser(currentUser.id, { status: s as 'Available' | 'Unavailable' | 'Leave' });
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 px-4 py-5 transition-all ${
                  status === s ? `${active} text-slate-900` : idle
                }`}
              >
                <span className="text-xs font-black uppercase tracking-widest">{label}</span>
              </button>
            );
          })}
        </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-500 shrink-0" />
                Attendance log
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPresetRange('today')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                  logPreset === 'today'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/80'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPresetRange('7d')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                  logPreset === '7d'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/80'
                }`}
              >
                7 days
              </button>
              <button
                type="button"
                onClick={() => applyPresetRange('30d')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                  logPreset === '30d'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/80'
                }`}
              >
                1 month
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-yellow-300 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-800">Absent</div>
              <div className="text-xl font-bold text-yellow-950 tabular-nums">{logSummary.absentDays}</div>
              <div className="text-[9px] text-yellow-700/90 mt-1 leading-snug">No check-in</div>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Present</div>
              <div className="text-xl font-bold text-emerald-800 tabular-nums">{logSummary.presentDays}</div>
              <div className="text-[9px] text-emerald-600/90 mt-1 leading-snug">Has attendance</div>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-700">Leave</div>
              <div className="text-xl font-bold text-rose-800 tabular-nums">{logSummary.LeaveDays}</div>
              <div className="text-[9px] text-rose-600/90 mt-1 leading-snug">Approved Leave leave</div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm col-span-2 lg:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Total hours</div>
              <div className="text-xl font-bold text-indigo-700 tabular-nums">{logSummary.totalHours.toFixed(2)}</div>
              <div className="text-[9px] text-indigo-500/90 mt-1 leading-snug">In selected range</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {attendanceDays.map(({ date, entry }) => {
            const isToday =
              date.getFullYear() === now.getFullYear() &&
              date.getMonth() === now.getMonth() &&
              date.getDate() === now.getDate();

            const LeaveDay = isApprovedLeaveLeaveDay(date, currentUser.id, Leave);
            const isActiveToday = isToday && !!activeEntry && !!entry && !entry.clockOut;
            const statusLabel = LeaveDay
              ? 'Leave'
              : entry
                ? entry.clockOut
                  ? 'Present'
                  : isActiveToday && activeBreak
                    ? 'On break'
                    : 'Active'
                : 'Absent';

            const badge =
              statusLabel === 'Leave'
                ? 'bg-rose-100 text-rose-900 border-rose-200'
                : statusLabel === 'Present'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                  : statusLabel === 'On break' || statusLabel === 'Active'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : 'bg-white text-yellow-800 border-yellow-400';

            const breaksCount = entry?.breaks?.length || 0;
            const totalHours =
              isActiveToday && activeEntry
                ? computeRunningHours(activeEntry)?.toFixed(2) ?? '—'
                : typeof entry?.totalHours === 'number'
                  ? entry.totalHours.toFixed(2)
                  : '—';

            const rowAccent =
              statusLabel === 'Leave'
                ? 'border-l-rose-500'
                : statusLabel === 'Present'
                  ? 'border-l-emerald-500'
                  : statusLabel === 'Absent'
                    ? 'border-l-yellow-500'
                    : 'border-l-amber-500';

            return (
              <div
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                className={`group rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:shadow-md transition-all overflow-hidden border-l-4 ${rowAccent}`}
              >
                <div className="p-4 flex flex-col lg:flex-row lg:items-stretch gap-4">
                  <div className="flex items-center gap-4 lg:w-44 shrink-0">
                    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm">
                      <span className="text-[10px] font-bold uppercase text-slate-400 leading-none">
                        {date.toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-black text-slate-900 tabular-nums leading-tight mt-0.5">
                        {date.getDate()}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">{date.toLocaleDateString([], { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badge}`}
                      >
                        {statusLabel}
                      </span>
                      {isToday && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-indigo-600">Today</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-w-0">
                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">In</div>
                      <div className="font-bold text-slate-900 tabular-nums">{fmtTime(entry?.clockIn)}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Out</div>
                      <div className="font-bold text-slate-900 tabular-nums">{fmtTime(entry?.clockOut)}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Breaks</div>
                      <div className="font-bold text-slate-900 tabular-nums">{breaksCount}</div>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Hours</div>
                      <div className="font-bold text-indigo-950 tabular-nums">{totalHours}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </section>
      </div>
    </div>
  );
}
