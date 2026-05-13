import { Suspense } from 'react';
import { RequestManagementView } from '@/features/request-management';

export default function RequestManagementPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>}>
      <RequestManagementView />
    </Suspense>
  );
}
