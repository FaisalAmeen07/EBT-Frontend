'use client';

import { format } from 'date-fns';
import { Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { ManualTimeRequest } from '@/lib/store';

type ManualReviewPanelProps = {
  rows: ManualTimeRequest[];
  getUsername: (userId: string) => string;
  getUserAvatar: (userId: string) => string | undefined;
  canReview: boolean;
  activeRejectId: string | null;
  rejectFeedback: string;
  setRejectFeedback: (v: string) => void;
  setActiveRejectId: (id: string | null) => void;
  onApprove: (id: string) => void;
  onRejectConfirm: (id: string) => void;
};

export function ManualReviewPanel({
  rows,
  getUsername,
  getUserAvatar,
  canReview,
  activeRejectId,
  rejectFeedback,
  setRejectFeedback,
  setActiveRejectId,
  onApprove,
  onRejectConfirm,
}: ManualReviewPanelProps) {
  const roleLabel = (req: ManualTimeRequest): string => {
    const raw = String(req.requesterRole || '').trim().toUpperCase();
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
              Date & Time
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
                No manual time requests found.
              </td>
            </tr>
          ) : (
            rows.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80">
                <td className="px-4 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50 text-sm font-bold text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
                      {(req.requesterAvatar || getUserAvatar(req.userId)) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or CDN profile image
                        <img
                          src={req.requesterAvatar || getUserAvatar(req.userId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getUsername(req.userId).charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-50">{getUsername(req.userId)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {roleLabel(req)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Manual Time</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {format(new Date(req.date), 'MMM d, yyyy')} • {req.clockInTime} – {req.clockOutTime}
                    {req.breakInTime && req.breakOutTime ? ` • Break: ${req.breakInTime}-${req.breakOutTime}` : ''}
                  </p>
                  {req.reason ? <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Note: {req.reason}</p> : null}
                </td>
                <td className="px-4 py-5 text-center sm:px-6">
                  {req.status === 'Pending' && (
                    <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">
                      <Clock className="mr-1 h-3 w-3" /> Pending
                    </span>
                  )}
                  {req.status === 'Approved' && (
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
                    </span>
                  )}
                  {req.status === 'Rejected' && (
                    <span className="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      <XCircle className="mr-1 h-3 w-3" /> Rejected
                    </span>
                  )}
                </td>
                <td className="px-4 py-5 text-right sm:px-6">
                  {req.status === 'Pending' && canReview ? (
                    <div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onApprove(req.id)}
                          className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRejectId(req.id);
                            setRejectFeedback('');
                          }}
                          className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-rose-700 transition-all hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/45"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {activeRejectId === req.id && (
                        <div className="mt-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3 text-left">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Rejection feedback (required)
                          </p>
                          <textarea
                            value={rejectFeedback}
                            onChange={(e) => setRejectFeedback(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-700 dark:text-slate-200 outline-none transition hover:border-slate-200 dark:hover:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                            placeholder="Provide feedback..."
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onRejectConfirm(req.id)}
                              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                            >
                              Confirm Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRejectId(null);
                                setRejectFeedback('');
                              }}
                              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
