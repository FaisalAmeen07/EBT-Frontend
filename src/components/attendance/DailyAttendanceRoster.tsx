'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Filter, LayoutGrid, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchAttendance30DaysApi,
  fetchAttendance7DaysApi,
  fetchTodayAttendanceApi,
} from '@/services/attendance.service';
import { toast } from '@/lib/toast';
import { useStore } from '@/lib/store';

type AttendancePeriod = 'today' | '7d' | '30d';

type TodayRow = {
  id: number;
  role?: string | null;
  gdc_id?: string | null;
  name: string;
  attendance_status: string;
  live_status: string | null;
  check_in?: string | null;
  check_out?: string | null;
};

type SevenRow = {
  id: number;
  name: string;
  role: string;
  gdc_id: string | null;
  attendance: { date: string; day: string; attendance_status: string }[];
};

type ThirtyRow = {
  id: number;
  name: string;
  role: string;
  gdc_id: string | null;
  on_time: number;
  late: number;
  absent: number;
  leave_days: number;
};

function StatusCell({ status }: { status: string }) {
  const s = status.toUpperCase();
  const c =
    s === 'NA'
      ? { label: '-', className: 'border-slate-200 bg-white text-slate-400' }
      : s === 'LATE'
        ? { label: 'L', className: 'border-amber-200 bg-amber-50 text-amber-900' }
      : s === 'PRESENT'
      ? { label: 'P', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
      : s === 'LEAVE'
        ? { label: 'L', className: 'border-rose-200 bg-rose-50 text-rose-800' }
        : { label: 'A', className: 'border-slate-200 bg-slate-100 text-slate-700' };
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-bold tabular-nums',
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

/**
 * Admin / HR / TL: attendance overview with Today, last 7 days (grid), or last 30 days (summary counts).
 */
export function DailyAttendanceRoster({
  externalRefreshSignal = 0,
}: {
  /** Increment from parent on an interval so overview refetches without a manual action. */
  externalRefreshSignal?: number;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const timesheets = useStore((s) => s.timesheets);
  const [now, setNow] = useState(() => new Date());
  const [period, setPeriod] = useState<AttendancePeriod>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [grid7, setGrid7] = useState<SevenRow[]>([]);
  const [summary30, setSummary30] = useState<ThirtyRow[]>([]);
  const [summary30Period, setSummary30Period] = useState<{ start: string; end: string } | null>(null);

  const roleByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(String(u.id), u.role);
    }
    return map;
  }, [users]);

  const displayIdByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      const resolved = u.employeeCode?.trim() || u.id;
      map.set(String(u.id), resolved);
    }
    return map;
  }, [users]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const roleParam =
          roleFilter === 'all'
            ? 'ALL'
            : roleFilter === 'Employee'
              ? 'employee'
              : roleFilter === 'Team Leader'
                ? 'team_leader'
                : 'HR';
        if (period === 'today') {
          const rows = await fetchTodayAttendanceApi();
          if (!cancelled) setTodayRows((rows as TodayRow[]) ?? []);
        } else if (period === '7d') {
          const rows = await fetchAttendance7DaysApi({ role: roleParam, search: searchQuery.trim() || undefined });
          if (!cancelled) setGrid7(rows as SevenRow[]);
        } else {
          const data = await fetchAttendance30DaysApi({ role: roleParam, search: searchQuery.trim() || undefined });
          if (!cancelled) {
            setSummary30((data.users as ThirtyRow[]) ?? []);
            setSummary30Period({ start: data.period_start, end: data.period_end });
          }
        }
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : 'Unable to load attendance.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, period, roleFilter, searchQuery, externalRefreshSignal]);

  if (!currentUser || !['Admin', 'HR', 'Team Leader'].includes(currentUser.role)) {
    return null;
  }

  const isHiddenRole = (role?: string | null) => {
    const normalized = String(role || '').trim().toLowerCase().replace(/[_-]/g, ' ');
    return normalized.includes('admin') || normalized.includes('pending');
  };
  const matchesSelectedRole = (role?: string | null) => {
    if (roleFilter === 'all') return true;
    const selected = roleFilter.toLowerCase().replace(/[_-]/g, ' ');
    const normalized = String(role || '').trim().toLowerCase().replace(/[_-]/g, ' ');
    return normalized === selected;
  };
  const firstClockInByUser = (() => {
    const map = new Map<string, Date>();
    for (const t of timesheets) {
      const userId = String(t.userId);
      const d = new Date(t.clockIn);
      if (!Number.isFinite(d.getTime())) continue;
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const prev = map.get(userId);
      if (!prev || day.getTime() < prev.getTime()) map.set(userId, day);
    }
    return map;
  })();

  const lateByUserDay = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const t of timesheets) {
      const d = new Date(t.clockIn);
      if (!Number.isFinite(d.getTime())) continue;
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const key = `${String(t.userId)}|${dayKey}`;
      const prev = map.get(key);
      if (prev === true) continue;
      map.set(key, Boolean(t.lateMark));
    }
    return map;
  }, [timesheets]);

  const parseDateOnly = (value: string): Date | null => {
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const countDaysInclusive = (start: Date, end: Date): number => {
    const ms = end.getTime() - start.getTime();
    return ms < 0 ? 0 : Math.floor(ms / 86400000) + 1;
  };

  const visibleTodayRows = todayRows
    .filter((row) => {
      const effectiveRole = row.role || roleByUserId.get(String(row.id));
      if (isHiddenRole(effectiveRole)) return false;
      if (!matchesSelectedRole(effectiveRole)) return false;
      const isApprovedLeaveToday = String(row.attendance_status || '').trim().toUpperCase() === 'LEAVE';
      return firstClockInByUser.has(String(row.id)) || isApprovedLeaveToday;
    })
    .map((row) => {
      const baseStatus = String(row.attendance_status || '').trim().toUpperCase();
      const inDate = row.check_in ? new Date(row.check_in) : null;
      if (!inDate || !Number.isFinite(inDate.getTime()) || baseStatus !== 'PRESENT') return row;
      const dayKey = `${inDate.getFullYear()}-${String(inDate.getMonth() + 1).padStart(2, '0')}-${String(inDate.getDate()).padStart(2, '0')}`;
      const isLateDay = lateByUserDay.get(`${String(row.id)}|${dayKey}`) === true;
      if (!isLateDay) return row;
      return { ...row, attendance_status: 'LATE' };
    });

  const visibleGrid7 = grid7
    .filter((row) => !isHiddenRole(row.role))
    .filter((row) => {
      const hasLeaveInRange = row.attendance.some(
        (entry) => String(entry.attendance_status || '').trim().toUpperCase() === 'LEAVE'
      );
      return firstClockInByUser.has(String(row.id)) || hasLeaveInRange;
    })
    .map((row) => {
      const firstClockIn = firstClockInByUser.get(String(row.id));
      if (!firstClockIn) {
        return {
          ...row,
          attendance: row.attendance.map((entry) => {
            const status = String(entry.attendance_status || '').trim().toUpperCase();
            if (status === 'LEAVE') return entry;
            return { ...entry, attendance_status: 'NA' };
          }),
        };
      }
      return {
        ...row,
        attendance: row.attendance.map((entry) => {
          const day = parseDateOnly(entry.date);
          if (!day) return entry;
          if (day.getTime() < firstClockIn.getTime()) {
            return { ...entry, attendance_status: 'NA' };
          }
          const baseStatus = String(entry.attendance_status || '').trim().toUpperCase();
          if (baseStatus !== 'PRESENT') return entry;
          const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const isLateDay = lateByUserDay.get(`${String(row.id)}|${dayKey}`) === true;
          return isLateDay ? { ...entry, attendance_status: 'LATE' } : entry;
        }),
      };
    });

  const visibleSummary30 = summary30
    .filter((row) => !isHiddenRole(row.role))
    .filter((row) => firstClockInByUser.has(String(row.id)) || Number(row.leave_days || 0) > 0)
    .map((row) => {
      const firstClockIn = firstClockInByUser.get(String(row.id));
      const periodStart = summary30Period?.start ? parseDateOnly(summary30Period.start) : null;
      if (!firstClockIn || !periodStart || firstClockIn.getTime() <= periodStart.getTime()) return row;
      const beforeDays = countDaysInclusive(periodStart, new Date(firstClockIn.getTime() - 86400000));
      return {
        ...row,
        absent: Math.max(0, row.absent - beforeDays),
      };
    });

  const emptyScopeMessage = 'No data for selected filters.';

  const periodTabs: { id: AttendancePeriod; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
      <div className="relative border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-slate-400" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-slate-900">Attendance overview</h3>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/90 p-1 shadow-inner">
              {periodTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPeriod(t.id)}
                  className={cn(
                    'rounded-lg px-3.5 py-2 text-xs font-bold transition',
                    period === t.id
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="font-medium tabular-nums text-slate-800">{format(now, 'MMM d, yyyy · HH:mm')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mb-2 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:mb-0 sm:w-auto">
            <Filter className="h-4 w-4 text-indigo-500" aria-hidden />
            Filters
          </div>
          {currentUser.role === 'Admin' ? (
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 sm:max-w-[200px]">
              Role
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All roles</option>
                <option value="Employee">Employee</option>
                <option value="HR">HR</option>
                <option value="Team Leader">Team Leader</option>
              </select>
            </label>
          ) : null}
          {currentUser.role === 'HR' ? (
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 sm:max-w-[220px]">
              Role
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">Employees &amp; team leads</option>
                <option value="Employee">Employees only</option>
                <option value="Team Leader">Team leaders only</option>
              </select>
            </label>
          ) : null}
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Unique ID / search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                currentUser.role === 'Team Leader'
                  ? 'Team member — ID, code, or name'
                  : 'ID, code, email, or name'
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Legend</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-800">
              OK
            </span>
            Present
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-900">
              L
            </span>
            Late
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-700">
              A
            </span>
            Absent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-200 bg-rose-50 text-[9px] font-bold text-rose-800">
              L
            </span>
            Leave
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {period === 'today' && (
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Team member</th>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-14 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : visibleTodayRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                visibleTodayRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn('transition-colors hover:bg-slate-50/90', idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {row.role || roleByUserId.get(String(row.id)) || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {row.gdc_id || displayIdByUserId.get(String(row.id)) || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusCell status={row.attendance_status || 'ABSENT'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {period === '7d' && (
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 z-[1] min-w-[160px] bg-white px-5 py-3.5 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.08)]">
                  Team member
                </th>
                <th className="sticky left-[160px] z-[1] min-w-[100px] bg-white px-3 py-3.5 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.08)]">
                  ID
                </th>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={`day-${i}`} className="px-1.5 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400">Day {i + 1}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : visibleGrid7.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                visibleGrid7.map((row, idx) => {
                  const rowBg = idx % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                  return (
                  <tr
                    key={row.id}
                    className={cn(rowBg, 'hover:bg-indigo-50/40')}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-[1] border-r border-slate-100 px-5 py-3 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]',
                        rowBg
                      )}
                    >
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.role}</div>
                    </td>
                    <td
                      className={cn(
                        'sticky left-[160px] z-[1] border-r border-slate-100 px-3 py-3 font-mono text-[11px] text-slate-600 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]',
                        rowBg
                      )}
                    >
                      {row.gdc_id || row.id}
                    </td>
                    {row.attendance.map((st, i) => (
                      <td key={`${row.id}-${st.date}-${i}`} className="px-1.5 py-2.5 text-center align-middle">
                        <div className="flex justify-center">
                          <StatusCell status={st.attendance_status} />
                        </div>
                      </td>
                    ))}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {period === '30d' && (
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Team member</th>
                <th className="px-5 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    <LayoutGrid className="h-3.5 w-3.5 text-emerald-600" />
                    Present
                  </span>
                </th>
                <th className="px-5 py-3.5 text-center">Late</th>
                <th className="px-5 py-3.5 text-center">Absent</th>
                <th className="px-5 py-3.5 text-center">Leave</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : visibleSummary30.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                visibleSummary30.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn('transition-colors hover:bg-slate-50/90', idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.role}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{row.gdc_id || row.id}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-emerald-800">{row.on_time}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-amber-900">{row.late}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-slate-700">{row.absent}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-rose-800">{row.leave_days}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
        <span>
          {period === 'today' && `Today · ${visibleTodayRows.length} shown`}
          {period === '7d' && `7-day grid · ${visibleGrid7.length} shown`}
          {period === '30d' && `30-day summary · ${visibleSummary30.length} shown`}
        </span>
        <span className="hidden max-w-xl sm:inline">
          Late / absent use each day&apos;s office start (default 9:00; Admin can set per day in Time control).
        </span>
      </div>
    </div>
  );
}
