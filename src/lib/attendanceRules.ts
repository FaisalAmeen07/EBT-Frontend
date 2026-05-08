import { format, isSameDay, startOfDay } from 'date-fns';
import type { TimesheetEntry, User } from '@/lib/store';

/** Fallback shift start when admin/API timings are not loaded yet (local time). */
export const OFFICE_START_HOUR = 9;
export const OFFICE_START_MINUTE = 0;
export const OFFICE_SHIFT_DURATION_MINUTES = 9 * 60;

/** Parsed admin current shift (from `/api/current-shift`). Overrides fallback start/end for attendance rules. */
export type CompanyShiftTimes = {
  start: { hour: number; minute: number } | null;
  end: { hour: number; minute: number } | null;
};

/** Parse `HH:mm` or `HH:mm:ss` from the shift API; invalid → null. */
export function parseShiftTimeToHm(value: string | null | undefined): { hour: number; minute: number } | null {
  if (value == null || typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

export function companyShiftTimesFromApi(
  shift_start: string | null,
  shift_end: string | null
): CompanyShiftTimes {
  return {
    start: parseShiftTimeToHm(shift_start),
    end: parseShiftTimeToHm(shift_end),
  };
}

/** Late if clock-in is after office start + this many minutes. */
export const LATE_AFTER_MINUTES = 15;

/** Absent if there is still no clock-in by start + this many minutes. */
export const ABSENT_AFTER_MINUTES = 45;
/** Hard clock-in cutoff: block new clock-ins after office start + this many minutes. */
export const CLOCK_IN_CUTOFF_AFTER_START_MINUTES = 60;

/** Admin-set office timings for a calendar day (YYYY-MM-DD, local) — applies to all staff. */
export type AttendanceDayOverride = {
  hour: number;
  minute: number;
  endHour?: number;
  endMinute?: number;
};
export type AttendanceDayOverridesMap = Record<string, AttendanceDayOverride>;

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getOfficeStartForDay(
  day: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): {
  hour: number;
  minute: number;
} {
  const key = dateKeyLocal(day);
  const o = overrides?.[key];
  if (o && typeof o.hour === 'number' && typeof o.minute === 'number') {
    const hour = Math.min(23, Math.max(0, o.hour));
    const minute = Math.min(59, Math.max(0, o.minute));
    return { hour, minute };
  }
  if (companyShift?.start) {
    return { hour: companyShift.start.hour, minute: companyShift.start.minute };
  }
  return { hour: OFFICE_START_HOUR, minute: OFFICE_START_MINUTE };
}

export function getOfficeEndForDay(
  day: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): {
  hour: number;
  minute: number;
} {
  const key = dateKeyLocal(day);
  const o = overrides?.[key];
  if (o && typeof o.endHour === 'number' && typeof o.endMinute === 'number') {
    const hour = Math.min(23, Math.max(0, o.endHour));
    const minute = Math.min(59, Math.max(0, o.endMinute));
    return { hour, minute };
  }
  if (companyShift?.end) {
    return { hour: companyShift.end.hour, minute: companyShift.end.minute };
  }

  const start = getOfficeStartForDay(day, overrides, companyShift);
  const shiftEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.hour, start.minute, 0, 0);
  shiftEnd.setMinutes(shiftEnd.getMinutes() + OFFICE_SHIFT_DURATION_MINUTES);
  return { hour: shiftEnd.getHours(), minute: shiftEnd.getMinutes() };
}

function startMinutesForDay(
  day: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): number {
  const { hour, minute } = getOfficeStartForDay(day, overrides, companyShift);
  return hour * 60 + minute;
}

function localMinutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Late if clock-in is at or after office start + LATE_AFTER_MINUTES for that calendar day.
 * Pass `overrides` for per-day company start (Admin Time control).
 */
/**
 * Live dashboard clock-in is only allowed on or after this local time for "today".
 * Returns an error message if `now` is still before office start; otherwise null.
 * Admin bypasses in the UI / policies layer — call only for non-Admin roles.
 */
export function clockInBlockedBeforeOfficeStart(
  now: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): string | null {
  const { hour, minute } = getOfficeStartForDay(now, overrides, companyShift);
  const officeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (now.getTime() < officeStart.getTime()) {
    return `Clock-in opens at ${format(officeStart, 'h:mm a')} today (company office start).`;
  }
  return null;
}

/**
 * Block live clock-in after the allowed late window (e.g. start + 60 mins).
 */
export function clockInBlockedAfterLateWindow(
  now: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): string | null {
  const { hour, minute } = getOfficeStartForDay(now, overrides, companyShift);
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  cutoff.setMinutes(cutoff.getMinutes() + CLOCK_IN_CUTOFF_AFTER_START_MINUTES);
  if (now.getTime() > cutoff.getTime()) {
    return 'You are late. Clock-in is closed for today.';
  }
  return null;
}

/** Warning only: clock-in is still allowed, but user is beyond late grace window. */
export function clockInLateWarningAfterGrace(
  now: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): string | null {
  const { hour, minute } = getOfficeStartForDay(now, overrides, companyShift);
  const lateAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  lateAfter.setMinutes(lateAfter.getMinutes() + LATE_AFTER_MINUTES);
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  cutoff.setMinutes(cutoff.getMinutes() + CLOCK_IN_CUTOFF_AFTER_START_MINUTES);

  if (now.getTime() >= lateAfter.getTime() && now.getTime() <= cutoff.getTime()) {
    return 'You are late.';
  }
  return null;
}

export function isClockInLate(
  clockInIso: string,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): boolean {
  const day = new Date(clockInIso);
  const startMins = startMinutesForDay(day, overrides, companyShift);
  const thresholdMins = startMins + LATE_AFTER_MINUTES;
  const mins = localMinutesFromMidnight(clockInIso);
  return mins >= thresholdMins;
}

export type DayAttendanceUiStatus = 'on_time' | 'late' | 'absent' | 'pending';

/**
 * Per calendar day: first clock-in decides on-time vs late; no clock-in by absent cutoff → absent (when applicable).
 */
export function dayAttendanceStatus(
  userId: string,
  day: Date,
  timesheets: TimesheetEntry[],
  now: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): DayAttendanceUiStatus {
  const entries = timesheets.filter((t) => t.userId === userId && isSameDay(new Date(t.clockIn), day));
  if (entries.length > 0) {
    const first = [...entries].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime())[0];
    return isClockInLate(first.clockIn, overrides, companyShift) ? 'late' : 'on_time';
  }

  const todayStart = startOfDay(now);
  if (startOfDay(day).getTime() > todayStart.getTime()) {
    return 'pending';
  }

  const startMins = startMinutesForDay(day, overrides, companyShift);
  const absentCutoff = startOfDay(new Date(day));
  absentCutoff.setMinutes(startMins + ABSENT_AFTER_MINUTES);

  if (isSameDay(day, now) && now.getTime() < absentCutoff.getTime()) {
    return 'pending';
  }

  return 'absent';
}

