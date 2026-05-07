'use client';

import Link from 'next/link';
import { REVIEW_STATUS_OPTIONS, getRequestManagementSectionTitle } from './constants';
import type { ReviewStatusFilter } from './constants';
import { useMemo } from 'react';
import { LeaveReviewPanel } from './LeaveReviewPanel';
import { ManualReviewPanel } from './ManualReviewPanel';
import { useRequestManagementController } from './useRequestManagementController';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';

export function RequestManagementView() {
  const c = useRequestManagementController();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sectionTitle = useMemo(
    () => getRequestManagementSectionTitle(c.activeTab, c.statusFilter),
    [c.activeTab, c.statusFilter]
  );

  return (
    <div className="min-h-full bg-slate-50 pb-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Clean route-level tabs (underline) */}
        <div className="pt-6">
          <div className="border-b border-slate-200">
            <nav className="flex flex-wrap gap-8" aria-label="Request management sections">
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
                  className={cn(
                    '-mb-px border-b-[3px] pb-3 text-sm font-semibold transition-colors',
                    c.activeTab === t.id
                      ? 'border-indigo-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Minimal header controls (no card) */}
        <div className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{sectionTitle}</h2>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-fit">
                <select
                  value={c.statusFilter}
                  onChange={(e) => c.setStatusFilter(e.target.value as ReviewStatusFilter)}
                  className="h-10 w-auto cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                >
                  {REVIEW_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Flat table (no card) */}
        <div className="pt-4">
          <div className="overflow-x-auto">
            <div className="min-w-[720px] rounded-2xl bg-white">
              {c.activeTab === 'leave' ? (
                <LeaveReviewPanel
                  rows={c.sortedLeave}
                  getUsername={c.getUsername}
                  getUserAvatar={c.getUserAvatar}
                  canReview={c.canReviewLeave}
                  onApprove={(id) => {
                    void (async () => {
                      try {
                        await c.approveLeave(id);
                        toast('Leave approved!');
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to approve leave.', 'error');
                      }
                    })();
                  }}
                  onReject={(id) => {
                    void (async () => {
                      try {
                        await c.rejectLeave(id, 'Rejected by reviewer');
                        toast('Leave rejected!');
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to reject leave.', 'error');
                      }
                    })();
                  }}
                />
              ) : (
                <ManualReviewPanel
                  rows={c.sortedManual}
                  getUsername={c.getUsername}
                  getUserAvatar={c.getUserAvatar}
                  canReview={c.canReviewManual}
                  activeRejectId={c.activeRejectId}
                  rejectFeedback={c.rejectFeedback}
                  setRejectFeedback={c.setRejectFeedback}
                  setActiveRejectId={c.setActiveRejectId}
                  onApprove={(id) => {
                    void (async () => {
                      try {
                        await c.approveManual(id);
                        toast('Manual time approved!');
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to approve manual time.', 'error');
                      }
                    })();
                  }}
                  onRejectConfirm={(id) => {
                    const trimmed = c.rejectFeedback.trim();
                    if (!trimmed) {
                      toast('Feedback is required.', 'error');
                      return;
                    }
                    void (async () => {
                      try {
                        await c.rejectManual(id, trimmed);
                        toast('Manual time rejected!');
                        c.setActiveRejectId(null);
                        c.setRejectFeedback('');
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Unable to reject manual time.', 'error');
                      }
                    })();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
