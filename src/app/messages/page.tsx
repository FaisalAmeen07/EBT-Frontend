import { Suspense } from 'react';
import MessagesPage from './MessagesClient';

function MessagesFallback() {
  return (
    <div className="messages-route-root flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      Loading messages…
    </div>
  );
}

export default function MessagesRoute() {
  return (
    <Suspense fallback={<MessagesFallback />}>
      <MessagesPage />
    </Suspense>
  );
}
