'use client';

import { format } from 'date-fns';
import { Check, X, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { LeaveRequest } from '@/lib/store';

type LeaveReviewPanelProps = {
  rows: LeaveRequest[];
  getUsername: (userId: string) => string;
  canReview: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

export function LeaveReviewPanel({
  rows,
  getUsername,
  canReview,
  onApprove,
  onReject,
}: LeaveReviewPanelProps) {
  return (
    <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-white">
            <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
              Employee
            </th>
            <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
              Type & Reason
            </th>
            <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
              Status
            </th>
            <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-20 text-center text-sm font-medium text-slate-500">
                There are no requests available.
              </td>
            </tr>
          ) : (
            rows.map((leave) => (
              <tr key={leave.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-sm font-bold text-blue-600">
                      {getUsername(leave.userId).charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{getUsername(leave.userId)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Employee</p>
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
                  <p className="line-clamp-2 max-w-[240px] text-sm text-slate-600">{leave.reason || '—'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-800">
                      {format(new Date(leave.startDate), 'MMM d')}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <span className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-800">
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
                        className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95"
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(leave.id)}
                        className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-rose-700 transition-all hover:bg-rose-100 active:scale-95"
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Handled</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
    </table>
  );
}
