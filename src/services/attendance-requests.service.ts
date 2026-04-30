import { isAxiosError } from 'axios';
import { API_PATHS } from '@/lib/api/api-base-urls';
import { attendanceApiClient } from '@/lib/api/attendance-api.config';
import type { LeaveRequest, LeaveType, ManualTimeRequest } from '@/lib/store';

type ApiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ApiLeaveType = 'LEAVE' | 'CASUAL' | 'ANNUAL';

type LeaveRow = {
  id: string;
  user_id: string;
  requester_name?: string | null;
  leave_type: ApiLeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: ApiStatus;
  created_at: string;
};

type ManualRow = {
  id: string;
  user_id: string;
  requester_name?: string | null;
  date: string;
  check_in: string | null;
  check_out: string | null;
  break_in: string | null;
  break_out: string | null;
  reason: string | null;
  status: ApiStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  created_at: string;
};

type CreatedResponse<T> = {
  message: string;
  data: T;
};

const leaveTypeToApi = (value: LeaveType): ApiLeaveType => {
  if (value === 'Leave') return 'LEAVE';
  if (value === 'Casual') return 'CASUAL';
  return 'ANNUAL';
};

const leaveTypeFromApi = (value: ApiLeaveType): LeaveType => {
  if (value === 'LEAVE') return 'Leave';
  if (value === 'CASUAL') return 'Casual';
  return 'Paid';
};

const statusFromApi = (value: ApiStatus): 'Pending' | 'Approved' | 'Rejected' => {
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  return 'Pending';
};

const normalizeTime = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.slice(0, 5);
};

const toLeaveRequest = (row: LeaveRow): LeaveRequest => ({
  id: row.id,
  userId: row.user_id,
  requesterName: row.requester_name ?? undefined,
  type: leaveTypeFromApi(row.leave_type),
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? '',
  status: statusFromApi(row.status),
  createdAt: row.created_at,
});

const toManualRequest = (row: ManualRow): ManualTimeRequest => ({
  id: row.id,
  userId: row.user_id,
  requesterName: row.requester_name ?? undefined,
  date: row.date,
  clockInTime: normalizeTime(row.check_in),
  clockOutTime: normalizeTime(row.check_out),
  breakInTime: normalizeTime(row.break_in) || undefined,
  breakOutTime: normalizeTime(row.break_out) || undefined,
  reason: row.reason ?? undefined,
  status: statusFromApi(row.status),
  createdAt: row.created_at,
  reviewedById: row.approved_by ?? undefined,
  feedback: row.rejection_reason ?? undefined,
});

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

export async function fetchLeaveRequestsApi(): Promise<LeaveRequest[]> {
  const { data } = await attendanceApiClient.get<LeaveRow[]>(API_PATHS.attendance.getLeave);
  return Array.isArray(data) ? data.map(toLeaveRequest) : [];
}

export async function createLeaveRequestApi(input: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<LeaveRequest> {
  try {
    const payload = {
      leave_type: leaveTypeToApi(input.type),
      start_date: input.startDate,
      end_date: input.endDate,
      reason: input.reason?.trim() || undefined,
    };
    const { data } = await attendanceApiClient.post<CreatedResponse<LeaveRow>>(
      API_PATHS.attendance.createLeave,
      payload
    );
    return toLeaveRequest(data.data);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to submit leave request.'));
  }
}

export async function approveLeaveRequestApi(id: string): Promise<void> {
  try {
    await attendanceApiClient.put(API_PATHS.attendance.approveLeave(id));
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to approve leave request.'));
  }
}

export async function rejectLeaveRequestApi(id: string, reason: string): Promise<void> {
  try {
    await attendanceApiClient.put(API_PATHS.attendance.rejectLeave(id), {
      rejection_reason: reason,
    });
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to reject leave request.'));
  }
}

export async function fetchManualRequestsApi(): Promise<ManualTimeRequest[]> {
  const { data } = await attendanceApiClient.get<ManualRow[]>(API_PATHS.attendance.getManualTime);
  return Array.isArray(data) ? data.map(toManualRequest) : [];
}

export async function createManualRequestApi(input: {
  date: string;
  clockInTime: string;
  clockOutTime: string;
  breakInTime?: string;
  breakOutTime?: string;
  reason?: string;
}): Promise<ManualTimeRequest> {
  try {
    const payload = {
      date: input.date,
      check_in: input.clockInTime,
      check_out: input.clockOutTime,
      break_in: input.breakInTime || undefined,
      break_out: input.breakOutTime || undefined,
      reason: input.reason?.trim() || undefined,
    };
    const { data } = await attendanceApiClient.post<CreatedResponse<ManualRow>>(
      API_PATHS.attendance.createManualTime,
      payload
    );
    return toManualRequest(data.data);
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to submit manual time request.'));
  }
}

export async function approveManualRequestApi(id: string): Promise<void> {
  try {
    await attendanceApiClient.put(API_PATHS.attendance.approveManualTime(id));
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to approve manual request.'));
  }
}

export async function rejectManualRequestApi(id: string, reason: string): Promise<void> {
  try {
    await attendanceApiClient.put(API_PATHS.attendance.rejectManualTime(id), {
      rejection_reason: reason,
    });
  } catch (error) {
    throw new Error(errorMessage(error, 'Unable to reject manual request.'));
  }
}
