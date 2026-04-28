'use client';

import { useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, format, subDays, startOfDay } from 'date-fns';
import { useStore, useShallow } from '@/lib/store';
import {
  dayAttendanceStatus,
  filterUsersForAttendanceViewer,
  countStatusInRange,
  type DayAttendanceUiStatus,
} from '@/lib/attendanceRules';
import { employeeDisplayId, userMatchesAttendanceSearch } from '@/lib/attendanceSite';
import { CalendarDays, Filter, LayoutGrid, Search, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type AttendancePeriod = 'today' | '7d' | '30d';

function statusBadge(status: DayAttendanceUiStatus) {
  switch (status) {
    case 'on_time':
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
          On time
        </span>
      );
    case 'late':
      return (
        <span className="inline-flex items-center rounded-full border border-rose-200/90 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-800">
          Late
        </span>
      );
    case 'absent':
      return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
          Absent
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
          Pending
        </span>
      );
  }
}

function StatusCell({ status }: { status: DayAttendanceUiStatus }) {
  const cfg: Record<DayAttendanceUiStatus, { label: string; className: string; title: string }> = {
    on_time: {
      label: 'OK',
      title: 'On time',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    late: { label: 'L', title: 'Late', className: 'border-rose-200 bg-rose-50 text-rose-800' },
    absent: { label: 'A', title: 'Absent', className: 'border-slate-200 bg-slate-100 text-slate-700' },
    pending: { label: '…', title: 'Pending', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  };
  const c = cfg[status];
  return (
    <span
      title={c.title}
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
export function DailyAttendanceRoster() {
  const { timesheets, users, currentUser, attendanceDayOverrides } = useStore(
    useShallow((s) => ({
      timesheets: s.timesheets,
      users: s.users,
      currentUser: s.currentUser,
      attendanceDayOverrides: s.attendanceDayOverrides,
    }))
  );
  const [now, setNow] = useState(() => new Date());
  const [period, setPeriod] = useState<AttendancePeriod>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rosterUsers = useMemo(
    () => filterUsersForAttendanceViewer(currentUser, users),
    [currentUser, users]
  );

  const filteredRosterUsers = useMemo(() => {
    let list = rosterUsers;
    const cr = currentUser?.role;
    if (cr === 'Admin') {
      if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    } else if (cr === 'HR') {
      if (roleFilter === 'Employee') list = list.filter((u) => u.role === 'Employee');
      else if (roleFilter === 'Team Leader') list = list.filter((u) => u.role === 'Team Leader');
    }
    list = list.filter((u) => userMatchesAttendanceSearch(u, u.id, searchQuery));
    return list;
  }, [rosterUsers, currentUser?.role, roleFilter, searchQuery]);

  const endDay = useMemo(() => startOfDay(now), [now]);
  const days7 = useMemo(
    () => eachDayOfInterval({ start: subDays(endDay, 6), end: endDay }),
    [endDay]
  );
  const days30 = useMemo(
    () => eachDayOfInterval({ start: subDays(endDay, 29), end: endDay }),
    [endDay]
  );

  const todayRows = useMemo(() => {
    const day = startOfLocalDay(now);
    return filteredRosterUsers.map((u) => ({
      user: u,
      status: dayAttendanceStatus(u.id, day, timesheets, now, attendanceDayOverrides),
      id: employeeDisplayId(u),
    }));
  }, [filteredRosterUsers, timesheets, now, attendanceDayOverrides]);

  const grid7 = useMemo(() => {
    return filteredRosterUsers.map((u) => ({
      user: u,
      id: employeeDisplayId(u),
      cells: days7.map((d) => dayAttendanceStatus(u.id, d, timesheets, now, attendanceDayOverrides)),
    }));
  }, [filteredRosterUsers, days7, timesheets, now, attendanceDayOverrides]);

  const summary30 = useMemo(() => {
    return filteredRosterUsers.map((u) => ({
      user: u,
      id: employeeDisplayId(u),
      counts: countStatusInRange(u.id, days30, timesheets, now, attendanceDayOverrides),
    }));
  }, [filteredRosterUsers, days30, timesheets, now, attendanceDayOverrides]);

  if (!currentUser || !['Admin', 'HR', 'Team Leader'].includes(currentUser.role)) {
    return null;
  }

  const emptyScopeMessage =
    rosterUsers.length > 0 && filteredRosterUsers.length === 0
      ? 'No one matches your filters. Adjust role or clear the search.'
      : 'No people in scope for your role (or no team assigned).';

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
            On time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-200 bg-rose-50 text-[9px] font-bold text-rose-800">
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
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-900">
              …
            </span>
            Pending
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
              {todayRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                todayRows.map(({ user, status, id }, idx) => (
                  <tr
                    key={user.id}
                    className={cn('transition-colors hover:bg-slate-50/90', idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{user.role}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{id}</td>
                    <td className="px-5 py-3.5">{statusBadge(status)}</td>
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
                {days7.map((d) => (
                  <th key={d.toISOString()} className="px-1.5 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400">{format(d, 'EEE')}</span>
                      <span className="tabular-nums text-slate-700">{format(d, 'd')}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid7.length === 0 ? (
                <tr>
                  <td colSpan={2 + days7.length} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                grid7.map(({ user, id, cells }, idx) => {
                  const rowBg = idx % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                  return (
                  <tr
                    key={user.id}
                    className={cn(rowBg, 'hover:bg-indigo-50/40')}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-[1] border-r border-slate-100 px-5 py-3 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]',
                        rowBg
                      )}
                    >
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{user.role}</div>
                    </td>
                    <td
                      className={cn(
                        'sticky left-[160px] z-[1] border-r border-slate-100 px-3 py-3 font-mono text-[11px] text-slate-600 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]',
                        rowBg
                      )}
                    >
                      {id}
                    </td>
                    {cells.map((st, i) => (
                      <td key={i} className="px-1.5 py-2.5 text-center align-middle">
                        <div className="flex justify-center">
                          <StatusCell status={st} />
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
                    On time
                  </span>
                </th>
                <th className="px-5 py-3.5 text-center">Late</th>
                <th className="px-5 py-3.5 text-center">Absent</th>
                <th className="px-5 py-3.5 text-center">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary30.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    {emptyScopeMessage}
                  </td>
                </tr>
              ) : (
                summary30.map(({ user, id, counts }, idx) => (
                  <tr
                    key={user.id}
                    className={cn('transition-colors hover:bg-slate-50/90', idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{user.role}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{id}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-emerald-800">{counts.on_time}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-rose-800">{counts.late}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-slate-700">{counts.absent}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-amber-900">{counts.pending}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
        <span>
          {period === 'today' && `Today · ${todayRows.length} shown`}
          {period === '7d' && `7-day grid · ${grid7.length} shown`}
          {period === '30d' && `30-day summary · ${summary30.length} shown`}
        </span>
        <span className="hidden max-w-xl sm:inline">
          Late / absent use each day&apos;s office start (default 9:00; Admin can set per day in Time control).
        </span>
      </div>
    </div>
  );
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
