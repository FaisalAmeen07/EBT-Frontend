'use client';

import { useStore, useShallow, isTeamLeaderCreatedTask, type Task } from '@/lib/store';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Play,
  Square,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  TrendingUp,
  UserCheck,
  Timer,
  Users,
  Activity,
  Target,
  BarChart3,
  Shield,
  Coffee,
  LayoutDashboard,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { performClockInWithPolicies } from '@/lib/clockInPolicies';
import { toast } from '@/lib/toast';
import {
  clockInBlockedBeforeOfficeStart,
  clockInBlockedAfterLateWindow,
  companyShiftTimesFromApi,
  dateKeyLocal,
  dayAttendanceStatus,
  filterUsersForAttendanceViewer,
  clockInLateWarningAfterGrace,
  getOfficeEndForDay,
  getOfficeStartForDay,
  isClockInLate,
} from '@/lib/attendanceRules';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays, isWithinInterval } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { isLimitReachedSessionStatus, MAX_SHIFT_WORK_MS } from '@/lib/attendanceLimits';
import { fetchPendingUsersCountApi, fetchWorkforceCountApi } from '@/services/admin.service';
import { fetchAttendanceSummaryApi, getCurrentShiftApi, getShiftStatusApi } from '@/services/attendance.service';
import { fetchLeaveRequestsApi } from '@/services/attendance-requests.service';
import { fetchOverdueTasksCountApi, fetchPendingTasksCountApi } from '@/services/tasks.service';

const DASHBOARD_POLL_MS = 35_000;

function availabilityStatusLabel(status: string | undefined): string {
  if (status === 'Available') return 'Present';
  if (status === 'Unavailable') return 'Absent';
  return status || 'N/A';
}

function formatShiftTime(value?: string | null): string {
  if (!value) return '—';
  const [rawHour = '0', rawMinute = '0'] = String(value).split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return '—';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function isApprovedLeaveOnDate(
  date: Date,
  userId: string,
  leaves: { userId: string; status: string; startDate: string; endDate: string }[]
): boolean {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return leaves.some((l) => {
    if (String(l.userId) !== userId) return false;
    const status = String(l.status || '').trim().toUpperCase();
    if (status !== 'APPROVED') return false;
    const start = new Date(String(l.startDate || '').slice(0, 10));
    const end = new Date(String(l.endDate || '').slice(0, 10));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return day >= startDay && day <= endDay;
  });
}

// ─── ROUTER ────────────────────────────────────────────────────────
export default function Dashboard() {
  const currentUser = useStore((s) => s.currentUser);

  if (currentUser?.role === 'Admin') return <AdminDashboard />;
  if (currentUser?.role === 'HR') return <HRDashboard />;
  if (currentUser?.role === 'Team Leader') return <TeamLeaderDashboard />;
  return <UserDashboard />;
}

const STAT_ICON_DARK: Record<string, string> = {
  'bg-blue-50': 'dark:bg-blue-950/55',
  'bg-emerald-50': 'dark:bg-emerald-950/55',
  'bg-amber-50': 'dark:bg-amber-950/55',
  'bg-indigo-50': 'dark:bg-indigo-950/55',
  'bg-rose-50': 'dark:bg-rose-950/55',
  'bg-purple-50': 'dark:bg-purple-950/55',
  'bg-violet-50': 'dark:bg-violet-950/55',
  'bg-cyan-50': 'dark:bg-cyan-950/55',
};

// ─── SHARED COMPONENTS ─────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  className = '',
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  className?: string;
  href?: string;
}) {
  const cardClassName = `group relative overflow-hidden min-h-[8rem] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)] dark:hover:border-slate-600 ${href ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2' : ''} ${className}`;
  const cardBody = (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-slate-200/90 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-slate-600/80" />
      <div className="mb-3 flex items-center justify-between">
        <div className={cn(`${bg} ${color} flex h-10 w-10 items-center justify-center rounded-lg`, STAT_ICON_DARK[bg])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-600" />
      </div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-[1.65rem] leading-none font-black tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName} aria-label={`${label} details`}>
        {cardBody}
      </Link>
    );
  }

  return <div className={cardClassName}>{cardBody}</div>;
}

