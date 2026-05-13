'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Keyboard,
  MousePointer2,
  RefreshCcw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

type DiaryShot = {
  id: string;
  time: string;
  keyboard: number;
  mouse: number;
  activity: number;
  windowTitle: string;
};

type DiaryDay = {
  dateKey: string;
  dateLabel: string;
  headerDate: string;
  totalLabel: string;
  trackedLabel: string;
  range: string;
  memo: string;
  shots: DiaryShot[];
};

const DIARY_DAYS: DiaryDay[] = [
  {
    dateKey: '2026-02-14',
    dateLabel: 'Sat, 2/14',
    headerDate: 'Sat, Feb 14, 2026',
    totalLabel: '2:00 hrs',
    trackedLabel: '2:00 hrs',
    range: '12:40 PM - 2:40 PM (2:00 hrs)',
    memo: 'Fix issue on squarespace using aherf',
    shots: Array.from({ length: 12 }, (_, index) => ({
      id: `feb-${index + 1}`,
      time: [
        '12:40 PM',
        '12:50 PM',
        '1:00 PM',
        '1:10 PM',
        '1:20 PM',
        '1:30 PM',
        '1:40 PM',
        '1:50 PM',
        '2:00 PM',
        '2:10 PM',
        '2:20 PM',
        '2:30 PM',
      ][index],
      keyboard: index === 0 ? 20 : index % 4 === 0 ? 10 : 0,
      mouse: [28, 15, 37, 28, 13, 25, 25, 33, 33, 16, 18, 21][index],
      activity: index === 0 ? 10 : index % 3 === 0 ? 8 : 9,
      windowTitle:
        index % 2 === 0
          ? 'Issues / Broken redirect — Innovaragency - Google Chrome'
          : 'Overview - Innovaragency - Google Chrome',
    })),
  },
  {
    dateKey: '2026-03-20',
    dateLabel: 'Fri, 3/20',
    headerDate: 'Fri, Mar 20, 2026',
    totalLabel: '3:00 hrs',
    trackedLabel: '3:00 hrs',
    range: '9:10 AM - 12:10 PM (3:00 hrs)',
    memo: 'Identifying remain 404 or other broken link issue in semrush',
    shots: Array.from({ length: 18 }, (_, index) => ({
      id: `mar-${index + 1}`,
      time: [
        '9:10 AM',
        '9:20 AM',
        '9:30 AM',
        '9:40 AM',
        '9:50 AM',
        '10:00 AM',
        '10:10 AM',
        '10:20 AM',
        '10:30 AM',
        '10:40 AM',
        '10:50 AM',
        '11:00 AM',
        '11:10 AM',
        '11:20 AM',
        '11:30 AM',
        '11:40 AM',
        '11:50 AM',
        '12:00 PM',
      ][index],
      keyboard: index % 5 === 0 ? 18 : index % 4 === 0 ? 8 : 0,
      mouse: 12 + ((index * 7) % 29),
      activity: index % 4 === 0 ? 7 : 9,
      windowTitle: 'Semrush Site Audit - Innovaragency - Google Chrome',
    })),
  },
  {
    dateKey: '2026-04-29',
    dateLabel: 'Wed, 4/29',
    headerDate: 'Wed, Apr 29, 2026',
    totalLabel: '0:00 hrs',
    trackedLabel: '—',
    range: '',
    memo: '',
    shots: [],
  },
];

function BrowserPreview({ shot }: { shot: DiaryShot }) {
  const bars = Array.from({ length: 32 }, (_, index) => index);
  return (
    <div className="overflow-hidden rounded-sm border border-rose-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-4 items-center gap-1 bg-rose-100 px-2 dark:bg-rose-950/35">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="ml-2 h-1.5 flex-1 rounded bg-white/70 dark:bg-slate-800" />
      </div>
      <div className="grid h-20 grid-cols-[2.2rem_1fr] gap-2 p-2">
        <div className="space-y-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <span key={index} className="block h-1.5 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <span className="h-8 rounded bg-emerald-100 dark:bg-emerald-950/45" />
            <span className="h-8 rounded bg-blue-100 dark:bg-blue-950/45" />
            <span className="h-8 rounded bg-amber-100 dark:bg-amber-950/45" />
          </div>
          <div className="space-y-1">
            <span className="block h-1.5 rounded bg-slate-200 dark:bg-slate-700" />
            <span className="block h-1.5 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
            <span className="block h-1.5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-32 gap-px border-t border-white bg-white px-0.5 py-1 dark:border-slate-900 dark:bg-slate-950">
        {bars.map((bar) => (
          <span
            key={bar}
            className={cn('h-1.5 rounded-sm', bar < shot.activity * 3 ? 'bg-[#63cd6b]' : 'bg-emerald-100 dark:bg-emerald-950/50')}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityBars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} className={cn('h-2 w-2 rounded-[1px]', index < level ? 'bg-[#63cd6b]' : 'bg-slate-200 dark:bg-slate-700')} />
      ))}
    </div>
  );
}

