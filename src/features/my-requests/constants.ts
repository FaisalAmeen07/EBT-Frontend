import type { RequestStatusFilter } from './types';

/** Shared labels; tab (Leave vs Manual) already provides context. */
export const STATUS_FILTER_OPTIONS: { value: RequestStatusFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'All', label: 'All' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

export const PRIMARY_ACTION_BTN_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-none ring-1 ring-blue-500/20 transition-colors hover:bg-blue-700 dark:ring-blue-400/15 dark:hover:bg-blue-500';

export const FIELD_CLASS =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 p-3 text-slate-700 dark:text-slate-200 outline-none transition hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40';

export const FIELD_CLASS_NEUTRAL =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 p-3 text-slate-700 dark:text-slate-200 outline-none transition hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40';
