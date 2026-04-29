'use client';

import { useMemo, useState, Fragment, useCallback, useEffect } from 'react';
import { useStore, useShallow } from '@/lib/store';
import type { ManualTimeRequest, User } from '@/lib/store';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import {
  AttendanceLogPagination,
  BulkActionBar,
  StandardFilterBar,
  AttendanceLogToolbar,
} from '@/components/attendance/attendanceLogUi';
import { formatHoursMinutes } from '@/components/attendance/attendanceLogUi';
import { downloadExcelCsv, openAttendancePdfReport } from '@/lib/attendanceExport';
import {
  COMPANY_SITE_OPTIONS,
  PROVIDER_ROLE_OPTIONS,
  HR_PROVIDER_FILTER_OPTIONS,
  employeeDisplayId,
  siteBucketForUser,
  providerLabelForRole,
  userMatchesAttendanceSearch,
} from '@/lib/attendanceSite';
import { filterManualTimeRequestsForViewer } from '@/lib/attendanceRules';
import { Calendar, Building2, User as UserIcon, Shield, FileSpreadsheet, FileDown, X } from 'lucide-react';

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type ManualGroupRow = {
  id: string;
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  requests: ManualTimeRequest[];
  totalHours: number;
  user?: User;
};

function hoursForManualRequest(r: ManualTimeRequest): number {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  let mins = parse(r.clockOutTime) - parse(r.clockInTime);
  if (r.breakInTime && r.breakOutTime) {
    mins -= parse(r.breakOutTime) - parse(r.breakInTime);
  }
  return Math.max(0, mins) / 60;
}

