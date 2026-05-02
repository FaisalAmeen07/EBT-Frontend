import { isAxiosError } from 'axios';
import { API_PATHS } from '@/lib/api/api-base-urls';
import { attendanceApiClient } from '@/lib/api/attendance-api.config';
import type { TimesheetEntry } from '@/lib/store';

type AttendanceRow = {
  id: number;
  user_id: number;
  check_in: string;
  check_out: string | null;
  total_minutes: number | null;
  break_duration?: number | null;
  break_end?: string | null;
  timer_paused?: boolean | null;
  is_late: boolean | null;
  status: string | null;
  auto_break_start?: string | null;
};

export type ClockRecordRow = {
  sr: number;
  user_id: number;
  name?: string | null;
  user_name?: string | null;
  role: string;
  department?: string | null;
  gdc_id?: string | null;
  check_in: string;
  check_out?: string | null;
  hours: string;
  status: string;
  id: number;
};

export type ManualTimesheetRow = {
  sr: number;
  user_id: string;
  name?: string | null;
  user_name?: string | null;
  role: string;
  department?: string | null;
  gdc_id?: string | null;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  break_in?: string | null;
  break_out?: string | null;
  hours: string;
  status: string;
  id: string;
};

type ClockRecordsResponse = {
  period: string;
  total: number;
  rows: ClockRecordRow[];
};

type ManualTimesheetResponse = {
  period: string;
  total: number;
  rows: ManualTimesheetRow[];
};

type TodayStatusResponse = {
  success: boolean;
  data?: {
    name: string;
    role: string;
    gdc_id: string;
    today_status: string;
  };
};

type SevenDaysRow = {
  id: number;
  name: string;
  role: string;
  gdc_id: string | null;
  attendance: { date: string; day: string; attendance_status: string }[];
};

type ThirtyDaysRow = {
  id: number;
  name: string;
  role: string;
  gdc_id: string | null;
  on_time: number;
  late: number;
  absent: number;
  leave_days: number;
  leave: number;
};

export type AttendanceSummaryUser = {
  id: number | string;
  name: string;
  role: string;
  gdc_id?: string | null;
  attendance_status: string;
  live_status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
};

export type AttendanceSummaryData = {
  total: number;
  present: number;
  absent: number;
  leave: number;
  working: number;
  break: number;
  users: AttendanceSummaryUser[];
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) return fallback;
  const data = error.response?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    return String((data as { message: unknown }).message);
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const toTimesheet = (row: AttendanceRow): TimesheetEntry => {
  const totalHours =
    typeof row.total_minutes === 'number' && Number.isFinite(row.total_minutes)
      ? row.total_minutes / 60
      : undefined;
  const isBreakActive =
    !row.check_out &&
    (String(row.status ?? '').toUpperCase() === 'BREAK' || Boolean(row.timer_paused));
  const breakMinutesFromTimestamps =
    row.auto_break_start && row.break_end
      ? Math.max(0, Math.floor((new Date(row.break_end).getTime() - new Date(row.auto_break_start).getTime()) / 60000))
      : 0;
  const backendBreakMinutes =
    typeof row.break_duration === 'number' && Number.isFinite(row.break_duration) ? row.break_duration : 0;
  // Single source: DB counter is canonical; timestamps only if legacy row has no break_duration yet.
  const breakDurationMinutes =
    backendBreakMinutes > 0 ? backendBreakMinutes : breakMinutesFromTimestamps;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clockIn: row.check_in,
    clockOut: row.check_out ?? undefined,
    breaks: isBreakActive
      ? [
          {
            id: `break-${row.id}`,
            startTime: row.auto_break_start || row.check_in,
          },
        ]
      : [],
    breakDurationMinutes,
    totalHours,
    overtime: typeof totalHours === 'number' ? Math.max(0, totalHours - 8) : undefined,
    lateMark: Boolean(row.is_late),
  };
};

export async function fetchAttendanceRecordsApi(): Promise<TimesheetEntry[]> {
  const { data } = await attendanceApiClient.get<AttendanceRow[]>(API_PATHS.attendance.attendance);
  if (!Array.isArray(data)) return [];
  return data.map(toTimesheet);
}

