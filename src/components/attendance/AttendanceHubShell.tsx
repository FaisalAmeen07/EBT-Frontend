'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AttendanceHubTab = { id: string; label: string };

/**
 * Top tab navigation for Timesheet / attendance (same shell pattern as {@link RequestsHubShell}).
 */
export function AttendanceHubShell({
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  tabs: AttendanceHubTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[min(70vh,720px)] rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-[#eef2f7] p-4 shadow-sm sm:p-6">
      <nav
        className="flex flex-wrap gap-6 border-b border-slate-200 dark:border-slate-700/90 sm:gap-10"
        aria-label="Attendance sections"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
              activeTab === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
