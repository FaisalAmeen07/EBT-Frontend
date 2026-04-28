'use client';

import { format } from 'date-fns';
import { Send, Plus } from 'lucide-react';
import type { LeaveRequest, LeaveType } from '@/lib/store';
import { PRIMARY_ACTION_BTN_CLASS, FIELD_CLASS } from './constants';
import { leaveEmptyMessage } from './copy';
import type { RequestStatusFilter } from './types';
import { RequestModal } from './RequestModal';
import { RequestStatusBadge } from './RequestStatusBadge';

type LeaveForm = {
  leaveType: LeaveType;
  setLeaveType: (v: LeaveType) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

type LeaveRequestsPanelProps = {
  LeavetatusFilter: RequestStatusFilter;
  rows: LeaveRequest[];
  totalCount: number;
  formOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
  form: LeaveForm;
};

export function LeaveRequestsPanel({
  LeavetatusFilter,
  rows,
  totalCount,
  formOpen,
  onCloseModal,
  onOpenModal,
  form,
}: LeaveRequestsPanelProps) {
  const {
    leaveType,
    setLeaveType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    reason,
    setReason,
    onSubmit,
  } = form;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" className={PRIMARY_ACTION_BTN_CLASS} onClick={onOpenModal}>
          <Plus className="h-4 w-4" />
          Apply for leave
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
                  Type
                </th>
                <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-6">
                  Dates
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
                  {leaveEmptyMessage(LeavetatusFilter, totalCount)}
                </td>
              </tr>
            ) : (
              rows.map((leave) => (
                <tr key={leave.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-5 sm:px-6">
                    <span className="font-semibold text-slate-900">{leave.type}</span>
                    <p className="mt-1 line-clamp-2 max-w-xs text-xs text-slate-500">{leave.reason || '—'}</p>
                  </td>
                  <td className="px-4 py-5 text-sm text-slate-600 sm:px-6">
                    {format(new Date(leave.startDate), 'MMM d, yyyy')} – {format(new Date(leave.endDate), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-5 sm:px-6">
                    <RequestStatusBadge status={leave.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RequestModal open={formOpen} onClose={onCloseModal} title="Apply for leave" titleId="leave-modal-title">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Leave type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className={FIELD_CLASS}
            >
              <option value="Leave">Leave</option>
              <option value="Casual">Casual</option>
              <option value="Paid">Paid (Annual)</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Start date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">End date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Details…"
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
            Submit request
          </button>
        </form>
      </RequestModal>
    </>
  );
}
