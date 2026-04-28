'use client';

import { format } from 'date-fns';
import { Send, Plus } from 'lucide-react';
import type { ManualTimeRequest } from '@/lib/store';
import { FIELD_CLASS, FIELD_CLASS_NEUTRAL, PRIMARY_ACTION_BTN_CLASS } from './constants';
import { manualEmptyMessage } from './copy';
import type { RequestStatusFilter } from './types';
import { RequestModal } from './RequestModal';
import { RequestStatusBadge } from './RequestStatusBadge';

type ManualForm = {
  manualDate: string;
  setManualDate: (v: string) => void;
  clockInTime: string;
  setClockInTime: (v: string) => void;
  clockOutTime: string;
  setClockOutTime: (v: string) => void;
  breakInTime: string;
  setBreakInTime: (v: string) => void;
  breakOutTime: string;
  setBreakOutTime: (v: string) => void;
  manualReason: string;
  setManualReason: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

type ManualTimeRequestsPanelProps = {
  manualStatusFilter: RequestStatusFilter;
  rows: ManualTimeRequest[];
  totalCount: number;
  formOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
  form: ManualForm;
};

export function ManualTimeRequestsPanel({
  manualStatusFilter,
  rows,
  totalCount,
  formOpen,
  onCloseModal,
  onOpenModal,
  form,
}: ManualTimeRequestsPanelProps) {
  const {
    manualDate,
    setManualDate,
    clockInTime,
    setClockInTime,
    clockOutTime,
    setClockOutTime,
    breakInTime,
    setBreakInTime,
    breakOutTime,
    setBreakOutTime,
    manualReason,
    setManualReason,
    onSubmit,
  } = form;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" className={PRIMARY_ACTION_BTN_CLASS} onClick={onOpenModal}>
          <Plus className="h-4 w-4" />
          Request manual time
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
                  Date
                </th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
                  Time
                </th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
                  Status
                </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-20 text-center text-sm font-medium text-slate-500">
                  {manualEmptyMessage(manualStatusFilter, totalCount)}
                </td>
              </tr>
            ) : (
              rows.map((req) => (
                <tr key={req.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-5 font-medium text-slate-900 sm:px-6">
                    {format(new Date(req.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">
                    {req.clockInTime} – {req.clockOutTime}
                    {req.breakInTime && req.breakOutTime ? (
                      <span className="block text-xs text-slate-400">
                        Break: {req.breakInTime}-{req.breakOutTime}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-5 sm:px-6">
                    <RequestStatusBadge status={req.status} />
                    {req.status === 'Rejected' && req.feedback ? (
                      <p className="mt-2 max-w-xs rounded-lg border border-rose-100 bg-rose-50 p-2 text-xs text-rose-800">
                        {req.feedback}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RequestModal
        open={formOpen}
        onClose={onCloseModal}
        title="Request manual time"
        titleId="manual-modal-title"
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Date</label>
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className={FIELD_CLASS_NEUTRAL}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Clock-in</label>
              <input
                type="time"
                required
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className={FIELD_CLASS_NEUTRAL}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Clock-out</label>
              <input
                type="time"
                required
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className={FIELD_CLASS_NEUTRAL}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Break-in (optional)</label>
              <input
                type="time"
                value={breakInTime}
                onChange={(e) => setBreakInTime(e.target.value)}
                className={FIELD_CLASS_NEUTRAL}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Break-out (optional)</label>
            <input
              type="time"
              value={breakOutTime}
              onChange={(e) => setBreakOutTime(e.target.value)}
              className={FIELD_CLASS_NEUTRAL}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
            <textarea
              rows={3}
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className={FIELD_CLASS_NEUTRAL}
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
            Submit manual time request
          </button>
        </form>
      </RequestModal>
    </>
  );
}
