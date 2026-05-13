'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RequestsHubTab = 'leave' | 'manual';

const TAB_LABELS: Record<RequestsHubTab, string> = {
  leave: 'Leave Requests',
  manual: 'Manual Time Requests',
};

export function RequestsHubShell({
  activeTab,
  onTabChange,
  sectionTitle,
  statusValue,
  onStatusChange,
  statusOptions,
  children,
  footer,
}: {
  activeTab: RequestsHubTab;
  onTabChange: (tab: RequestsHubTab) => void;
  sectionTitle: string;
  statusValue: string;
  onStatusChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  const tabs = (Object.keys(TAB_LABELS) as RequestsHubTab[]).map((id) => ({ id, label: TAB_LABELS[id] }));

  return (
    <div className="min-h-[min(70vh,720px)] rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-[#eef2f7] p-4 shadow-sm dark:bg-slate-950 sm:p-6">
      <nav className="flex flex-wrap gap-6 border-b border-slate-200 dark:border-slate-700/90 sm:gap-10" aria-label="Request categories">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
              activeTab === id
                ? 'border-blue-500 text-blue-600 dark:border-indigo-500 dark:text-indigo-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{sectionTitle}</h2>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <label htmlFor="requests-status-filter" className="sr-only">
            Filter by status
          </label>
          <div className="relative w-full sm:min-w-[min(100%,260px)]">
            <select
              id="requests-status-filter"
              value={statusValue}
              onChange={(e) => onStatusChange(e.target.value)}
              className={cn(
                'h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-11 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none transition',
                'hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40'
              )}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

export function RequestsEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

export function RequestsContentCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm', className)}>
      {children}
    </div>
  );
}