export async function fetchClockRecordsApi(params?: {
  role?: string;
  department?: string;
  gdc_id?: string;
  from?: string;
  to?: string;
}): Promise<ClockRecordsResponse> {
  const { data } = await attendanceApiClient.get<ClockRecordsResponse>(API_PATHS.attendance.clockRecords, {
    params,
  });
  return {
    period: data?.period ?? '',
    total: Number(data?.total ?? 0),
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
}

export async function fetchManualTimesheetApi(params?: {
  role?: string;
  department?: string;
  gdc_id?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  from?: string;
  to?: string;
}): Promise<ManualTimesheetResponse> {
  const { data } = await attendanceApiClient.get<ManualTimesheetResponse>(API_PATHS.attendance.manualTimesheet, {
    params,
  });
  return {
    period: data?.period ?? '',
    total: Number(data?.total ?? 0),
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
}

export async function checkInApi(): Promise<void> {
  try {
    await attendanceApiClient.post(API_PATHS.attendance.checkIn);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to clock in.'));
  }
}

export async function checkOutApi(): Promise<void> {
  try {
    await attendanceApiClient.post(API_PATHS.attendance.checkOut);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to clock out.'));
  }
}

export async function endBreakApi(): Promise<void> {
  try {
    await attendanceApiClient.post(API_PATHS.attendance.breakEnd);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to end break.'));
  }
}

export async function fetchTodayAttendanceApi(): Promise<unknown[]> {
  const { data } = await attendanceApiClient.get<{ success: boolean; data: unknown[] }>(API_PATHS.attendance.today);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchWorkStatsApi(
  filter: 'today' | '7days' | '30days' = 'today'
): Promise<{ user_id: number; total_minutes: number } | null> {
  const { data } = await attendanceApiClient.get<{ success: boolean; data?: { user_id: number; total_minutes: number } }>(
    API_PATHS.attendance.workStats,
    { params: { filter } }
  );
  return data?.data ?? null;
}

export async function fetchClockHistoryApi(): Promise<unknown[]> {
  const { data } = await attendanceApiClient.get<{ success: boolean; data: unknown[] }>(API_PATHS.attendance.clockHistory);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchAttendanceSummaryApi(params?: {
  role?: 'ALL' | 'employee' | 'HR' | 'team_leader';
  attendance?: 'ALL' | 'PRESENT' | 'ABSENT' | 'LEAVE';
}): Promise<AttendanceSummaryData> {
  const { data } = await attendanceApiClient.get<{ success?: boolean; data?: AttendanceSummaryData }>(
    API_PATHS.attendance.attendanceSummary,
    { params }
  );
  const payload = data?.data;
  return {
    total: Number(payload?.total ?? 0),
    present: Number(payload?.present ?? 0),
    absent: Number(payload?.absent ?? 0),
    leave: Number(payload?.leave ?? 0),
    working: Number(payload?.working ?? 0),
    break: Number(payload?.break ?? 0),
    users: Array.isArray(payload?.users) ? payload!.users : [],
  };
}

export async function fetchTodayStatusApi(): Promise<TodayStatusResponse['data'] | null> {
  const { data } = await attendanceApiClient.get<TodayStatusResponse>(API_PATHS.attendance.todayStatus);
  return data?.data ?? null;
}

export async function fetchAttendance7DaysApi(params?: {
  role?: string;
  search?: string;
}): Promise<SevenDaysRow[]> {
  const { data } = await attendanceApiClient.get<{ success: boolean; data: SevenDaysRow[] }>(
    API_PATHS.attendance.attendance7Days,
    { params }
  );
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchAttendance30DaysApi(params?: {
  role?: string;
  search?: string;
  reference_date?: string;
}): Promise<{ period_start: string; period_end: string; users: ThirtyDaysRow[] }> {
  const { data } = await attendanceApiClient.get<{
    success: boolean;
    data: { period_start: string; period_end: string; users: ThirtyDaysRow[] };
  }>(API_PATHS.attendance.attendance30Days, { params });
  return data?.data ?? { period_start: '', period_end: '', users: [] };
}

export async function getCurrentShiftApi(): Promise<{
  shift_start: string | null;
  shift_end: string | null;
  effective_date: string | null;
}> {
  const { data } = await attendanceApiClient.get<{
    shift_start: string | null;
    shift_end: string | null;
    effective_date: string | null;
  }>(
    API_PATHS.attendance.currentShift
  );
  return data ?? { shift_start: null, shift_end: null, effective_date: null };
}

export async function getShiftStatusApi(): Promise<{ shift_id: number | null; is_enabled: boolean }> {
  const { data } = await attendanceApiClient.get<{ shift_id?: number | null; is_enabled: boolean }>(
    API_PATHS.attendance.shiftStatus
  );
  return { shift_id: data?.shift_id ?? null, is_enabled: Boolean(data?.is_enabled) };
}

export async function setShiftTimingApi(input: {
  shift_start: string;
  shift_end: string;
  effective_date: string;
}): Promise<void> {
  try {
    await attendanceApiClient.post(API_PATHS.attendance.shiftTiming, input);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to set shift timing.'));
  }
}

export async function setShiftStatusApi(input: { shift_id: number; is_enabled: boolean }): Promise<void> {
  try {
    await attendanceApiClient.post(API_PATHS.attendance.shiftStatus, input);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to update shift status.'));
  }
}

function toQueryString(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    q.set(k, v);
  }
  return q.toString();
}

export async function exportClockRecordsApi(params: {
  format: 'excel' | 'pdf';
  role?: string;
  department?: string;
  gdc_id?: string;
  from?: string;
  to?: string;
  id?: string;
}): Promise<void> {
  const query = toQueryString({
    format: params.format,
    role: params.role,
    department: params.department,
    gdc_id: params.gdc_id,
    from: params.from,
    to: params.to,
    id: params.id,
  });
  const url = `${API_PATHS.attendance.clockRecordsExport}${query ? `?${query}` : ''}`;
  const res = await attendanceApiClient.get<Blob>(url, { responseType: 'blob' });
  const contentType = String(res.headers['content-type'] || '');
  const ext = params.format === 'pdf' || contentType.includes('pdf') ? 'pdf' : 'xlsx';
  const blob = new Blob([res.data], { type: contentType || undefined });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `clock-records.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export async function exportManualTimesheetApi(params: {
  format: 'excel' | 'pdf';
  role?: string;
  department?: string;
  gdc_id?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  from?: string;
  to?: string;
  id?: string;
}): Promise<void> {
  const query = toQueryString({
    format: params.format,
    role: params.role,
    department: params.department,
    gdc_id: params.gdc_id,
    status: params.status,
    from: params.from,
    to: params.to,
    id: params.id,
  });
  const url = `${API_PATHS.attendance.manualTimesheetExport}${query ? `?${query}` : ''}`;
  const res = await attendanceApiClient.get<Blob>(url, { responseType: 'blob' });
  const contentType = String(res.headers['content-type'] || '');
  const ext = params.format === 'pdf' || contentType.includes('pdf') ? 'pdf' : 'xlsx';
  const blob = new Blob([res.data], { type: contentType || undefined });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `manual-timesheet.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
