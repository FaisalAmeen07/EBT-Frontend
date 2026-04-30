'use client';

import { Fragment, type ReactNode } from 'react';
import {
  Menu,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileDown,
} from 'lucide-react';

export function formatHoursMinutes(totalHours: number) {
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60) % 60;
  return `${h}h ${m}m`;
}

/** Read-only status (not a dropdown). */
export function ApprovedStatusPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
      <Clock className="h-3.5 w-3.5 text-amber-500" />
      Approved
    </span>
  );
}

type PaginationProps = {
  pageSafe: number;
  totalPages: number;
  filteredLen: number;
  rowsPerPage: number;
  setRowsPerPage: (n: number) => void;
  setPage: (p: number | ((n: number) => number)) => void;
};

export function AttendanceLogPagination({
  pageSafe,
  totalPages,
  filteredLen,
  rowsPerPage,
  setRowsPerPage,
  setPage,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <label className="flex items-center gap-2">
        Rows per page:
        <select
          value={rowsPerPage}
          onChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(1);
          }}
          className="rounded border border-slate-200 px-2 py-1"
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span>
        {filteredLen === 0 ? 0 : (pageSafe - 1) * rowsPerPage + 1}-{Math.min(pageSafe * rowsPerPage, filteredLen)} of{' '}
        {filteredLen}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pageSafe <= 1}
          onClick={() => setPage(1)}
          className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
          aria-label="First page"
        >
          <ChevronsLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={pageSafe <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={pageSafe >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={pageSafe >= totalPages}
          onClick={() => setPage(totalPages)}
          className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Last page"
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function AttendanceLogToolbar({
  title,
  filters,
  actions,
}: {
  title: string;
  filters: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Menu className="h-6 w-6 shrink-0 text-slate-600 lg:hidden" aria-hidden />
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      {filters}
      {actions}
    </div>
  );
}

export function BulkActionBar({
  selectedSize,
  onExportExcel,
  onExportPdf,
}: {
  selectedSize: number;
  onExportExcel?: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs text-slate-500">
        {selectedSize > 0 ? `${selectedSize} selected` : 'All filtered rows'}
      </span>
      {onExportExcel ? (
        <button
          type="button"
          onClick={onExportExcel}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          Excel
        </button>
      ) : null}
      <button
        type="button"
        onClick={onExportPdf}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
      >
        <FileDown className="h-4 w-4" />
        PDF
      </button>
    </div>
  );
}

export function StandardFilterBar({
  sites,
  providers,
  siteFilter,
  setSiteFilter,
  providerFilter,
  setProviderFilter,
  idQuery,
  setIdQuery,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  onFilterChange,
  showSiteFilter = true,
  showProviderFilter = true,
  idSearchPlaceholder = 'Unique ID, code, or name',
}: {
  sites: string[];
  providers: string[];
  siteFilter: string;
  setSiteFilter: (v: string) => void;
  providerFilter: string;
  setProviderFilter: (v: string) => void;
  idQuery: string;
  setIdQuery: (v: string) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  onFilterChange: () => void;
  /** Admin / HR: department bucket. Hidden for team leads (team scope is fixed). */
  showSiteFilter?: boolean;
  /** Admin / HR: Employee vs HR vs TL. Hidden for team leads. */
  showProviderFilter?: boolean;
  idSearchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {showSiteFilter ? (
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
          Department
          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value);
              onFilterChange();
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
          >
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showProviderFilter ? (
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
          Role
          <select
            value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value);
              onFilterChange();
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
        Unique ID / search
        <input
          type="search"
          value={idQuery}
          placeholder={idSearchPlaceholder}
          onChange={(e) => {
            setIdQuery(e.target.value);
            onFilterChange();
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <label className="flex min-w-[120px] flex-col gap-1 text-xs font-semibold text-slate-500">
        From
        <input
          type="date"
          value={rangeStart}
          onChange={(e) => {
            setRangeStart(e.target.value);
            onFilterChange();
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <label className="flex min-w-[120px] flex-col gap-1 text-xs font-semibold text-slate-500">
        To
        <input
          type="date"
          value={rangeEnd}
          onChange={(e) => {
            setRangeEnd(e.target.value);
            onFilterChange();
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>
    </div>
  );
}

export { Fragment, Calendar };
