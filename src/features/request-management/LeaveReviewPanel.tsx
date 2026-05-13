'use client';

import { format } from 'date-fns';
import { Check, X, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { LeaveRequest } from '@/lib/store';

type LeaveReviewPanelProps = {
  rows: LeaveRequest[];
  getUsername: (userId: string) => string;
  getUserAvatar: (userId: string) => string | undefined;
  canReview: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

export function LeaveReviewPanel({
  rows,
  getUsername,
  getUserAvatar,
  canReview,
  onApprove,
  onReject,
}: LeaveReviewPanelProps) {
  const roleLabel = (leave: LeaveRequest): string => {
    const raw = String(leave.requesterRole || '').trim().toUpperCase();
    if (raw === 'ADMIN') return 'Admin';
    if (raw === 'HR') return 'HR';
    if (raw === 'TEAM_LEADER' || raw === 'TEAMLEADER' || raw === 'TEAM_LEAD') return 'Team Leader';
    if (raw === 'EMPLOYEE') return 'Employee';
    return 'Employee';
  };

  return (
    <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:px-6">
              Employee
            </th>
            <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:px-6">
              Type & Reason
            </th>
            <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:px-6">
              Status
            </th>
            <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:px-6">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-20 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                There are no requests available.
              </td>
            </tr>
          ) : (
            rows.map((leave) => (
              <tr key={leave.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80">
                <td className="px-4 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50 text-sm font-bold text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
                      {(leave.requesterAvatar || getUserAvatar(leave.userId)) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or CDN profile image
                        <img
                          src={leave.requesterAvatar || getUserAvatar(leave.userId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getUsername(leave.userId).charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-50">{getUsername(leave.userId)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {roleLabel(leave)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 sm:px-6">
                  <span
                    className={`mb-1 block text-[10px] font-bold uppercase tracking-wider ${
                      leave.type === 'Leave'
                        ? 'text-rose-500'
                        : leave.type === 'Casual'
                          ? 'text-amber-500'
                          : 'text-blue-500'
                    }`}
                  >
                    {leave.type}
                  </span>
                  <p className="line-clamp-2 max-w-[240px] text-sm text-slate-600 dark:text-slate-300">{leave.reason || '—'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-slate-800 dark:text-slate-100">
                      {format(new Date(leave.startDate), 'MMM d')}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                    <span className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-slate-800 dark:text-slate-100">
                      {format(new Date(leave.endDate), 'MMM d')}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-5 text-center sm:px-6">
                  {leave.status === 'Pending' && (
                    <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">
                      <Clock className="mr-1 h-3 w-3" /> Pending
                    </span>
                  )}
                  {leave.status === 'Approved' && (
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
                    </span>
                  )}
                  {leave.status === 'Rejected' && (
                    <span className="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      <XCircle className="mr-1 h-3 w-3" /> Rejected
                    </span>
                  )}
                </td>
                <td className="px-4 py-5 text-right sm:px-6">
                  {leave.status === 'Pending' && canReview ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(leave.id)}
                        className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200 dark:hover:bg-emerald-900/50 active:scale-95"
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(leave.id)}
                        className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-rose-700 transition-all hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/45 active:scale-95"
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Handled</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
    </table>
  );
}