function TimerWidget() {
  const {
    currentUser,
    timesheets,
    Leave,
    clockOut,
    endBreak,
    adhocShiftsEnabled,
    attendanceDayOverrides,
    companyShiftTimes,
    setCompanyShiftTimes,
    geoFencingEnabled,
    geoFencingUseGlobalRadius,
    geoFencingGlobalRadiusMiles,
    geoFencingSiteRadiusMiles,
    geoFencingOfficeLat,
    geoFencingOfficeLng,
  } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      timesheets: s.timesheets,
      Leave: s.Leave,
      clockOut: s.clockOut,
      endBreak: s.endBreak,
      adhocShiftsEnabled: s.adhocShiftsEnabled,
      attendanceDayOverrides: s.attendanceDayOverrides,
      companyShiftTimes: s.companyShiftTimes,
      setCompanyShiftTimes: s.setCompanyShiftTimes,
      geoFencingEnabled: s.geoFencingEnabled,
      geoFencingUseGlobalRadius: s.geoFencingUseGlobalRadius,
      geoFencingGlobalRadiusMiles: s.geoFencingGlobalRadiusMiles,
      geoFencingSiteRadiusMiles: s.geoFencingSiteRadiusMiles,
      geoFencingOfficeLat: s.geoFencingOfficeLat,
      geoFencingOfficeLng: s.geoFencingOfficeLng,
    }))
  );
  const activeTimesheet = timesheets.find(t => t.userId === currentUser?.id && !t.clockOut);
  const isClockedIn = !!activeTimesheet;
  const [now, setNow] = useState(new Date());
  const [clockBusy, setClockBusy] = useState(false);
  const [shiftEnabledApi, setShiftEnabledApi] = useState<boolean | null>(null);
  const [shiftStartApi, setShiftStartApi] = useState<string | null>(null);
  const [shiftEndApi, setShiftEndApi] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void useStore.getState().hydrateAttendanceControlSettingsFromApi();
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadShift = async () => {
      try {
        const [status, current] = await Promise.all([getShiftStatusApi(), getCurrentShiftApi()]);
        if (cancelled) return;
        setShiftEnabledApi(Boolean(status.is_enabled));
        setShiftStartApi(current.shift_start ?? null);
        setShiftEndApi(current.shift_end ?? null);
        setCompanyShiftTimes(companyShiftTimesFromApi(current.shift_start, current.shift_end));
      } catch {
        // Keep timer usable with local fallback values.
      }
    };
    void loadShift();
    const id = window.setInterval(() => {
      void loadShift();
    }, DASHBOARD_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadShift();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const shiftEnabled = shiftEnabledApi ?? adhocShiftsEnabled;
  const clockInBlocked = !shiftEnabled && currentUser?.role !== 'Admin';
  const leaveBlocked =
    !!currentUser &&
    currentUser.role !== 'Admin' &&
    isApprovedLeaveOnDate(now, String(currentUser.id), Leave);
  const beforeOfficeStartMsg =
    currentUser?.role !== 'Admin'
      ? clockInBlockedBeforeOfficeStart(now, attendanceDayOverrides, companyShiftTimes)
      : null;
  const afterLateWindowMsg =
    currentUser?.role !== 'Admin'
      ? clockInBlockedAfterLateWindow(now, attendanceDayOverrides, companyShiftTimes)
      : null;
  const lateWarningMsg =
    currentUser?.role !== 'Admin'
      ? clockInLateWarningAfterGrace(now, attendanceDayOverrides, companyShiftTimes)
      : null;
  const clockInDisabled = leaveBlocked || clockInBlocked || !!beforeOfficeStartMsg;
  const geoRadiusMiles = (() => {
    if (!geoFencingEnabled) return 0;
    if (geoFencingUseGlobalRadius) return Math.max(0, geoFencingGlobalRadiusMiles);
    const site = currentUser?.workSite?.trim();
    if (site && geoFencingSiteRadiusMiles[site] != null) return Math.max(0, geoFencingSiteRadiusMiles[site]!);
    return Math.max(0, geoFencingGlobalRadiusMiles);
  })();
  const geoNeedsOfficeAnchor =
    geoFencingEnabled && geoRadiusMiles > 0 && (geoFencingOfficeLat == null || geoFencingOfficeLng == null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeBreak = (() => {
    if (!activeTimesheet?.breaks?.length) return null;
    const last = activeTimesheet.breaks[activeTimesheet.breaks.length - 1];
    if (!last) return null;
    return last.endTime ? null : last;
  })();

  // Calculate elapsed time (pause during active break) and detect shift work-limit.
  const { elapsed, reachedWorkLimit } = useMemo(() => {
    if (!activeTimesheet) {
      return { elapsed: null as string | null, reachedWorkLimit: false };
    }

    const clockInMs = new Date(activeTimesheet.clockIn).getTime();
    const effectiveNowMs = activeBreak ? new Date(activeBreak.startTime).getTime() : now.getTime();

    const completedBreakMs = (activeTimesheet.breaks || [])
      .filter((b) => !!b?.startTime && !!b?.endTime)
      .reduce((acc, b) => {
        if (!b.startTime || !b.endTime) return acc;
        return acc + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
      }, 0);
    const completedBreakMsFromApi = Math.max(0, Number(activeTimesheet.breakDurationMinutes || 0)) * 60 * 1000;

    const diffMsRaw = Math.max(0, effectiveNowMs - clockInMs - Math.max(completedBreakMs, completedBreakMsFromApi));
    const reachedLimit =
      diffMsRaw >= MAX_SHIFT_WORK_MS || isLimitReachedSessionStatus(activeTimesheet.sessionStatus);
    const diffMs = Math.min(MAX_SHIFT_WORK_MS, diffMsRaw);
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return {
      elapsed: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      reachedWorkLimit: reachedLimit,
    };
  }, [activeTimesheet, now, activeBreak]);

  const limitReachedFromApi = isLimitReachedSessionStatus(activeTimesheet?.sessionStatus);
  const isPaused = !!activeBreak && !limitReachedFromApi;
  /** Max work duration: timer frozen; only clock out (not break out). */
  const timerFrozen = isPaused || reachedWorkLimit || limitReachedFromApi;
  const showBreakOutAction = !!activeBreak && !reachedWorkLimit && !limitReachedFromApi;
  const hasAnyBreak = (activeTimesheet?.breaks?.length || 0) > 0;
  const lineColorClass = !isClockedIn
    ? 'bg-blue-600'
    : reachedWorkLimit || limitReachedFromApi
      ? 'bg-amber-500'
      : activeBreak
        ? 'bg-rose-600'
        : hasAnyBreak
          ? 'bg-blue-600'
          : 'bg-amber-500';

  const roleLabel = currentUser?.department ?? currentUser?.role ?? '—';
  const shiftStartLabel = formatShiftTime(shiftStartApi);
  const shiftEndLabel = formatShiftTime(shiftEndApi);
  /** TL / Employee: show assigned team where the card used to say only “Regular”. */
  const teamHeadline =
    (currentUser?.role === 'Team Leader' || currentUser?.role === 'Employee') &&
    currentUser?.team?.trim()
      ? currentUser.team.trim()
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
          Hello, <span className="font-black">{currentUser?.name?.split(' ')[0] ?? 'there'}</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
          {format(now, 'eee MMMM d yyyy')} • {format(now, 'HH:mm')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 md:p-7">
          <div className="flex items-start gap-4">
            <div className={`w-1.5 self-stretch rounded-full ${lineColorClass}`} />
            <div className="min-w-0">
              {teamHeadline ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Your team</p>
                  <p className="mt-1 text-base font-bold leading-snug text-blue-600">{teamHeadline}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Regular shift
                  </p>
                </>
              ) : (
                <p className="text-xs font-black uppercase tracking-widest text-blue-600">Regular</p>
              )}

              <div className="mt-4 grid gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400">
                    <UserCheck className="h-4 w-4" />
                  </span>
                  {roleLabel}
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400">
                    <Timer className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{shiftStartLabel}</p>
                  <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{shiftEndLabel}</p>
                </div>
              </div>

              {elapsed && (
                <div
                  className={`mt-5 inline-flex items-center gap-3 rounded-2xl border px-4 py-2 ${
                    timerFrozen ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
                  }`}
                >
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      timerFrozen ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {reachedWorkLimit || limitReachedFromApi
                      ? 'Work Limit Reached — Clock Out'
                      : isPaused
                        ? 'On Break (Paused)'
                        : 'Working'}
                  </span>
                  <span
                    className={`text-sm font-mono font-black ${timerFrozen ? 'text-amber-800' : 'text-emerald-800'}`}
                  >
                    {elapsed}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center gap-2 md:items-end">
            {clockInBlocked && (
              <p className="max-w-[14rem] text-center text-[11px] font-semibold text-rose-600 md:text-right">
                Clock-in is turned off by your administrator.
              </p>
            )}
            {leaveBlocked && (
              <p className="max-w-[14rem] text-center text-[11px] font-semibold text-amber-800 md:text-right">
                You are currently on leave today.
              </p>
            )}
            {!clockInBlocked && !leaveBlocked && beforeOfficeStartMsg && (
              <p className="max-w-[14rem] text-center text-[11px] font-semibold text-amber-800 md:text-right">
                {beforeOfficeStartMsg}
              </p>
            )}
            {geoNeedsOfficeAnchor && !clockInDisabled && (
              <p className="max-w-[14rem] text-center text-[11px] font-medium text-amber-700 md:text-right">
                Geo-fencing is on but the office anchor is not set — clock-in may be blocked until an admin completes
                Time control settings.
              </p>
            )}
            {!isClockedIn ? (
              <button
                type="button"
                aria-disabled={leaveBlocked ? 'true' : undefined}
                disabled={!leaveBlocked && (clockInDisabled || clockBusy)}
                onClick={async () => {
                  if (leaveBlocked) {
                    toast('You are currently on leave today.', 'error');
                    return;
                  }
                  if (afterLateWindowMsg) {
                    toast('You are late. Clock-in is closed for today.', 'error');
                    return;
                  }
                  setClockBusy(true);
                  try {
                    const res = await performClockInWithPolicies();
                    if (!res.ok) toast(res.error, 'error');
                    else if (lateWarningMsg) toast(lateWarningMsg, 'error');
                  } catch (error) {
                    toast(error instanceof Error ? error.message : 'Unable to clock in.', 'error');
                  } finally {
                    setClockBusy(false);
                  }
                }}
                className={`group relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full text-white shadow-none ring-0 focus:outline-none ${
                  leaveBlocked
                    ? 'cursor-not-allowed bg-slate-400'
                    : 'bg-blue-600 transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400'
                }`}
                title={leaveBlocked ? 'You are currently on leave today.' : clockInDisabled ? 'Clock-in disabled' : 'Clock in'}
              >
                <div className="relative z-10 flex flex-col items-center">
                  <Play className="h-8 w-8 ml-0.5" fill="currentColor" />
                  <span className="mt-1 text-[10px] font-black uppercase tracking-widest">
                    {clockBusy ? '…' : 'Clock In'}
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex flex-row gap-4">
                {showBreakOutAction ? (
                  <button
                    onClick={async () => {
                      setClockBusy(true);
                      try {
                        await endBreak();
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to end break.', 'error');
                      } finally {
                        setClockBusy(false);
                      }
                    }}
                    disabled={clockBusy}
                    className="group relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full bg-rose-600 text-white shadow-none ring-0 transition-all hover:bg-rose-500 active:scale-95 focus:outline-none"
                    title="Break out"
                  >
                    <div className="relative z-10 flex flex-col items-center">
                      <Coffee className="h-7 w-7" fill="currentColor" />
                      <span className="mt-1 text-[10px] font-black uppercase tracking-widest">Break Out</span>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setClockBusy(true);
                      try {
                        await clockOut();
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to clock out.', 'error');
                      } finally {
                        setClockBusy(false);
                      }
                    }}
                    disabled={clockBusy}
                    className="group relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full bg-blue-600 text-white shadow-none ring-0 transition-all hover:bg-blue-500 active:scale-95 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
                    title="Clock out"
                  >
                    <div className="relative z-10 flex flex-col items-center">
                      <Square className="h-7 w-7" fill="currentColor" />
                      <span className="mt-1 text-[10px] font-black uppercase tracking-widest">
                        {clockBusy ? '…' : 'Clock Out'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyChart() {
  const { currentUser, timesheets, attendanceDayOverrides, companyShiftTimes } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      timesheets: s.timesheets,
      attendanceDayOverrides: s.attendanceDayOverrides,
      companyShiftTimes: s.companyShiftTimes,
    }))
  );
  const now = new Date();
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');

  const rangeStart = useMemo(() => {
    if (range === '90d') return subDays(now, 89);
    if (range === '30d') return subDays(now, 29);
    return startOfWeek(now, { weekStartsOn: 1 });
  }, [now, range]);

  const rangeEnd = useMemo(() => {
    if (range === '7d') return endOfWeek(now, { weekStartsOn: 1 });
    return now;
  }, [now, range]);

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const stats = days.map(day => {
    const dayEntries = timesheets.filter(
      t => t.userId === currentUser?.id && isSameDay(new Date(t.clockIn), day)
    );
    const hours = dayEntries.reduce((acc, t) => acc + (t.totalHours || 0), 0);
    const isLate = dayEntries.some((t) =>
      isClockInLate(t.clockIn, attendanceDayOverrides, companyShiftTimes)
    );
    return { day, label: range === '7d' ? format(day, 'EEE') : format(day, 'd MMM'), hours, isLate };
  });

  const totalHours = useMemo(() => {
    return timesheets
      .filter(t => t.userId === currentUser?.id)
      .filter(t => isWithinInterval(new Date(t.clockIn), { start: rangeStart, end: rangeEnd }))
      .reduce((acc, t) => acc + (t.totalHours || 0), 0);
  }, [timesheets, currentUser, rangeStart, rangeEnd]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Performance
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
            Total: {totalHours.toFixed(1)} hours ({range === '7d' ? 'Weekly' : range === '30d' ? '30 Days' : '90 Days'})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setRange('7d')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                range === '7d' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setRange('30d')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                range === '30d' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setRange('90d')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                range === '90d' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              90 Days
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end h-48 px-4">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center gap-3 h-full justify-end group cursor-help">
            <div
              className={`relative flex flex-col justify-end h-full ${range === '7d' ? 'w-10 sm:w-12' : 'w-2.5 sm:w-3'}`}
            >
              <div
                className={`w-full rounded-t-xl transition-all duration-500 shadow-sm ${stat.isLate ? 'bg-gradient-to-t from-rose-500 to-rose-400' : 'bg-gradient-to-t from-blue-600 to-blue-400'}`}
                style={{ height: `${Math.min((stat.hours / 8) * 100, 100)}%`, minHeight: stat.hours > 0 ? '10%' : '0' }}
              >
                {stat.hours > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                    {stat.hours.toFixed(1)}h
                  </div>
                )}
              </div>
            </div>
            {range === '7d' ? (
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${isSameDay(stat.day, now) ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}
              >
                {stat.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const statusBadgeClass = (status: string) => {
    if (status === 'Pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (status === 'In Progress') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (status === 'Submitted') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (status === 'Review') return 'bg-violet-50 text-violet-700 border-violet-100';
    if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    return 'bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800';
  };

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/80 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 font-medium">All caught up! No active tasks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map(task => (
            <Link
              key={task.id}
              href={`/project-manager?taskId=${encodeURIComponent(task.id)}`}
              className="block bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 hover:shadow-md transition-all group border-l-4 border-l-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight group-hover:text-blue-600 transition-colors">{task.title}</h3>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                  <Clock size={14} className="mr-1" />
                  Due {format(new Date(task.deadline), 'MMM d')}
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${statusBadgeClass(task.status)}`}>
                  {task.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 1. ADMIN DASHBOARD ────────────────────────────────────────────
function AdminDashboard() {
  const {
    currentUser,
    users,
    timesheets,
    tasks,
    Leave,
    adhocShiftsEnabled,
    geoFencingEnabled,
    geoFencingUseGlobalRadius,
    geoFencingGlobalRadiusMiles,
    geoFencingSiteRadiusMiles,
    geoFencingOfficeLat,
    geoFencingOfficeLng,
    attendanceDayOverrides,
    companyShiftTimes,
  } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      timesheets: s.timesheets,
      tasks: s.tasks,
      Leave: s.Leave,
      adhocShiftsEnabled: s.adhocShiftsEnabled,
      geoFencingEnabled: s.geoFencingEnabled,
      geoFencingUseGlobalRadius: s.geoFencingUseGlobalRadius,
      geoFencingGlobalRadiusMiles: s.geoFencingGlobalRadiusMiles,
      geoFencingSiteRadiusMiles: s.geoFencingSiteRadiusMiles,
      geoFencingOfficeLat: s.geoFencingOfficeLat,
      geoFencingOfficeLng: s.geoFencingOfficeLng,
      attendanceDayOverrides: s.attendanceDayOverrides,
      companyShiftTimes: s.companyShiftTimes,
    }))
  );

  const [now, setNow] = useState(() => new Date());
  const [apiWorkforceCount, setApiWorkforceCount] = useState<number | null>(null);
  const [apiPendingUsersCount, setApiPendingUsersCount] = useState<number | null>(null);
  const [apiActiveEmployees, setApiActiveEmployees] = useState<number | null>(null);
  const [apiPendingLeaveCount, setApiPendingLeaveCount] = useState<number | null>(null);
  const [apiPendingTasksCount, setApiPendingTasksCount] = useState<number | null>(null);
  const [apiOverdueTasksCount, setApiOverdueTasksCount] = useState<number | null>(null);
  const [apiShiftEnabled, setApiShiftEnabled] = useState<boolean | null>(null);
  const [apiShiftStart, setApiShiftStart] = useState<string | null>(null);
  const [apiShiftEnd, setApiShiftEnd] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const localActiveEmployees = timesheets.filter(t => !t.clockOut).length;
  const localPendingLeave = Leave.filter(l => l.status === 'Pending').length;
  const localPendingTasksCount = tasks.filter(
    t => !isTeamLeaderCreatedTask(t, users) && t.status === 'Pending'
  ).length;
  const localOverdueTasksCount = tasks.filter(
    t =>
      !isTeamLeaderCreatedTask(t, users) && t.status !== 'Approved' && new Date(t.deadline) < now
  ).length;
  const localPendingUsers = users.filter(u => u.role === 'Pending User').length;

  const workforceUsers = useMemo(
    () => users.filter(u => u.role !== 'Pending User'),
    [users]
  );
  const localWorkforceCount = workforceUsers.length;
  const activeEmployees = apiActiveEmployees ?? localActiveEmployees;
  const pendingLeave = apiPendingLeaveCount ?? localPendingLeave;
  const pendingTasksCount = apiPendingTasksCount ?? localPendingTasksCount;
  const overdueTasksCount = apiOverdueTasksCount ?? localOverdueTasksCount;
  const workforceCount = apiWorkforceCount ?? localWorkforceCount;
  const pendingUsers = apiPendingUsersCount ?? localPendingUsers;
  const pendingOperationsCount = pendingLeave + pendingTasksCount + pendingUsers;

  useEffect(() => {
    if (!currentUser?.id || currentUser.role !== 'Admin') return;
    let cancelled = false;
    const loadCounts = async () => {
      const results = await Promise.allSettled([
        fetchWorkforceCountApi(),
        fetchPendingUsersCountApi(),
        fetchAttendanceSummaryApi(),
        fetchLeaveRequestsApi(),
        fetchPendingTasksCountApi(),
        fetchOverdueTasksCountApi(),
        getCurrentShiftApi(),
        getShiftStatusApi(),
      ]);
      if (cancelled) return;

      const workforceRes = results[0];
      if (workforceRes.status === 'fulfilled') {
        setApiWorkforceCount(Number(workforceRes.value?.workforce ?? 0));
      }

      const pendingUsersRes = results[1];
      if (pendingUsersRes.status === 'fulfilled') {
        setApiPendingUsersCount(Number(pendingUsersRes.value?.pendingUsers ?? 0));
      }

      const attendanceSummaryRes = results[2];
      if (attendanceSummaryRes.status === 'fulfilled') {
        const activeCount =
          Number(attendanceSummaryRes.value?.working ?? 0) +
          Number(attendanceSummaryRes.value?.break ?? 0);
        setApiActiveEmployees(activeCount);
      }

      const pendingLeaveRes = results[3];
      if (pendingLeaveRes.status === 'fulfilled') {
        const count = pendingLeaveRes.value.filter((l) => l.status === 'Pending').length;
        setApiPendingLeaveCount(count);
      }

      const pendingTasksRes = results[4];
      if (pendingTasksRes.status === 'fulfilled') {
        setApiPendingTasksCount(Number(pendingTasksRes.value ?? 0));
      }

      const overdueTasksRes = results[5];
      if (overdueTasksRes.status === 'fulfilled') {
        setApiOverdueTasksCount(Number(overdueTasksRes.value ?? 0));
      }

      const currentShiftRes = results[6];
      if (currentShiftRes.status === 'fulfilled') {
        setApiShiftStart(currentShiftRes.value.shift_start ?? null);
        setApiShiftEnd(currentShiftRes.value.shift_end ?? null);
        useStore
          .getState()
          .setCompanyShiftTimes(
            companyShiftTimesFromApi(currentShiftRes.value.shift_start, currentShiftRes.value.shift_end)
          );
      }

      const shiftStatusRes = results[7];
      if (shiftStatusRes.status === 'fulfilled') {
        setApiShiftEnabled(Boolean(shiftStatusRes.value.is_enabled));
      }
    };
    void loadCounts();
    const timerId = window.setInterval(() => {
      void loadCounts();
    }, DASHBOARD_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadCounts();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUser?.id, currentUser?.role]);

  const attendanceScopeUsers = useMemo(
    () => filterUsersForAttendanceViewer(currentUser, users),
    [currentUser, users]
  );
  const attendanceScopeCount = Math.max(1, attendanceScopeUsers.length);

  const todayStatusCounts = useMemo(() => {
    const counts = { on_time: 0, late: 0, absent: 0, leave: 0 };
    for (const u of attendanceScopeUsers) {
      if (isApprovedLeaveOnDate(now, String(u.id), Leave)) {
        counts.leave += 1;
        continue;
      }
      const s = dayAttendanceStatus(u.id, now, timesheets, now, attendanceDayOverrides, companyShiftTimes);
      if (s === 'on_time' || s === 'late' || s === 'absent') counts[s] += 1;
      else counts.absent += 1;
    }
    return counts;
  }, [attendanceScopeUsers, now, timesheets, attendanceDayOverrides, companyShiftTimes, Leave]);

  const effectiveGeoRadiusMiles = useMemo(() => {
    if (!geoFencingEnabled) return 0;
    if (geoFencingUseGlobalRadius) return Math.max(0, geoFencingGlobalRadiusMiles);
    const vals = Object.values(geoFencingSiteRadiusMiles);
    if (vals.length === 0) return Math.max(0, geoFencingGlobalRadiusMiles);
    return Math.max(0, ...vals.map(v => (v != null ? v : 0)));
  }, [
    geoFencingEnabled,
    geoFencingUseGlobalRadius,
    geoFencingGlobalRadiusMiles,
    geoFencingSiteRadiusMiles,
  ]);

  const geoAnchorMissing =
    geoFencingEnabled &&
    effectiveGeoRadiusMiles > 0 &&
    (geoFencingOfficeLat == null || geoFencingOfficeLng == null);

  const officeStartParts = getOfficeStartForDay(now, attendanceDayOverrides, companyShiftTimes);
  const officeStartToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    officeStartParts.hour,
    officeStartParts.minute,
    0,
    0
  );
  const officeEndParts = getOfficeEndForDay(now, attendanceDayOverrides, companyShiftTimes);
  const officeEndToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    officeEndParts.hour,
    officeEndParts.minute,
    0,
    0
  );
  const hasOverrideToday = !!attendanceDayOverrides[dateKeyLocal(now)];
  const shiftEnabledDisplay = apiShiftEnabled ?? adhocShiftsEnabled;
  const shiftStartDisplay = apiShiftStart ? formatShiftTime(apiShiftStart) : format(officeStartToday, 'h:mm a');
  const shiftEndDisplay = apiShiftEnd ? formatShiftTime(apiShiftEnd) : format(officeEndToday, 'h:mm a');

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/25 ring-4 ring-slate-900/5">
              <LayoutDashboard className="h-7 w-7" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Admin workspace</p>
              <h1 className="text-3xl font-light tracking-tight text-slate-900 dark:text-slate-50">System overview</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {format(now, 'EEEE, MMMM d, yyyy')}
                <span className="mx-2 text-slate-300">·</span>
                <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">{format(now, 'h:mm a')}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Link
              href="/timesheet"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
              Timesheet
            </Link>
            <Link
              href="/request-management"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
              Requests
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800"
            >
              Admin control
              <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Today at a glance</h2>
        <span className="rounded-full border border-slate-200/80 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none">
          Total workforce {workforceCount}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 p-3 shadow-inner shadow-slate-100/70 dark:bg-slate-950 dark:shadow-inner dark:shadow-black/40 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={Users}
            label="Workforce"
            value={workforceCount}
            color="text-blue-500"
            bg="bg-blue-50"
            href="/admin/employees-management"
          />
          <StatCard icon={Activity} label="Active now" value={activeEmployees} color="text-emerald-500" bg="bg-emerald-50" href="/timesheet" />
          <StatCard icon={Calendar} label="Pending Leave" value={pendingLeave} color="text-amber-500" bg="bg-amber-50" href="/request-management?tab=leave" />
          <StatCard icon={Target} label="Pending Tasks" value={pendingTasksCount} color="text-indigo-500" bg="bg-indigo-50" href="/project-manager?status=Pending" />
          <StatCard icon={AlertCircle} label="Overdue tasks" value={overdueTasksCount} color="text-rose-500" bg="bg-rose-50" href="/project-manager" />
          <StatCard icon={Shield} label="Pending approval" value={pendingUsers} color="text-purple-500" bg="bg-purple-50" href="/admin/employees-management?role=Pending%20User" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Operations</h2>
        <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-sky-100/80 bg-gradient-to-br from-sky-50/40 via-white to-white p-6 shadow-sm ring-1 ring-sky-100/50 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-700/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-200/50">
                  <Calendar className="h-4 w-4" aria-hidden />
                </span>
                Today&apos;s attendance
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Rolled up from company rules · {attendanceScopeUsers.length} staff in scope
              </p>
            </div>
            <Link
              href="/timesheet"
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-sky-600/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-800 transition hover:bg-sky-600/15 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/70"
            >
              View timesheet
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                { key: 'on_time' as const, label: 'Present', className: 'border-emerald-100 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100' },
                { key: 'late' as const, label: 'Late', className: 'border-amber-100 bg-amber-50/60 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100' },
                { key: 'absent' as const, label: 'Absent', className: 'border-rose-100 bg-rose-50/60 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-100' },
                { key: 'leave' as const, label: 'Leave', className: 'border-indigo-100 bg-indigo-50/80 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-100' },
              ] as const
            ).map(({ key, label, className }) => (
              <div
                key={key}
                className={cn('rounded-xl border px-3 py-3 text-center shadow-sm', className)}
              >
                <p className="text-2xl font-black tabular-nums tracking-tight">{todayStatusCounts[key]}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
                <p className="mt-1 text-[10px] font-semibold tabular-nums opacity-70">
                  {Math.round((todayStatusCounts[key] / attendanceScopeCount) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-violet-100/80 bg-gradient-to-br from-violet-50/40 via-white to-white p-6 shadow-sm ring-1 ring-violet-100/50 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-700/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200/50">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                </span>
                Pending workload
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Requests and approvals that need admin action.</p>
            </div>
            <span className="inline-flex self-start rounded-full border border-violet-200/80 bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/80 dark:text-violet-200">
              Total {pendingOperationsCount}
            </span>
          </div>
          <div className="mt-5 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white/90 px-4 py-3 dark:bg-slate-950">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pending Leave</span>
              <span className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">{pendingLeave}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white/90 px-4 py-3 dark:bg-slate-950">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pending Tasks</span>
              <span className="text-lg font-black tabular-nums text-indigo-600 dark:text-indigo-400">{pendingTasksCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white/90 px-4 py-3 dark:bg-slate-950">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pending Approval</span>
              <span className="text-lg font-black tabular-nums text-purple-600 dark:text-purple-400">{pendingUsers}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/request-management"
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-800 transition hover:bg-violet-600/15 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/60"
            >
              Open requests
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href="/admin/employees-management"
              className="inline-flex items-center gap-1 rounded-lg border border-transparent bg-slate-900/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open approvals
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Policy configuration</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800/80">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-200/50">
                  <Timer className="h-4 w-4" aria-hidden />
                </span>
                Time policies
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">What staff see when they clock in. Edit in Time control.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Shifts</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                    shiftEnabledDisplay
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  )}
                >
                  {shiftEnabledDisplay ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm sm:col-span-1 md:col-span-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Geo
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                      geoFencingEnabled ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {geoFencingEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                {geoFencingEnabled && geoAnchorMissing ? (
                  <p className="text-[11px] font-medium leading-snug text-amber-800">
                    Office anchor missing — clock-in may be blocked.
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Office shift</span>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Start</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{shiftStartDisplay}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">End</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{shiftEndDisplay}</p>
                  </div>
                </div>
                {apiShiftStart || apiShiftEnd ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">Live from shift API</p>
                ) : hasOverrideToday ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">Company override today</p>
                ) : (
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Default or scheduled</p>
                )}
              </div>
            </div>
          </div>
            <Link
              href="/admin/time-control"
              className="inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800 lg:self-start"
            >
              Time control
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

// ─── 2. HR DASHBOARD ───────────────────────────────────────────────
function HRDashboard() {
  const { currentUser, users, timesheets, tasks, Leave } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      timesheets: s.timesheets,
      tasks: s.tasks,
      Leave: s.Leave,
    }))
  );

  const myTeam = currentUser?.team;
  const teamMembers = users.filter(u => u.team === myTeam && u.role !== 'Pending User');
  const teamTasks = tasks.filter(
    t =>
      !isTeamLeaderCreatedTask(t, users) && teamMembers.some(m => m.id === t.assignedTo)
  );
  const completedTasks = teamTasks.filter(t => t.status === 'Approved').length;
  const pendingLeave = Leave.filter(l => l.status === 'Pending').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <TimerWidget />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard icon={Users} label="Team Members" value={teamMembers.length} color="text-blue-500" bg="bg-blue-50" />
        <StatCard icon={Target} label="Team Tasks" value={teamTasks.length} color="text-indigo-500" bg="bg-indigo-50" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedTasks} color="text-emerald-500" bg="bg-emerald-50" />
        <StatCard icon={Calendar} label="Pending Leave" value={pendingLeave} color="text-amber-500" bg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <WeeklyChart />

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Team Task Progress
            </h2>
            <TaskList tasks={teamTasks.filter(t => t.status !== 'Approved')} />
          </div>
        </div>

        {/* Team Status */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            {myTeam} Team
          </h2>
          <div className="space-y-4">
            {teamMembers.map(member => {
              const isActive = timesheets.some(t => t.userId === member.id && !t.clockOut);
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-sm">{member.name.charAt(0)}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{member.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{member.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    member.status === 'Available' ? 'text-emerald-600 bg-emerald-50' :
                    member.status === 'Leave' ? 'text-rose-600 bg-rose-50' :
                    'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/80'
                  }`}>{availabilityStatusLabel(member.status)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. TEAM LEADER DASHBOARD ──────────────────────────────────────
function TeamLeaderDashboard() {
  const { currentUser, users, timesheets, tasks } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      timesheets: s.timesheets,
      tasks: s.tasks,
    }))
  );
  const now = new Date();

  const myTeam = currentUser?.team;
  const teamEmployees = users.filter(u => u.team === myTeam && u.role === 'Employee');
  const teamTasks = tasks.filter(t => teamEmployees.some(m => m.id === t.assignedTo));
  const myTasks = tasks.filter(t => t.assignedTo === currentUser?.id);

  const isOverdue = (task: Task) => task.status !== 'Approved' && new Date(task.deadline) < now;
  const countByStatus = (taskList: Task[], status: Task['status']) =>
    taskList.filter(t => t.status === status).length;

  const myPendingCount = countByStatus(myTasks, 'Pending');
  const myInProgressCount = countByStatus(myTasks, 'In Progress');
  const myReviewCount = countByStatus(myTasks, 'Review');
  const mySubmittedCount = countByStatus(myTasks, 'Submitted');
  const myCompletedCount = countByStatus(myTasks, 'Approved');
  const myOverdueCount = myTasks.filter(isOverdue).length;

  const teamPendingCount = countByStatus(teamTasks, 'Pending');
  const teamInProgressCount = countByStatus(teamTasks, 'In Progress');
  const teamReviewCount = countByStatus(teamTasks, 'Review');
  const teamSubmittedCount = countByStatus(teamTasks, 'Submitted');
  const teamOverdueCount = teamTasks.filter(isOverdue).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <TimerWidget />

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-indigo-500" />
          My Dashboard
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-5">
          <StatCard icon={Clock} label="Pending" value={myPendingCount} color="text-amber-500" bg="bg-amber-50" href="/project-manager?status=Pending" />
          <StatCard icon={BarChart3} label="In Progress" value={myInProgressCount} color="text-indigo-500" bg="bg-indigo-50" href="/project-manager?status=In%20Progress" />
          <StatCard icon={Activity} label="Review" value={myReviewCount} color="text-violet-500" bg="bg-violet-50" href="/project-manager?status=Review" />
          <StatCard icon={Target} label="Submitted" value={mySubmittedCount} color="text-cyan-600" bg="bg-cyan-50" href="/project-manager?status=Submitted" />
          <StatCard icon={CheckCircle2} label="Completed" value={myCompletedCount} color="text-emerald-500" bg="bg-emerald-50" href="/project-manager?status=Approved" />
          <StatCard icon={AlertCircle} label="Overdue" value={myOverdueCount} color="text-rose-500" bg="bg-rose-50" href="/project-manager" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <WeeklyChart />

        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Team Assignments
              </h2>
              <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
                {teamTasks.length} Total
              </div>
            </div>
            <TaskList tasks={teamTasks.filter(t => t.status !== 'Approved')} />
          </div>
        </div>

        {/* Team Performance */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Member Performance
            </h2>
            <div className="space-y-5">
              {teamEmployees.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">No employees on your team yet.</p>
              ) : (
                teamEmployees.map(member => {
                  const memberTasks = tasks.filter(t => t.assignedTo === member.id);
                  const done = memberTasks.filter(t => t.status === 'Approved').length;
                  const total = memberTasks.length;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  const isActive = timesheets.some(t => t.userId === member.id && !t.clockOut);

                  return (
                    <div key={member.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">{member.name.charAt(0)}</div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{member.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">{done}/{total}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-none dark:from-blue-900 dark:to-indigo-950">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-white/10 dark:bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Team Status</h3>
              <p className="text-blue-100 text-xs leading-relaxed mb-4 font-medium">
                {teamEmployees.filter(m => timesheets.some(t => t.userId === m.id && !t.clockOut)).length} of {teamEmployees.length} employees currently working.
              </p>
              <div className="flex gap-2">
                {teamEmployees.map(m => {
                  const isActive = timesheets.some(t => t.userId === m.id && !t.clockOut);
                  return (
                    <div key={m.id} title={m.name} className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border-2 ${isActive ? 'bg-white/20 dark:bg-white/10 border-white/40 text-white' : 'bg-white/5 dark:bg-white/5 border-white/10 text-white/30'}`}>
                      {m.name.charAt(0)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 4. USER (EMPLOYEE) DASHBOARD ──────────────────────────────────
function UserDashboard() {
  const { currentUser, timesheets, tasks, Leave } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      timesheets: s.timesheets,
      tasks: s.tasks,
      Leave: s.Leave,
    }))
  );
  const [now, setNow] = useState(new Date());

  const allUserTasks = tasks.filter(t => t.assignedTo === currentUser?.id);
  const userTasks = allUserTasks.filter(t => t.status !== 'Approved');
  const myPendingCount = allUserTasks.filter(t => t.status === 'Pending').length;
  const myInProgressCount = allUserTasks.filter(t => t.status === 'In Progress').length;
  const myReviewCount = allUserTasks.filter(t => t.status === 'Review').length;
  const mySubmittedCount = allUserTasks.filter(t => t.status === 'Submitted').length;
  const myCompletedCount = allUserTasks.filter(t => t.status === 'Approved').length;
  const myOverdueCount = allUserTasks.filter(
    (t) => t.status !== 'Approved' && new Date(t.deadline) < now
  ).length;

  const recentActivity = useMemo(() => {
    const activities = [
      ...timesheets.filter(t => t.userId === currentUser?.id).map(t => ({
        type: 'Clock', title: t.clockOut ? 'Clocked Out' : 'Clocked In', time: t.clockOut || t.clockIn, icon: Clock, color: t.clockOut ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-500'
      })),
      ...Leave.filter(l => l.userId === currentUser?.id).map(l => ({
        type: 'Leave', title: `Leave Request: ${l.type}`, time: l.createdAt, icon: Calendar, color: 'text-blue-500'
      })),
      ...tasks.filter(t => t.assignedTo === currentUser?.id && t.status === 'Approved').map(t => ({
        type: 'Task', title: `Approved Task: ${t.title}`, time: now.toISOString(), icon: CheckCircle2, color: 'text-indigo-500'
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 3);
    return activities;
  }, [timesheets, Leave, tasks, currentUser, now]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <TimerWidget />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-5">
        <StatCard icon={Clock} label="Pending" value={myPendingCount} color="text-amber-500" bg="bg-amber-50" href="/project-manager?status=Pending" />
        <StatCard icon={BarChart3} label="In Progress" value={myInProgressCount} color="text-indigo-500" bg="bg-indigo-50" href="/project-manager?status=In%20Progress" />
        <StatCard icon={Activity} label="Review" value={myReviewCount} color="text-violet-500" bg="bg-violet-50" href="/project-manager?status=Review" />
        <StatCard icon={Target} label="Submitted" value={mySubmittedCount} color="text-cyan-600" bg="bg-cyan-50" href="/project-manager?status=Submitted" />
        <StatCard icon={CheckCircle2} label="Completed" value={myCompletedCount} color="text-emerald-500" bg="bg-emerald-50" href="/project-manager?status=Approved" />
        <StatCard icon={AlertCircle} label="Overdue" value={myOverdueCount} color="text-rose-500" bg="bg-rose-50" href="/project-manager" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <WeeklyChart />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                My Active Tasks
              </h2>
            </div>
            <TaskList tasks={userTasks} />
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
              <Timer className="w-5 h-5 text-emerald-500" />
              Recent Activity
            </h2>
            <div className="space-y-8">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== recentActivity.length - 1 && (
                    <div className="absolute left-6 top-10 bottom-[-20px] w-0.5 bg-slate-50 dark:bg-slate-900/80" />
                  )}
                  <div className={`w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900/80 flex items-center justify-center flex-shrink-0 border border-slate-100 dark:border-slate-800 shadow-sm ${activity.color}`}>
                    <activity.icon className="w-5 h-5" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1">{activity.title}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                      {format(new Date(activity.time), 'MMM d • HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-10 font-medium">No recent activity detected.</p>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-none dark:from-blue-900 dark:to-indigo-950">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-white/10 dark:bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Need a break?</h3>
              <p className="text-blue-100 text-xs leading-relaxed mb-6 font-medium">
                Remember to take regular breaks to stay productive and healthy. Your wellness is our priority.
              </p>
              <Link
                href="/my-requests?tab=leave"
                className="flex w-full items-center justify-center rounded-2xl bg-white py-3.5 text-xs font-black uppercase tracking-widest text-blue-600 shadow-sm transition-all active:scale-95 dark:bg-slate-900 dark:text-indigo-300 dark:shadow-none"
              >
                Request Leave
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
