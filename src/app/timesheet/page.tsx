import { Suspense } from 'react';
import { TimesheetPageClient } from '@/features/timesheet/TimesheetPageClient';

export { PersonalStats, TimesheetTable } from '@/features/timesheet/widgets';

export default function TimesheetPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>}>
      <TimesheetPageClient />
    </Suspense>
  );
}