export default function DesktopWorkDiaryPage() {
  const currentUser = useStore((s) => s.currentUser);
  const [selectedDate, setSelectedDate] = useState('2026-02-14');
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const allowed = currentUser?.role === 'Employee' || currentUser?.role === 'Team Leader';

  const day = useMemo(
    () => DIARY_DAYS.find((entry) => entry.dateKey === selectedDate) ?? DIARY_DAYS[0],
    [selectedDate]
  );
  const selectedShot = day.shots.find((shot) => shot.id === selectedShotId) ?? null;
  const selectedShotIndex = selectedShot ? day.shots.findIndex((shot) => shot.id === selectedShot.id) : -1;

  const moveDay = (direction: -1 | 1) => {
    const index = DIARY_DAYS.findIndex((entry) => entry.dateKey === day.dateKey);
    const next = DIARY_DAYS[Math.min(Math.max(index + direction, 0), DIARY_DAYS.length - 1)];
    setSelectedDate(next.dateKey);
    setSelectedShotId(null);
  };

  const moveShot = (direction: -1 | 1) => {
    if (!selectedShot) return;
    const next = day.shots[Math.min(Math.max(selectedShotIndex + direction, 0), day.shots.length - 1)];
    setSelectedShotId(next.id);
  };

  if (currentUser && !allowed) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Clock3 className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Work diary is restricted</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This page is available only for employees and team leaders.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-slate-950 dark:text-slate-50">
      <h1 className="text-4xl font-semibold tracking-tight">Work diary</h1>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950">
          <option>SEO Project</option>
          <option>Website Maintenance</option>
          <option>CRM Development</option>
        </select>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => moveDay(-1)}
            className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/35"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setSelectedShotId(null);
              }}
              className="h-11 min-w-[13rem] appearance-none rounded-md border border-slate-300 bg-white px-4 pr-10 text-sm font-semibold outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
            >
              {DIARY_DAYS.map((entry) => (
                <option key={entry.dateKey} value={entry.dateKey}>
                  {entry.headerDate}
                </option>
              ))}
            </select>
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <button
            type="button"
            onClick={() => moveDay(1)}
            className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/35"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDate('2026-04-29');
              setSelectedShotId(null);
            }}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
          >
            Today
          </button>
        </div>
      </section>

      <section className="rounded-sm bg-slate-50 px-8 py-7 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-start gap-10">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-semibold">Total: {day.totalLabel}</h2>
              <RefreshCcw className="h-5 w-5 text-slate-500" />
            </div>
            <div className="flex flex-wrap gap-10">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-3 w-3 rounded-full bg-[#63cd6b]" />
                  Tracked
                </p>
                <p className="mt-2 text-2xl font-semibold">{day.trackedLabel}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-0 w-0 border-b-[10px] border-l-[6px] border-r-[6px] border-b-teal-500 border-l-transparent border-r-transparent" />
                  Manual
                </p>
                <p className="mt-2 text-2xl font-semibold">—</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-3 w-3 rounded-sm bg-red-700" />
                  Overtime
                </p>
                <p className="mt-2 text-2xl font-semibold">—</p>
              </div>
            </div>
          </div>

          <select className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-emerald-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-300">
            <option>UTC / 12 hour</option>
            <option>UTC / 24 hour</option>
          </select>
        </div>
      </section>

      {day.shots.length === 0 ? (
        <section className="flex min-h-[24rem] flex-col items-center justify-center rounded-sm bg-slate-50 text-center dark:bg-slate-900">
          <div className="mb-6 text-8xl">⏱️</div>
          <h2 className="text-3xl font-medium">No time logged on this day</h2>
        </section>
      ) : (
        <section className="space-y-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-3 w-3 rounded-full bg-[#63cd6b]" />
              {day.range}
            </p>
            <p className="ml-5 mt-3 text-sm text-slate-600 dark:text-slate-300">{day.memo}</p>
          </div>

          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {day.shots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setSelectedShotId(shot.id)}
                className="group text-left"
              >
                <BrowserPreview shot={shot} />
                <p className="mt-2 text-right text-xs font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                  {shot.time}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedShot ? (
        <div className="fixed inset-0 z-[80] bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <button
            type="button"
            onClick={() => setSelectedShotId(null)}
            className="absolute right-6 top-6 rounded-full p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Close screenshot details"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="grid h-full gap-10 overflow-y-auto p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-12">
            <div>
              <p className="text-sm text-slate-500">
                {day.dateLabel} <span className="mx-2">·</span> Tracked <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#63cd6b]" />
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-xl font-semibold">{day.range}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {selectedShotIndex + 1} of {day.shots.length}
                </span>
              </div>

              <div className="mt-10 max-w-4xl">
                <BrowserPreview shot={selectedShot} />
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold">Active Window</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedShot.windowTitle}</p>
              </div>
            </div>

            <aside className="pt-16 lg:pt-20">
              <div>
                <p className="text-sm font-semibold">Memo</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{day.memo}</p>
              </div>

              <div className="mt-8">
                <p className="text-sm font-semibold">Activity</p>
                <div className="mt-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Activity Level</p>
                    <ActivityBars level={selectedShot.activity} />
                  </div>
                  <p className="text-sm font-medium">Active {selectedShot.activity} of 10 min</p>
                </div>
              </div>

              <table className="mt-8 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 font-medium">Time</th>
                    <th className="py-3 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Keyboard className="h-4 w-4" />
                        Keyboard
                      </span>
                    </th>
                    <th className="py-3 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <MousePointer2 className="h-4 w-4" />
                        Mouse
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(1, selectedShot.activity) }).map((_, index) => (
                    <tr key={index} className="border-b border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <td className="py-2">{selectedShot.time.replace(' PM', `:${String(index).padStart(2, '0')} PM`)}</td>
                      <td className="py-2">{index % 4 === 0 ? selectedShot.keyboard : 0}</td>
                      <td className="py-2">{Math.max(1, selectedShot.mouse - index * 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-10 flex justify-end">
                <button
                  type="button"
                  onClick={() => moveShot(1)}
                  disabled={selectedShotIndex === day.shots.length - 1}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/35"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
