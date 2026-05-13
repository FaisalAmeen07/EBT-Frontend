'use client';

import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Clock, ArrowRight } from 'lucide-react';
import { employeeDisplayId } from '@/lib/attendanceSite';
import { isClockInLate } from '@/lib/attendanceRules';
import { useStore } from '@/lib/store';

export function PersonalStats({ userId, timesheets }: { userId?: string; timesheets: any[] }) {
  const attendanceDayOverrides = useStore((s) => s.attendanceDayOverrides);
  const companyShiftTimes = useStore((s) => s.companyShiftTimes);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const weeklyTimesheets = timesheets
    .filter((t) => t.userId === userId)
    .filter((t) => isWithinInterval(new Date(t.clockIn), { start: weekStart, end: weekEnd }));

  const totalHours = weeklyTimesheets.reduce((acc: number, t: any) => acc + (t.totalHours || 0), 0);
  const lateMarks = weeklyTimesheets.filter((t: any) => {
    if (typeof t?.lateMark === 'boolean') return t.lateMark;
    return isClockInLate(t.clockIn, attendanceDayOverrides, companyShiftTimes);
  }).length;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">My Weekly Hours</p>
        <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
          {totalHours.toFixed(1)} <span className="text-sm font-bold text-slate-400 dark:text-slate-500">hrs</span>
        </p>
      </div>
      <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Late Marks</p>
        <p className={`text-3xl font-black tracking-tight ${lateMarks > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {lateMarks}
        </p>
      </div>
    </div>
   );
}

/** Current calendar week: combined hours and late clock-ins for all given team members (not a single user). */
export function TeamAttendanceStats({
  memberIds,
  timesheets,
}: {
  memberIds: string[];
  timesheets: any[];
}) {
  const attendanceDayOverrides = useStore((s) => s.attendanceDayOverrides);
  const companyShiftTimes = useStore((s) => s.companyShiftTimes);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const idSet = new Set(memberIds);

  const weeklyTimesheets = timesheets.filter(
    (t) => idSet.has(t.userId) && isWithinInterval(new Date(t.clockIn), { start: weekStart, end: weekEnd })
  );

  const totalHours = weeklyTimesheets.reduce((acc: number, t: any) => acc + (t.totalHours || 0), 0);
  const lateMarks = weeklyTimesheets.filter((t: any) => {
    if (typeof t?.lateMark === 'boolean') return t.lateMark;
    return isClockInLate(t.clockIn, attendanceDayOverrides, companyShiftTimes);
  }).length;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Team weekly hours</p>
        <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
          {totalHours.toFixed(1)} <span className="text-sm font-bold text-slate-400 dark:text-slate-500">hrs</span>
        </p>
      </div>
      <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Team late marks</p>
        <p className={`text-3xl font-black tracking-tight ${lateMarks > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {lateMarks}
        </p>
      </div>
    </div>
  );
}

export function TimesheetTable({ timesheets, users, title }: { timesheets: any[]; users: any[]; title: string }) {
  return (
    <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-50 px-8 py-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
          <Clock className="h-6 w-6 text-blue-500" />
          {title}
        </h2>
        <span className="rounded-full border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {timesheets.length} Records
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Employee</th>
              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Date</th>
              <th className="px-8 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                In / Out
              </th>
              <th className="px-8 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Total Hours
              </th>
              <th className="px-8 py-6 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {timesheets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Clock className="h-12 w-12 text-slate-100" />
                    <p className="font-medium text-slate-400 dark:text-slate-500">No attendance records found</p>
                  </div>
                </td>
              </tr>
            ) : (
              timesheets.map((entry) => {
                const user = users.find((u: any) => u.id === entry.userId);
                return (
                  <tr key={entry.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 dark:text-slate-400">
                          {user?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{user?.team}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                      {format(new Date(entry.clockIn), 'MMM d, yyyy')}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-3">
                        <span className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                          {format(new Date(entry.clockIn), 'HH:mm')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        <span
                          className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                            entry.clockOut
                              ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200'
                              : 'border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-300'
                          }`}
                        >
                          {entry.clockOut ? format(new Date(entry.clockOut), 'HH:mm') : '--:--'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-sm font-black tracking-tighter text-slate-800 dark:text-slate-100">
                        {entry.totalHours ? entry.totalHours.toFixed(2) : '0.00'}
                      </span>
                      <span className="ml-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">HRS</span>
                    </td>
                    <td className="px-8 py-6 text-right font-mono text-xs text-slate-700 dark:text-slate-200">
                      {employeeDisplayId(user, entry.userId)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
