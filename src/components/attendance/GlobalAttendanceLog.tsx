'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AttendanceLogPagination,
  BulkActionBar,
  StandardFilterBar,
  AttendanceLogToolbar,
} from '@/components/attendance/attendanceLogUi';
import {
  exportClockRecordsApi,
  fetchClockRecordsApi,
  type ClockRecordRow,
} from '@/services/attendance.service';
import { useStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { X } from 'lucide-react';

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapProviderFilter(value: string): string | undefined {
  if (value === 'Employees') return 'employee';
  if (value === 'HR') return 'hr';
  if (value === 'Team Leader') return 'team_leader';
  return undefined;
}

function dateOnly(value?: string | null): string {
  if (!value) return '—';
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timeOnly(value?: string | null): string {
  if (!value) return '—';
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return String(value).slice(0, 5);
}

export function GlobalAttendanceLog() {
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const currentUserId = currentUser?.id;
  const [rows, setRows] = useState<ClockRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailRow, setDetailRow] = useState<ClockRecordRow | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');

  const [siteFilter, setSiteFilter] = useState('All departments');
  const [providerFilter, setProviderFilter] = useState('All providers');
  const [idQuery, setIdQuery] = useState('');
  const [rangeStart, setRangeStart] = useState(() => todayDateInputValue());
  const [rangeEnd, setRangeEnd] = useState(() => todayDateInputValue());
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isTeamLeaderViewer = currentUser?.role === 'Team Leader';
  const providers = useMemo(() => {
    if (currentUser?.role === 'HR') return ['All providers', 'Employees', 'Team Leader'];
    if (isTeamLeaderViewer) return ['All providers'];
    return ['All providers', 'Employees', 'HR', 'Team Leader'];
  }, [currentUser?.role, isTeamLeaderViewer]);
  const sites = useMemo(() => {
    const list = [...new Set(rows.map((r) => (r.department || '').trim()).filter(Boolean))];
    return ['All departments', ...list];
  }, [rows]);

  const effectiveRangeStart = rangeStart || (!rangeEnd ? todayDateInputValue() : '');
  const effectiveRangeEnd = rangeEnd || (!rangeStart ? todayDateInputValue() : '');

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchClockRecordsApi({
          role: mapProviderFilter(providerFilter),
          department: siteFilter === 'All departments' ? undefined : siteFilter,
          gdc_id: idQuery.trim() || undefined,
          from: effectiveRangeStart || undefined,
          to: effectiveRangeEnd || undefined,
        });
        if (!cancelled) {
          setRows(data.rows);
          setPeriodLabel(data.period || '');
          setSelected(new Set());
          setPage(1);
        }
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'Unable to load clock records.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, providerFilter, siteFilter, idQuery, effectiveRangeStart, effectiveRangeEnd]);

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const paginated = rows.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (paginated.length === 0) return;
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((r) => String(r.id))));
  };

  const exportParams = {
    role: mapProviderFilter(providerFilter),
    department: siteFilter === 'All departments' ? undefined : siteFilter,
    gdc_id: idQuery.trim() || undefined,
    from: effectiveRangeStart || undefined,
    to: effectiveRangeEnd || undefined,
  };
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      const name = String(u?.name || '').trim();
      if (!name) continue;
      map.set(String(u.id), name);
    }
    return map;
  }, [users]);

  const resolveRowName = (row: ClockRecordRow): string => {
    const apiName = String(row.name || row.user_name || '').trim();
    if (apiName) return apiName;
    const mappedName = userNameById.get(String(row.user_id));
    if (mappedName) return mappedName;
    return '—';
  };

  return (
    <div className="space-y-4">
      <AttendanceLogToolbar
        title="Global attendance log"
        filters={
          <StandardFilterBar
            sites={sites}
            providers={providers}
            siteFilter={siteFilter}
            setSiteFilter={setSiteFilter}
            providerFilter={providerFilter}
            setProviderFilter={setProviderFilter}
            idQuery={idQuery}
            setIdQuery={setIdQuery}
            rangeStart={rangeStart}
            setRangeStart={setRangeStart}
            rangeEnd={rangeEnd}
            setRangeEnd={setRangeEnd}
            onFilterChange={() => setPage(1)}
            showSiteFilter={!isTeamLeaderViewer}
            showProviderFilter={!isTeamLeaderViewer}
            idSearchPlaceholder="GDC-ID search"
          />
        }
        actions={
          <BulkActionBar
            selectedSize={selected.size}
            onExportPdf={() =>
              void exportClockRecordsApi({ format: 'pdf', ...exportParams }).catch((error) =>
                toast(error instanceof Error ? error.message : 'Export failed.', 'error')
              )
            }
          />
        }
      />

      {periodLabel ? <p className="text-xs font-semibold text-slate-500">Period: {periodLabel}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-blue-600 text-white">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selected.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-white/30"
                  />
                </th>
                <th className="px-3 py-3">Sr#</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">GDC-ID</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No clock records found.
                  </td>
                </tr>
              ) : (
                paginated.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} cursor-pointer hover:bg-blue-50/60`}
                    onClick={() => setDetailRow(r)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(String(r.id))}
                        onChange={() => toggleSelect(String(r.id))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3">{r.sr}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {resolveRowName(r)}
                    </td>
                    <td className="px-3 py-3">{r.gdc_id || '—'}</td>
                    <td className="px-3 py-3">{r.role || '—'}</td>
                    <td className="px-3 py-3">{r.department || '—'}</td>
                    <td className="px-3 py-3">{r.hours || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AttendanceLogPagination
          pageSafe={pageSafe}
          totalPages={totalPages}
          filteredLen={rows.length}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          setPage={setPage}
        />
      </div>

      {detailRow ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailRow(null);
          }}
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-clock-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 id="global-clock-detail-title" className="text-2xl font-bold text-slate-900">
                Clock Records
              </h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(92vh-72px)] space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-sky-600">{periodLabel || 'Selected period'}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{detailRow.department || '—'}</p>
                    <p className="mt-1 text-slate-700">{resolveRowName(detailRow)}</p>
                    <p className="text-slate-700">{detailRow.gdc_id || '—'}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Status: <span className="font-semibold">{detailRow.status || '—'}</span>
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-sky-600">{detailRow.hours || '—'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm text-slate-500">
                  <span>PDF preview</span>
                  <span>1 / 1</span>
                </div>
                <div className="overflow-x-auto p-4">
                  <div className="mx-auto aspect-[1.35] min-w-[900px] max-w-4xl rounded border border-slate-300 bg-white p-5 shadow-inner">
                    <div className="mb-5 flex items-start justify-between">
                      <div>
                        <p className="text-3xl font-bold text-sky-600">{resolveRowName(detailRow)}</p>
                        <p className="text-base text-slate-500">{periodLabel || 'Selected period'}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p className="rounded bg-sky-500 px-3 py-1 font-semibold text-white">Hours {detailRow.hours || '—'}</p>
                      </div>
                    </div>
                    <div className="mb-4 grid grid-cols-4 gap-2 text-xs">
                      <div className="rounded border border-sky-300 bg-sky-500 p-2 font-semibold text-white">Work Hours<br />{detailRow.hours || '—'}</div>
                      <div className="rounded border border-sky-300 bg-sky-500 p-2 font-semibold text-white">Total Paid Hours<br />{detailRow.hours || '—'}</div>
                      <div className="rounded border border-slate-300 bg-slate-100 p-2 font-semibold text-slate-700">Regular<br />{detailRow.hours || '—'}</div>
                      <div className="rounded border border-slate-300 bg-slate-100 p-2 font-semibold text-slate-700">Overtime<br />0h 0m</div>
                    </div>
                    <div className="overflow-hidden rounded border border-slate-300">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-2 py-1 text-left">Date</th>
                            <th className="px-2 py-1 text-left">Department</th>
                            <th className="px-2 py-1 text-left">Role</th>
                            <th className="px-2 py-1 text-left">Clock in</th>
                            <th className="px-2 py-1 text-left">Clock out</th>
                            <th className="px-2 py-1 text-left">Total hrs</th>
                            <th className="px-2 py-1 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-200">
                            <td className="px-2 py-1">{dateOnly(detailRow.check_in)}</td>
                            <td className="px-2 py-1">{detailRow.department || '—'}</td>
                            <td className="px-2 py-1">{detailRow.role || '—'}</td>
                            <td className="px-2 py-1">{timeOnly(detailRow.check_in)}</td>
                            <td className="px-2 py-1">{timeOnly(detailRow.check_out)}</td>
                            <td className="px-2 py-1">{detailRow.hours || '—'}</td>
                            <td className="px-2 py-1">{detailRow.status || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void exportClockRecordsApi({
                      format: 'pdf',
                      role: exportParams.role,
                      department: exportParams.department,
                      id: String(detailRow.id),
                    }).catch((error) =>
                      toast(error instanceof Error ? error.message : 'PDF download failed.', 'error')
                    )
                  }
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
