'use client';

import Link from 'next/link';
import { STATUS_FILTER_OPTIONS } from './constants';
import { LeaveectionTitle, manualSectionTitle } from './copy';
import { LeaveRequestsPanel } from './LeaveRequestsPanel';
import { ManualTimeRequestsPanel } from './ManualTimeRequestsPanel';
import { useMyRequestsController } from './useMyRequestsController';
import type { RequestStatusFilter } from './types';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';

export function MyRequestsView() {
  const c = useMyRequestsController();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sectionTitle =
    c.activeTab === 'leave' ? LeaveectionTitle(c.LeavetatusFilter) : manualSectionTitle(c.manualStatusFilter);

  const statusFilterOptions = STATUS_FILTER_OPTIONS;
  const statusFilterValue =
    c.activeTab === 'leave' ? c.LeavetatusFilter : c.manualStatusFilter;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900/80 pb-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Tabs under navbar */}
        <div className="pt-6">
          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="flex flex-wrap gap-8" aria-label="My requests sections">
              {(
                [
                  { id: 'leave', label: 'Leave requests' },
                  { id: 'manual', label: 'Manual time requests' },
                ] as const
              ).map((t) => (
                <Link
                  key={t.id}
                  href={{
                    pathname,
                    query: { ...Object.fromEntries(searchParams.entries()), tab: t.id },
                  }}
                  onClick={() => c.handleTabChange(t.id)}
                  className={cn(
                    '-mb-px border-b-[3px] pb-3 text-sm font-semibold transition-colors',
                    c.activeTab === t.id
                      ? 'border-indigo-600 text-slate-900 dark:text-slate-50'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Minimal header controls */}
        <div className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{sectionTitle}</h2>
            <div className="relative w-fit">
              <select
                value={statusFilterValue}
                onChange={(e) => c.onStatusFilterChange(e.target.value as RequestStatusFilter)}
                className="h-10 w-auto cursor-pointer appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-10 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:border-indigo-300 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/25"
              >
                {statusFilterOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                ▾
              </span>
            </div>
          </div>
        </div>

        {/* Flat content */}
        <div className="pt-4">
          {c.activeTab === 'leave' ? (
            <LeaveRequestsPanel
              LeavetatusFilter={c.LeavetatusFilter}
              rows={c.filteredLeave}
              totalCount={c.myLeave.length}
              formOpen={c.leaveFormOpen}
              onCloseModal={() => c.setLeaveFormOpen(false)}
              onOpenModal={() => c.setLeaveFormOpen(true)}
              form={c.leaveForm}
            />
          ) : (
            <ManualTimeRequestsPanel
              manualStatusFilter={c.manualStatusFilter}
              rows={c.filteredManual}
              totalCount={c.myManualTimeRequests.length}
              formOpen={c.manualFormOpen}
              onCloseModal={() => c.setManualFormOpen(false)}
              onOpenModal={() => c.setManualFormOpen(true)}
              form={c.manualForm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