function buildManualGroups(requests: ManualTimeRequest[], users: User[]): ManualGroupRow[] {
  const approved = requests.filter((r) => r.status === 'Approved');
  const map = new Map<string, ManualTimeRequest[]>();

  for (const r of approved) {
    const d = new Date(r.date + 'T12:00:00');
    const ws = startOfWeek(d, { weekStartsOn: 1 });
    const key = `${r.userId}__${format(ws, 'yyyy-MM-dd')}`;
    const arr = map.get(key) || [];
    arr.push(r);
    map.set(key, arr);
  }

  const groups: ManualGroupRow[] = [];
  map.forEach((reqs, key) => {
    const [userId] = key.split('__');
    const ws = startOfWeek(new Date(reqs[0].date + 'T12:00:00'), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const total = reqs.reduce((acc, r) => acc + hoursForManualRequest(r), 0);
    const user = users.find((u) => u.id === userId);
    groups.push({
      id: key,
      userId,
      weekStart: ws,
      weekEnd: we,
      requests: reqs.sort((a, b) => a.date.localeCompare(b.date)),
      totalHours: total,
      user,
    });
  });

  return groups.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

export function ManualTimesheetLog() {
  const { manualTimeRequests, users, currentUser } = useStore(
    useShallow((s) => ({
      manualTimeRequests: s.manualTimeRequests,
      users: s.users,
      currentUser: s.currentUser,
    }))
  );
  const departments = useStore((s) => s.departments);

  const scopedRequests = useMemo(
    () => filterManualTimeRequestsForViewer(manualTimeRequests, users, currentUser),
    [manualTimeRequests, users, currentUser]
  );

  const allGroups = useMemo(() => buildManualGroups(scopedRequests, users), [scopedRequests, users]);

  const sites = useMemo(() => {
    const list = departments.length ? departments : [...COMPANY_SITE_OPTIONS];
    return ['All departments', ...list.filter((d) => d !== 'All departments')];
  }, [departments]);
  const providers = useMemo(() => {
    if (currentUser?.role === 'HR') return [...HR_PROVIDER_FILTER_OPTIONS];
    return [...PROVIDER_ROLE_OPTIONS];
  }, [currentUser?.role]);

  const isTeamLeaderViewer = currentUser?.role === 'Team Leader';

  const [siteFilter, setSiteFilter] = useState('All departments');
  const [providerFilter, setProviderFilter] = useState('All providers');
  const [idQuery, setIdQuery] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailModal, setDetailModal] = useState<ManualGroupRow | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    return allGroups.filter((g) => {
      const bucket = siteBucketForUser(g.user);
      if (siteFilter !== 'All departments' && bucket !== siteFilter) return false;

      if (providerFilter !== 'All providers') {
        const pl = g.user ? providerLabelForRole(g.user.role) : 'Other';
        if (providerFilter === 'Employees' && pl !== 'Employees') return false;
        if (providerFilter === 'HR' && pl !== 'HR') return false;
        if (providerFilter === 'Team Leader' && pl !== 'Team Leader') return false;
      }

      if (!userMatchesAttendanceSearch(g.user, g.userId, idQuery)) return false;

      if (rangeStart) {
        const rs = new Date(rangeStart);
        if (g.weekEnd < rs) return false;
      }
      if (rangeEnd) {
        const re = new Date(rangeEnd);
        re.setHours(23, 59, 59, 999);
        if (g.weekStart > re) return false;
      }
      return true;
    });
  }, [allGroups, siteFilter, providerFilter, idQuery, rangeStart, rangeEnd]);

  const exportTargetGroups = useCallback(() => {
    if (selected.size === 0) return filtered;
    return filtered.filter((g) => selected.has(g.id));
  }, [filtered, selected]);

  const handleExportExcel = useCallback(() => {
    const rows = exportTargetGroups();
    if (rows.length === 0) return;
    const header = ['Employee', 'Department', 'Provider', 'Period start', 'Period end', 'Hours', 'ID'];
    const data = rows.map((g) => {
      const site = siteBucketForUser(g.user);
      const prov = g.user ? providerLabelForRole(g.user.role) : '—';
      return [
        g.user?.name ?? 'Unknown',
        site,
        prov,
        format(g.weekStart, 'yyyy-MM-dd'),
        format(g.weekEnd, 'yyyy-MM-dd'),
        formatHoursMinutes(g.totalHours),
        employeeDisplayId(g.user, g.userId),
      ];
    });
    downloadExcelCsv(`manual-timesheet-${format(new Date(), 'yyyy-MM-dd')}`, header, data);
  }, [exportTargetGroups]);

  const handleExportPdf = useCallback(() => {
    const rows = exportTargetGroups();
    if (rows.length === 0) return;
    const body = `
      <table>
        <thead><tr>
          <th>Employee</th><th>Department</th><th>Provider</th><th>Period</th><th>Hours</th><th>ID</th>
        </tr></thead>
        <tbody>
          ${rows
            .map((g) => {
              const site = siteBucketForUser(g.user);
              const prov = g.user ? providerLabelForRole(g.user.role) : '—';
              const period = `${format(g.weekStart, 'MM/dd/yyyy')} – ${format(g.weekEnd, 'MM/dd/yyyy')}`;
              return `<tr>
                <td>${escapeAttr(g.user?.name ?? 'Unknown')}</td>
                <td>${escapeAttr(site)}</td>
                <td>${escapeAttr(prov)}</td>
                <td>${escapeAttr(period)}</td>
                <td>${escapeAttr(formatHoursMinutes(g.totalHours))}</td>
                <td>${escapeAttr(employeeDisplayId(g.user, g.userId))}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
    openAttendancePdfReport('Manual timesheet (approved)', body);
  }, [exportTargetGroups]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const paginated = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((p) => p.id)));
  };

  useEffect(() => {
    if (!detailModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailModal]);

  return (
    <div className="space-y-4">
      <AttendanceLogToolbar
        title="Manual Timesheet"
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
            onFilterChange={resetPage}
            showSiteFilter={!isTeamLeaderViewer}
            showProviderFilter={!isTeamLeaderViewer}
            idSearchPlaceholder={
              isTeamLeaderViewer
                ? 'Team member — ID, code, or name'
                : 'Unique ID, code, email, or name'
            }
          />
        }
        actions={
          <BulkActionBar
            selectedSize={selected.size}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
          />
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-600 text-white">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selected.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-white/30"
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Sr#</th>
                <th className="px-3 py-3 font-semibold">Name / role</th>
                <th className="px-3 py-3 font-semibold">Department</th>
                <th className="px-3 py-3 font-semibold">Period</th>
                <th className="px-3 py-3 font-semibold">Hours</th>
                <th className="px-3 py-3 font-semibold">ID</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    No approved manual timesheet periods match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((g, idx) => {
                  const sr = (pageSafe - 1) * rowsPerPage + idx + 1;
                  const site = siteBucketForUser(g.user);
                  const period = `${format(g.weekStart, 'MM/dd/yyyy')} - ${format(g.weekEnd, 'MM/dd/yyyy')}`;
                  const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80';

                  return (
                    <Fragment key={g.id}>
                      <tr
                        className={`${zebra} cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/40`}
                        onClick={() => setDetailModal(g)}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(g.id)}
                            onChange={() => toggleSelect(g.id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">{sr}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{g.user?.name ?? 'Unknown'}</div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {g.user?.role ?? '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{site}</td>
                        <td className="px-3 py-3 text-slate-600">{period}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums text-slate-900">
                          {formatHoursMinutes(g.totalHours)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700" onClick={(e) => e.stopPropagation()}>
                          {employeeDisplayId(g.user, g.userId)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <AttendanceLogPagination
          pageSafe={pageSafe}
          totalPages={totalPages}
          filteredLen={filtered.length}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          setPage={setPage}
        />
      </div>

      {detailModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModal(null);
          }}
        >
          <div
            className="flex max-h-[min(92dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
              <h3 id="manual-detail-title" className="text-base font-bold text-slate-900 sm:text-lg">
                Manual timesheet detail
              </h3>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ManualDetailPanel group={detailModal} onClose={() => setDetailModal(null)} embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualDetailPanel({
  group,
  onClose,
  embedded,
}: {
  group: ManualGroupRow;
  onClose: () => void;
  /** When true, rendered inside modal (lighter chrome). */
  embedded?: boolean;
}) {
  const site = siteBucketForUser(group.user);
  const periodLabel = `${format(group.weekStart, 'MMM d')} - ${format(group.weekEnd, 'MMM d, yyyy')}`;
  const idLine = employeeDisplayId(group.user, group.userId);

  const exportPanelExcel = () => {
    const header = ['Sr#', 'Date', 'Clock In', 'Clock Out', 'Hours', 'ID'];
    const data = group.requests.map((r, i) => [
      i + 1,
      r.date,
      r.clockInTime,
      r.clockOutTime,
      hoursForManualRequest(r).toFixed(2),
      idLine,
    ]);
    const safeName = (group.user?.name ?? 'employee').replace(/[^\w\-]+/g, '_');
    downloadExcelCsv(`manual-timesheet-${safeName}-${format(group.weekStart, 'yyyy-MM-dd')}`, header, data);
  };

  const exportPanelPdf = () => {
    const prov = group.user ? providerLabelForRole(group.user.role) : '—';
    const rows = group.requests
      .map(
        (r, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${escapeAttr(format(new Date(r.date + 'T12:00:00'), 'MM/dd/yyyy'))}</td>
            <td>${escapeAttr(r.clockInTime)} → ${escapeAttr(r.clockOutTime)}</td>
            <td>${hoursForManualRequest(r).toFixed(2)}</td>
            <td>${escapeAttr(idLine)}</td>
          </tr>`
      )
      .join('');
    const body = `
      <p><strong>Employee:</strong> ${escapeAttr(group.user?.name ?? 'Unknown')} &nbsp;|&nbsp; <strong>Department:</strong> ${escapeAttr(site)} &nbsp;|&nbsp; <strong>Provider:</strong> ${escapeAttr(prov)}</p>
      <p><strong>Period:</strong> ${escapeAttr(periodLabel)} &nbsp;|&nbsp; <strong>Total:</strong> ${escapeAttr(formatHoursMinutes(group.totalHours))}</p>
      <table>
        <thead><tr><th>Sr#</th><th>Date</th><th>In / Out</th><th>Hours</th><th>ID</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    openAttendancePdfReport(`Manual timesheet — ${group.user?.name ?? 'Employee'}`, body);
  };

  return (
    <div className={`${embedded ? 'bg-white p-4 sm:p-6' : 'bg-slate-50/90 p-4 sm:p-6'}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Manual timesheet (approved)</h3>
          <p className="text-xs text-slate-500">
            {embedded ? 'Approved entries for this week.' : 'Approved entries — click row again to collapse'}
          </p>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 p-4 shadow-inner">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">{periodLabel}</span>
          </div>
          <span className="text-lg font-bold text-blue-600">{formatHoursMinutes(group.totalHours)}</span>
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
            <span>
              <span className="text-slate-500">Department: </span>
              {site}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <span>{group.user?.name ?? 'Unknown'}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {group.user?.role ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-mono text-xs">ID: {idLine}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">Daily entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-3 py-2">Sr#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">In / Out</th>
                <th className="px-3 py-2">Hours</th>
                <th className="px-3 py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {group.requests.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                  <td className="border-b border-slate-100 px-3 py-2">{i + 1}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{format(new Date(r.date + 'T12:00:00'), 'MM/dd/yyyy')}</td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {r.clockInTime} → {r.clockOutTime}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 font-medium tabular-nums">
                    {hoursForManualRequest(r).toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 font-mono text-[10px] text-slate-700">{idLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportPanelExcel}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button
          type="button"
          onClick={exportPanelPdf}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 hover:bg-rose-100"
        >
          <FileDown className="h-4 w-4" />
          PDF
        </button>
      </div>
    </div>
  );
}
