'use client';

import { TeamAttendanceStats, TimesheetTable } from '@/features/timesheet/widgets';
import { TaskTotalWorkDisplay } from '@/components/tasks/TaskTotalWorkDisplay';
import { useStore, useShallow } from '@/lib/store';
import type { Task, TaskWorkflowStatus } from '@/lib/store';
import { isTeamLeaderCreatedTask } from '@/lib/store';
import { getLatestSubmitNote } from '@/lib/task-submit-note';
import { getLatestHistoryAtMs, taskHasActivityInLastDays } from '@/lib/taskWorkTimer';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
  Plus,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentType } from 'react';

const TEAM_TIMER_WINDOW_DAYS = 7;
const TIMER_PAGE_SIZE_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_TIMER_PAGE_SIZE = 10;

/** Compact page list with gaps for large page counts. */
function getTimerPaginationPages(current: number, total: number): (number | 'gap')[] {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [];
  const push = (p: number | 'gap') => {
    if (pages.length && pages[pages.length - 1] === p) return;
    pages.push(p);
  };
  push(1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) push('gap');
  for (let p = left; p <= right; p++) push(p);
  if (right < total - 1) push('gap');
  push(total);
  return pages;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  href?: string;
}) {
  const cardClassName = `group relative overflow-hidden min-h-[8rem] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-slate-300/80 dark:hover:border-slate-600 hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)] dark:hover:shadow-black/25 ${
    href ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900' : ''
  }`;
  const cardBody = (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-slate-200/90 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-slate-600/50" />
      <div className="mb-3 flex items-center justify-between">
        <div className={`${bg} ${color} flex h-10 w-10 items-center justify-center rounded-lg`}>
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

function statusChipClass(status: TaskWorkflowStatus): string {
  if (status === 'Pending')
    return 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-800';
  if (status === 'In Progress')
    return 'bg-sky-50 text-sky-900 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-100 dark:border-sky-800';
  if (status === 'Submitted')
    return 'bg-indigo-50 text-indigo-900 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-100 dark:border-indigo-800';
  if (status === 'Review')
    return 'bg-violet-50 text-violet-900 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-100 dark:border-violet-800';
  if (status === 'Approved')
    return 'bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-800';
  return 'bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80';
}

function taskRefLabel(id: string): string {
  return `TASK-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
}

function shortName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
}

export default function TeamDataPage() {
  const router = useRouter();
  const { currentUser, users, timesheets, tasks } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      users: s.users,
      timesheets: s.timesheets,
      tasks: s.tasks,
    }))
  );
  const [timerAssigneeFilterId, setTimerAssigneeFilterId] = useState('');
  const [timerPage, setTimerPage] = useState(1);
  const [timerPageSize, setTimerPageSize] = useState(DEFAULT_TIMER_PAGE_SIZE);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'Team Leader') {
      router.replace('/');
    }
  }, [currentUser, router]);

  const isTl = currentUser?.role === 'Team Leader';
  const myTeam = currentUser?.team;

  /** Same-team employees only (TL “team side” — no TL / HR / other roles in these lists). */
  const teamEmployees = useMemo(() => {
    if (!isTl || !myTeam) return [];
    return users.filter((u) => u.team === myTeam && u.role === 'Employee');
  }, [isTl, myTeam, users]);

  const teamTasks = useMemo(() => {
    if (!isTl || teamEmployees.length === 0) return [];
    const employeeIds = new Set(teamEmployees.map((m) => m.id));
    return tasks.filter((t) => employeeIds.has(t.assignedTo));
  }, [isTl, teamEmployees, tasks]);

  const teamTasksTimerList = useMemo(() => {
    if (!isTl) return [];
    const now = new Date();
    let list = teamTasks.filter((t) => taskHasActivityInLastDays(t, TEAM_TIMER_WINDOW_DAYS, now));
    if (timerAssigneeFilterId) {
      list = list.filter((t) => t.assignedTo === timerAssigneeFilterId);
    }
    return [...list].sort((a, b) => {
      const aLive = a.status === 'In Progress' ? 1 : 0;
      const bLive = b.status === 'In Progress' ? 1 : 0;
      if (bLive !== aLive) return bLive - aLive;
      return getLatestHistoryAtMs(b) - getLatestHistoryAtMs(a);
    });
  }, [isTl, teamTasks, timerAssigneeFilterId]);

  useEffect(() => {
    if (!timerAssigneeFilterId) return;
    if (!teamEmployees.some((e) => e.id === timerAssigneeFilterId)) {
      setTimerAssigneeFilterId('');
    }
  }, [timerAssigneeFilterId, teamEmployees]);

  const timerTotalCount = teamTasksTimerList.length;
  const timerTotalPages = Math.max(1, Math.ceil(timerTotalCount / timerPageSize));

  useEffect(() => {
    setTimerPage(1);
  }, [timerAssigneeFilterId, timerPageSize]);

  useEffect(() => {
    if (timerPage > timerTotalPages) setTimerPage(timerTotalPages);
  }, [timerPage, timerTotalPages]);

  const paginatedTimerTasks = useMemo(() => {
    const start = (timerPage - 1) * timerPageSize;
    return teamTasksTimerList.slice(start, start + timerPageSize);
  }, [teamTasksTimerList, timerPage, timerPageSize]);

  const timerRangeStart = timerTotalCount === 0 ? 0 : (timerPage - 1) * timerPageSize + 1;
  const timerRangeEnd = Math.min(timerPage * timerPageSize, timerTotalCount);
  const timerPaginationPages = useMemo(
    () => getTimerPaginationPages(timerPage, timerTotalPages),
    [timerPage, timerTotalPages]
  );

  if (!currentUser || currentUser.role !== 'Team Leader') {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-slate-500 dark:text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  const now = new Date();
  const pendingTasks = teamTasks.filter((t) => t.status === 'Pending').length;
  const inProgressTasks = teamTasks.filter((t) => t.status === 'In Progress').length;
  const reviewTasks = teamTasks.filter((t) => t.status === 'Review').length;
  const submittedTasks = teamTasks.filter((t) => t.status === 'Submitted').length;
  const overdueTasks = teamTasks.filter(
    (t) => t.status !== 'Approved' && new Date(t.deadline) < now
  ).length;

  /** Team log: employees on this team only (TL’s own hours stay under “My Weekly Hours”). */
  const teamTimesheets = timesheets
    .filter((t) => teamEmployees.some((m) => m.id === t.userId))
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  const hasAnyTimerWindowActivity = teamTasks.some((t) =>
    taskHasActivityInLastDays(t, TEAM_TIMER_WINDOW_DAYS, now)
  );
  const liveTasksInTimerList = teamTasksTimerList.filter((t) => t.status === 'In Progress').length;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Target className="h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-400" />
            Team Dashboard
          </h2>
          <Link
            href="/project-manager"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200/40 transition hover:bg-indigo-700 dark:shadow-indigo-950/40 dark:hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create task (Project Manager)
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-5">
          <StatCard icon={Users} label="Employees" value={teamEmployees.length} color="text-blue-500 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/45" href="/team-data" />
          <StatCard icon={Clock} label="Pending" value={pendingTasks} color="text-amber-500 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/45" href="/project-manager?status=Pending" />
          <StatCard
            icon={BarChart3}
            label="In progress"
            value={inProgressTasks}
            color="text-indigo-500 dark:text-indigo-400"
            bg="bg-indigo-50 dark:bg-indigo-950/45"
            href="/project-manager?status=In%20Progress"
          />
          <StatCard
            icon={Timer}
            label="Review"
            value={reviewTasks}
            color="text-violet-500 dark:text-violet-400"
            bg="bg-violet-50 dark:bg-violet-950/45"
            href="/project-manager?status=Review"
          />
          <StatCard icon={ArrowUpRight} label="Submitted" value={submittedTasks} color="text-cyan-600 dark:text-cyan-400" bg="bg-cyan-50 dark:bg-cyan-950/45" href="/project-manager?status=Submitted" />
          <StatCard icon={AlertCircle} label="Overdue" value={overdueTasks} color="text-rose-500 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-950/45" href="/project-manager" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
              Member performance
            </h3>
            <div className="space-y-5">
              {teamEmployees.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">No employees on your team yet.</p>
              ) : (
                teamEmployees.map((member) => {
                  const memberTasks = tasks.filter((t) => t.assignedTo === member.id);
                  const done = memberTasks.filter((t) => t.status === 'Approved').length;
                  const total = memberTasks.length;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  const isActive = timesheets.some((t) => t.userId === member.id && !t.clockOut);

                  return (
                    <div key={member.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              {member.name.charAt(0)}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{member.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                          {done}/{total}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-700 to-indigo-900 p-8 text-white shadow-none dark:from-blue-900 dark:to-indigo-950">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-white/10 dark:bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Team status</h3>
                           <p className="text-blue-100 text-xs leading-relaxed mb-4 font-medium">
                {teamEmployees.filter((m) => timesheets.some((t) => t.userId === m.id && !t.clockOut)).length} of{' '}
                {teamEmployees.length} employees clocked in now.
              </p>
              <div className="flex flex-wrap gap-2">
                {teamEmployees.map((m) => {
                  const isActive = timesheets.some((t) => t.userId === m.id && !t.clockOut);
                  return (
                    <div
                      key={m.id}
                      title={m.name}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border-2 ${
                        isActive
                          ? 'bg-white/20 dark:bg-white/10 border-white/40 text-white'
                          : 'bg-white/5 dark:bg-white/5 border-white/10 text-white/30'
                      }`}
                    >
                      {m.name.charAt(0)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative scroll-mt-6" aria-labelledby="live-task-timers-heading">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-700/90 bg-gradient-to-br from-white via-slate-50/95 to-indigo-50/40 p-5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.15)] dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] sm:p-7 lg:p-8">
          <div
            className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-400/25 via-sky-300/20 to-transparent blur-3xl dark:from-indigo-600/15 dark:via-sky-500/10 dark:opacity-60"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-gradient-to-tr from-violet-300/20 to-transparent blur-3xl dark:from-violet-600/10 dark:opacity-50"
            aria-hidden
          />

          <div className="relative space-y-5">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 text-white shadow-xl shadow-indigo-500/25 ring-[3px] ring-white dark:ring-slate-800 dark:shadow-indigo-950/50">
                  <Timer className="h-7 w-7" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="live-task-timers-heading" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      Live task timers
                    </h2>
                    {teamTasksTimerList.length > 0 ? (
                      <>
                        <span className="rounded-full border border-slate-200 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 shadow-sm">
                          {timerTotalCount} tasks
                        </span>
                        {liveTasksInTimerList > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/95 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-100 dark:shadow-black/20">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            {liveTasksInTimerList} live
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            <div className="grid gap-4 rounded-[1.35rem] border border-slate-200 dark:border-slate-700/80 bg-white/95 p-4 shadow-lg shadow-slate-200/30 dark:bg-slate-950/90 dark:shadow-black/25 sm:grid-cols-2 sm:items-end sm:gap-6 sm:p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 ring-1 ring-indigo-100/80 dark:from-slate-800 dark:to-slate-900 dark:text-indigo-400 dark:ring-slate-700">
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <label htmlFor="team-timer-assignee">Filter by employee</label>
                </div>
                <select
                  id="team-timer-assignee"
                  value={timerAssigneeFilterId}
                  onChange={(e) => setTimerAssigneeFilterId(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition hover:border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100 dark:shadow-none dark:hover:border-indigo-500/70 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                >
                  <option value="">All employees</option>
                  {teamEmployees
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 text-sky-600 ring-1 ring-sky-100/80 dark:from-slate-800 dark:to-slate-900 dark:text-sky-400 dark:ring-slate-700">
                    <LayoutList className="h-4 w-4" aria-hidden />
                  </span>
                  <label htmlFor="team-timer-page-size">Tasks per page</label>
                </div>
                <select
                  id="team-timer-page-size"
                  value={timerPageSize}
                  onChange={(e) => setTimerPageSize(Number(e.target.value))}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition hover:border-sky-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:max-w-xs dark:border-slate-600 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100 dark:shadow-none dark:hover:border-sky-500/70 dark:focus:border-sky-500 dark:focus:ring-sky-900/40"
                >
                  {TIMER_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!hasAnyTimerWindowActivity ? (
              <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-4 ring-white shadow-inner dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-900">
                  <Timer className="h-8 w-8" aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">No activity in the last {TEAM_TIMER_WINDOW_DAYS} days</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  When someone presses <strong className="font-semibold text-slate-700 dark:text-slate-200">Start Work</strong>, their task shows here with tracked time.
                </p>
                <Link
                  href="/project-manager"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200/50 transition hover:bg-indigo-700 dark:shadow-indigo-950/50 dark:hover:bg-indigo-500"
                >
                  Open Project Manager
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : teamTasksTimerList.length === 0 ? (
              <div className="rounded-[1.75rem] border-2 border-dashed border-amber-200/80 bg-amber-50/50 px-6 py-12 text-center dark:border-amber-800/70 dark:bg-amber-950/25">
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">No tasks for this filter</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Try another employee or show everyone.</p>
                <button
                  type="button"
                  onClick={() => setTimerAssigneeFilterId('')}
                  className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-md ring-1 ring-indigo-100 transition hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300 dark:ring-indigo-900/60 dark:hover:bg-slate-700"
                >
                  Show all employees
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/60 px-4 py-3.5 shadow-sm dark:border-slate-700 dark:from-slate-800/90 dark:via-slate-900 dark:to-slate-900 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Showing{' '}
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {timerRangeStart}–{timerRangeEnd}
                    </span>{' '}
                    of <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{timerTotalCount}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                      Page {timerPage} / {timerTotalPages}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4">
                  {paginatedTimerTasks.map((task, idx) => {
                    const assignee = users.find((u) => u.id === task.assignedTo);
                    const submitNote = getLatestSubmitNote(task);
                    const live = task.status === 'In Progress';
                    const initial = (assignee?.name ?? '?').trim().charAt(0).toUpperCase();
                    const rowNumber = timerRangeStart + idx;
                    return (
                      <li
                        key={task.id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.1)] transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200/90 hover:shadow-[0_20px_40px_-12px_rgba(79,70,229,0.18)] dark:border-slate-700/80 dark:bg-slate-950/90 dark:shadow-black/30 dark:hover:border-indigo-500/50 dark:hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]"
                      >
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/0 via-transparent to-sky-50/0 opacity-0 transition duration-300 group-hover:from-indigo-50/40 group-hover:to-sky-50/30 group-hover:opacity-100 dark:group-hover:from-indigo-950/40 dark:group-hover:to-sky-950/25"
                          aria-hidden
                        />
                        {live ? (
                          <div
                            className="absolute left-0 top-0 h-full w-1.5 rounded-r-full bg-gradient-to-b from-emerald-400 via-teal-400 to-sky-500 shadow-[2px_0_12px_rgba(16,185,129,0.35)]"
                            aria-hidden
                          />
                        ) : null}
                        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:p-6">
                          <div className="flex min-w-0 flex-1 gap-4">
                            <div className="relative shrink-0">
                              <span className="absolute -left-1 -top-1 z-10 flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-1.5 text-[10px] font-black tabular-nums text-white shadow-lg shadow-indigo-300/40 ring-2 ring-white dark:shadow-indigo-950/50 dark:ring-slate-900">
                                {rowNumber}
                              </span>
                              <div
                                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-base font-black tabular-nums ring-2 transition group-hover:ring-indigo-100 dark:group-hover:ring-indigo-800/80 ${
                                  live
                                    ? 'bg-gradient-to-br from-emerald-100 to-sky-100 text-emerald-900 shadow-md ring-white dark:from-emerald-950 dark:to-sky-950 dark:text-emerald-100 dark:ring-slate-800'
                                    : 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-700 shadow-sm ring-white dark:from-slate-800 dark:to-slate-900 dark:text-slate-200 dark:ring-slate-800'
                                }`}
                              >
                                {initial}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Assignee</p>
                                  <p className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                    {assignee?.name ?? 'Member'}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${statusChipClass(
                                    task.status
                                  )}`}
                                >
                                  {task.status}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Task</p>
                                <p className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">
                                  {task.title}
                                </p>
                              </div>
                              {submitNote ? (
                                <div className="rounded-xl border border-indigo-100/60 bg-gradient-to-br from-slate-50/90 to-indigo-50/20 px-3.5 py-2.5 dark:border-indigo-900/50 dark:from-slate-900 dark:to-indigo-950/40">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/80 dark:text-indigo-400">
                                    Latest submission note
                                  </p>
                                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200 line-clamp-3">{submitNote}</p>
                                </div>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" aria-hidden />
                                  Due {format(new Date(task.deadline), 'EEE, MMM d, yyyy')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                                  {taskRefLabel(task.id)}
                                  {currentUser?.role !== 'Employee' ? (
                                    isTeamLeaderCreatedTask(task, users) && assignee?.name?.trim() ? (
                                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                        {shortName(assignee.name)}
                                      </span>
                                    ) : assignee?.team?.trim() ? (
                                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                        {assignee.team.trim()}
                                      </span>
                                    ) : null
                                  ) : null}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-3 rounded-2xl bg-gradient-to-b from-slate-50/95 to-white p-4 ring-1 ring-slate-100 sm:w-[14rem] sm:justify-between dark:from-slate-900 dark:to-slate-950 dark:ring-slate-700/80">
                            <TaskTotalWorkDisplay task={task} label="Total work time" className="w-full" />
                            <Link
                              href={`/project-manager?taskId=${encodeURIComponent(task.id)}`}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-slate-400/25 transition hover:from-indigo-700 hover:to-indigo-900 active:scale-[0.98] dark:from-slate-800 dark:to-slate-900 dark:shadow-black/40 dark:hover:from-indigo-600 dark:hover:to-indigo-800"
                            >
                              View task
                              <ArrowUpRight className="h-4 w-4 opacity-90" aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {timerTotalPages > 1 ? (
                  <nav
                    className="flex flex-col items-stretch gap-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/90 px-4 py-4 shadow-lg shadow-slate-200/40 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 dark:shadow-black/30 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    aria-label="Task list pages"
                  >
                    <button
                      type="button"
                      disabled={timerPage <= 1}
                      onClick={() => setTimerPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      Previous
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {timerPaginationPages.map((item, i) =>
                        item === 'gap' ? (
                          <span
                            key={`gap-${i}`}
                            className="px-1.5 text-sm font-bold text-slate-300 dark:text-slate-600"
                            aria-hidden
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setTimerPage(item)}
                            className={
                              item === timerPage
                                ? 'min-w-[2.35rem] rounded-xl bg-gradient-to-b from-indigo-600 to-indigo-700 px-2.5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-300/40 ring-2 ring-indigo-200/50 dark:shadow-indigo-950/50 dark:ring-indigo-900/40'
                                : 'min-w-[2.35rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800'
                            }
                            aria-current={item === timerPage ? 'page' : undefined}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={timerPage >= timerTotalPages}
                      onClick={() => setTimerPage((p) => Math.min(timerTotalPages, p + 1))}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </nav>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-bold text-slate-800 dark:border-slate-800 dark:text-slate-100">
          <Clock className="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
          Attendance
        </h2>

        <TeamAttendanceStats memberIds={teamEmployees.map((m) => m.id)} timesheets={timesheets} />

        <TimesheetTable
          timesheets={teamTimesheets}
          users={teamEmployees}
          title={myTeam ? `${myTeam} — team log` : 'Team attendance log'}
        />
      </section>
    </div>
  );
}