/**
 * Users whose attendance rows a viewer may see (Admin / HR / TL).
 * Admin view: no Admin-role users. HR view: no Admin or HR. TL view: team members only, no Team Leaders.
 */
export function filterUsersForAttendanceViewer(currentUser: User | null, users: User[]): User[] {
  if (!currentUser) return [];
  const base = users.filter((u) => u.role !== 'Pending User');
  if (currentUser.role === 'Admin') {
    return base.filter((u) => u.role !== 'Admin');
  }
  if (currentUser.role === 'HR') {
    return base.filter((u) => u.role !== 'Admin' && u.role !== 'HR');
  }
  if (currentUser.role === 'Team Leader') {
    const team = currentUser.team?.trim();
    if (!team) return [];
    return base.filter(
      (u) => (u.team?.trim() ?? '') === team && u.role !== 'Team Leader'
    );
  }
  return [];
}

export function filterTimesheetsForViewer(
  timesheets: TimesheetEntry[],
  users: User[],
  currentUser: User | null
): TimesheetEntry[] {
  const allowedIds = new Set(filterUsersForAttendanceViewer(currentUser, users).map((u) => u.id));
  return timesheets.filter((t) => allowedIds.has(t.userId));
}

export function filterManualTimeRequestsForViewer<T extends { userId: string }>(
  rows: T[],
  users: User[],
  currentUser: User | null
): T[] {
  const allowedIds = new Set(filterUsersForAttendanceViewer(currentUser, users).map((u) => u.id));
  return rows.filter((r) => allowedIds.has(r.userId));
}

/** Rolling window of calendar days from `startDay` through `endDay` (inclusive), local dates. */
export function countStatusInRange(
  userId: string,
  days: Date[],
  timesheets: TimesheetEntry[],
  now: Date,
  overrides?: AttendanceDayOverridesMap | null,
  companyShift?: CompanyShiftTimes | null
): Record<DayAttendanceUiStatus, number> {
  const out: Record<DayAttendanceUiStatus, number> = {
    on_time: 0,
    late: 0,
    absent: 0,
    pending: 0,
  };
  for (const d of days) {
    const s = dayAttendanceStatus(userId, d, timesheets, now, overrides, companyShift);
    out[s] += 1;
  }
  return out;
}
