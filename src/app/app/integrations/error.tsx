'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AppIntegrationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-integrations]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/70 dark:bg-rose-950/35">
      <AlertTriangle className="h-10 w-10 text-rose-600 dark:text-rose-300" aria-hidden />
      <h1 className="mt-4 text-2xl font-black text-rose-950 dark:text-rose-50">Integrations failed to render</h1>
      <p className="mt-2 text-sm leading-6 text-rose-800 dark:text-rose-100">
        The page hit an unexpected error. You can retry without leaving the dashboard.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
      >
        Try again
      </button>
    </div>
  );
}
