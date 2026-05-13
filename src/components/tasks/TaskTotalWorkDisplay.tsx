'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { Task } from '@/lib/store';
import { formatElapsedCompact, getTotalWorkMsOnTask } from '@/lib/taskWorkTimer';

type TaskTotalWorkDisplayProps = {
  task: Task;
  className?: string;
  label?: string;
};

/** Shows cumulative work time from task history; ticks every second while task is In Progress. */
export function TaskTotalWorkDisplay({
  task,
  className = '',
  label = 'Work time',
}: TaskTotalWorkDisplayProps) {
  const [tick, setTick] = useState(0);
  const live = task.status === 'In Progress';

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  void tick;
  const ms = getTotalWorkMsOnTask(task, new Date());
  const text = formatElapsedCompact(ms);

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm',
        live
          ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-sky-50/80 shadow-emerald-100/40 dark:border-emerald-800/80 dark:from-emerald-950/50 dark:via-slate-900 dark:to-sky-950/40 dark:shadow-emerald-950/20'
          : 'border-slate-200 dark:border-slate-600/90 bg-gradient-to-br from-slate-50/90 to-white shadow-slate-200/30 dark:from-slate-900 dark:to-slate-950 dark:shadow-black/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          live
            ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
            : 'bg-slate-200/60 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        ].join(' ')}
      >
        <Clock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        <p
          className={`mt-0.5 font-mono text-2xl font-black tabular-nums tracking-tight ${
            live ? 'text-emerald-800 dark:text-emerald-100' : 'text-slate-900 dark:text-slate-50'
          }`}
        >
          {text}
        </p>
        {live && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </p>
        )}
      </div>
    </div>
  );
}
