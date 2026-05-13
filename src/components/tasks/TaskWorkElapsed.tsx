'use client';

import { useEffect, useState } from 'react';
import { formatElapsedCompact } from '@/lib/taskWorkTimer';

type TaskWorkElapsedProps = {
  startedAtIso: string | null;
  className?: string;
  label?: string;
};

export function TaskWorkElapsed({ startedAtIso, className = '', label = 'Time on task' }: TaskWorkElapsedProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAtIso]);

  if (!startedAtIso) {
    return (
      <div className={className}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-lg font-black tabular-nums text-slate-400 dark:text-slate-500">—</p>
      </div>
    );
  }

  const ms = Date.now() - new Date(startedAtIso).getTime();
  const text = formatElapsedCompact(ms);

  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black tabular-nums tracking-tight text-blue-700">{text}</p>
    </div>
  );
}
