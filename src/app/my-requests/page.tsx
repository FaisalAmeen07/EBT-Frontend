import { Suspense } from 'react';
import { MyRequestsView } from '@/features/my-requests';

function MyRequestsFallback() {
  return (
    <div className="mx-auto max-w-6xl pb-12 pt-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</div>
  );
}

export default function MyRequestsPage() {
  return (
    <Suspense fallback={<MyRequestsFallback />}>
      <MyRequestsView />
    </Suspense>
  );
}
