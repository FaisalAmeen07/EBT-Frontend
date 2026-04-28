'use client';

import Link from 'next/link';
import { GlobalAttendanceLog } from '@/components/attendance/GlobalAttendanceLog';
import { ManualTimesheetLog } from '@/components/attendance/ManualTimesheetLog';
import { DailyAttendanceRoster } from '@/components/attendance/DailyAttendanceRoster';
import { useTimesheetTab } from '@/features/timesheet/useTimesheetTab';
import { PersonalStats, TimesheetTable } from '@/features/timesheet/widgets';
import { useStore, useShallow } from '@/lib/store';
import { employeeDisplayId } from '@/lib/attendanceSite';
import { isClockInLate } from '@/lib/attendanceRules';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import {
  Clock,
  TrendingUp,
  AlertCircle,
  Calendar,
  ArrowRight,
  Plus,
  Timer,
  Hash,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';

// ─── PERSONAL ATTENDANCE (Employee + TL “My attendance” tab) ───
function EmployeeTimesheetView() {
  const { timesheets, currentUser, attendanceDayOverrides } = useStore(
    useShallow((s) => ({
      timesheets: s.timesheets,
      currentUser: s.currentUser,
      attendanceDayOverrides: s.attendanceDayOverrides,
    }))
  );

  const [now, setNow] = useState(() => new Date());
  /** Personal attendance window: today, last 7 days, or last 30 days. */
  const [attendanceWindow, setAttendanceWindow] = useState<'today' | '7d' | '30d'>('7d');

  useEffect(() => {
    // Update running totals for active (not yet clocked-out) entries.
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const userTimesheets = timesheets
    .filter(t => t.userId === currentUser?.id)
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  const { rangeStart, rangeTimesheets, rangeLabelShort } = useMemo(() => {
    if (attendanceWindow === 'today') {
      const list = userTimesheets.filter((t) => isSameDay(new Date(t.clockIn), now));
      return {
        rangeStart: startOfDay(now),
        rangeTimesheets: list,
        rangeLabelShort: 'Today',
      };
    }
    const n = attendanceWindow === '7d' ? 7 : 30;
    const start = startOfDay(subDays(now, n - 1));
    const startMs = start.getTime();
    const endMs = now.getTime();
    const list = userTimesheets.filter((t) => {
      const ms = new Date(t.clockIn).getTime();
      return ms >= startMs && ms <= endMs;
    });
    return {
      rangeStart: start,
      rangeTimesheets: list,
      rangeLabelShort: `Last ${n} days`,
    };
  }, [userTimesheets, now, attendanceWindow]);

  const getActiveBreak = (entry: any) => {
    if (!entry?.breaks?.length) return null;
    const last = entry.breaks[entry.breaks.length - 1];
    if (!last) return null;
    return last.endTime ? null : last;
  };

  const computedHoursForEntry = (entry: any) => {
    // Stored `totalHours` exists only after clock-out.
    if (typeof entry.totalHours === 'number' && entry.clockOut) return entry.totalHours;
    if (!entry.clockOut) {
      const activeBreak = getActiveBreak(entry);
      // If currently on break, "running" time stops at break start.
      const effectiveNowMs = activeBreak ? new Date(activeBreak.startTime).getTime() : now.getTime();
      const clockInMs = new Date(entry.clockIn).getTime();

      let hours = (effectiveNowMs - clockInMs) / (1000 * 60 * 60);
      hours = Math.max(0, hours);

      // Deduct completed breaks only.
      const breaks = Array.isArray(entry.breaks) ? entry.breaks : [];
      for (const b of breaks) {
        if (b?.startTime && b?.endTime) {
          hours -= (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
        }
      }

      return Math.max(0, hours);
    }
    return 0;
  };

  const computedOvertimeForEntry = (entry: any) => {
    if (typeof entry.overtime === 'number' && entry.clockOut) return entry.overtime;
    const hours = computedHoursForEntry(entry);
    return Math.max(0, hours - 8);
  };

  const totals = useMemo(() => {
    const totalHours = rangeTimesheets.reduce((acc, t) => acc + computedHoursForEntry(t), 0);
    const totalOvertime = rangeTimesheets.reduce((acc, t) => acc + computedOvertimeForEntry(t), 0);
    const totalLateMarks = rangeTimesheets.filter((t) =>
      isClockInLate(t.clockIn, attendanceDayOverrides)
    ).length;
    return { totalHours, totalOvertime, totalLateMarks };
  }, [now, rangeTimesheets, attendanceWindow, attendanceDayOverrides]);

  const totalHoursInRange = totals.totalHours;
  const totalOvertimeInRange = totals.totalOvertime;
  const totalLateMarks = totals.totalLateMarks;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="relative border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 px-6 py-6 sm:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.25)]">
                  <Clock className="h-6 w-6" aria-hidden />
                </span>
                <span>My attendance</span>
              </h1>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50/90 p-1 shadow-inner">
                {(
                  [
                    ['today', 'Today'],
                    ['7d', '7 days'],
                    ['30d', '30 days'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAttendanceWindow(key)}
                    className={cn(
                      'rounded-xl px-3.5 py-2 text-xs font-bold transition sm:px-4',
                      attendanceWindow === key
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="pr-3">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">{rangeLabelShort}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {attendanceWindow === 'today'
                      ? format(now, 'EEEE, MMM d, yyyy')
                      : `${format(rangeStart, 'MMM d')} – ${format(now, 'MMM d, yyyy')}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="relative z-10">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total hours ({rangeLabelShort})
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">{totalHoursInRange.toFixed(1)}</span>
              <span className="text-slate-400 font-medium tracking-tight">hours</span>
            </div>
          </div>
          <TrendingUp className="absolute -bottom-5 -right-5 h-24 w-24 text-blue-50" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="relative z-10">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Overtime ({rangeLabelShort})
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-indigo-700">{totalOvertimeInRange.toFixed(1)}</span>
              <span className="text-slate-400 font-medium tracking-tight">hours</span>
            </div>
          </div>
          <ArrowRight className="absolute -bottom-5 -right-5 h-24 w-24 rotate-[-45deg] text-indigo-50" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="relative z-10">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Late marks ({rangeLabelShort})
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${totalLateMarks > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{totalLateMarks}</span>
              <span className="text-slate-400 font-medium tracking-tight">instances</span>
            </div>
          </div>
          <AlertCircle className="absolute -bottom-5 -right-5 h-24 w-24 text-rose-50" />
        </div>
      </div>

      {/* Clock history — polished table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="relative border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                <Timer className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Clock history</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{rangeLabelShort}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  {rangeTimesheets.length} record{rangeTimesheets.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Link
              href="/my-requests?tab=manual"
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-lg sm:self-center"
            >
              <Plus className="h-4 w-4" />
              Request manual time
            </Link>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 text-white">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider sm:px-8">
                  Date
                </th>
                <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider sm:px-8">
                  Check in / out
                </th>
                <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider sm:px-8">
                  Hours · flags
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider sm:px-8">
                  Unique ID
                </th>
              </tr>
            </thead>
            <tbody>
              {rangeTimesheets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center sm:px-8 sm:py-20">
                    <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-8 py-10">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                        <Clock className="h-7 w-7 text-slate-300" />
                      </div>
                      <p className="text-base font-semibold text-slate-700">No shifts in this window</p>
                      <p className="mt-1 text-sm text-slate-500">
                        No attendance logged for {rangeLabelShort.toLowerCase()}. Clock in from the dashboard or add a manual
                        entry.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rangeTimesheets.map((entry, idx) => {
                  const openShift = !entry.clockOut;
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      <td className="align-top px-5 py-5 sm:px-8">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 text-center ring-1 ring-slate-200/80">
                            <span className="text-[10px] font-bold uppercase leading-none text-slate-400">
                              {format(new Date(entry.clockIn), 'MMM')}
                            </span>
                            <span className="text-lg font-black leading-tight text-slate-800">
                              {format(new Date(entry.clockIn), 'd')}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{format(new Date(entry.clockIn), 'EEEE')}</p>
                            <p className="text-xs text-slate-500">{format(new Date(entry.clockIn), 'yyyy')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5 sm:px-8">
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <div className="inline-flex flex-col items-center rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-2 ring-1 ring-emerald-100/50">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">In</span>
                            <span className="font-mono text-base font-bold tabular-nums text-emerald-900">
                              {format(new Date(entry.clockIn), 'HH:mm')}
                            </span>
                          </div>
                          <div className="hidden h-px w-6 bg-slate-200 sm:block" aria-hidden />
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 sm:hidden" aria-hidden />
                          <div
                            className={`inline-flex flex-col items-center rounded-xl border px-4 py-2 ring-1 ${
                              openShift
                                ? 'border-amber-200/90 bg-amber-50/90 ring-amber-100/80'
                                : 'border-slate-200/90 bg-white ring-slate-100'
                            }`}
                          >
                            <span
                              className={`text-[9px] font-bold uppercase tracking-widest ${
                                openShift ? 'text-amber-700' : 'text-slate-500'
                              }`}
                            >
                              {openShift ? 'Open' : 'Out'}
                            </span>
                            <span
                              className={`font-mono text-base font-bold tabular-nums ${
                                entry.clockOut ? 'text-slate-900' : 'text-amber-800'
                              }`}
                            >
                              {entry.clockOut ? format(new Date(entry.clockOut), 'HH:mm') : '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5 sm:px-8">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                              {computedHoursForEntry(entry).toFixed(2)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">hrs</span>
                          </div>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {isClockInLate(entry.clockIn, attendanceDayOverrides) ? (
                              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                                Late
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                On time
                              </span>
                            )}
                            {computedOvertimeForEntry(entry) > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                OT {computedOvertimeForEntry(entry).toFixed(1)}h
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right align-middle sm:px-8">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-medium text-slate-700">
                          <Hash className="h-3.5 w-3.5 text-slate-400" />
                          {currentUser ? employeeDisplayId(currentUser) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TimesheetPageClient() {
  const currentUser = useStore((s) => s.currentUser);
  const { tabs, activeTab } = useTimesheetTab(currentUser?.role);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!currentUser || currentUser.role === 'Pending User') {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500">Loading…</div>
    );
  }

  const { role } = currentUser;

  let tabBody: ReactNode = null;
  if (role === 'Admin' || role === 'HR') {
    if (activeTab === 'overview') tabBody = <DailyAttendanceRoster />;
    else if (activeTab === 'records') tabBody = <GlobalAttendanceLog />;
    else tabBody = <ManualTimesheetLog />;
  } else if (role === 'Team Leader') {
    if (activeTab === 'my') tabBody = <EmployeeTimesheetView />;
    else if (activeTab === 'overview') tabBody = <DailyAttendanceRoster />;
    else tabBody = <GlobalAttendanceLog />;
  } else {
    tabBody = <EmployeeTimesheetView />;
  }

  return (
    <div className="min-h-full bg-[#f6f8fb] pb-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Route-level tabs (under global navbar) */}
        <div className="pt-6">
          <div className="border-b border-slate-200">
            <nav className="flex flex-wrap gap-8" aria-label="Attendance sections">
              {tabs.map(({ id, label }) => (
                <Link
                  key={id}
                  href={{
                    pathname,
                    query: { ...Object.fromEntries(searchParams.entries()), tab: id },
                  }}
                  className={cn(
                    '-mb-px border-b-[3px] pb-3 text-sm font-semibold transition-colors',
                    activeTab === id
                      ? 'border-indigo-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Single content area (no extra nested white card wrapper) */}
        <div className="pt-6">{tabBody}</div>
      </div>
    </div>
  );
}
