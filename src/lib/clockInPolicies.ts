import {
  clockInBlockedAfterLateWindow,
  clockInBlockedBeforeOfficeStart,
} from '@/lib/attendanceRules';
import { useStore } from '@/lib/store';
import { getCurrentLatLng, haversineMiles } from '@/lib/geoDistance';
import { getShiftStatusApi } from '@/services/attendance.service';

function radiusMilesForUser(): number {
  const s = useStore.getState();
  if (!s.geoFencingEnabled) return 0;
  if (s.geoFencingUseGlobalRadius) return Math.max(0, s.geoFencingGlobalRadiusMiles);
  const site = s.currentUser?.workSite?.trim();
  if (site && s.geoFencingSiteRadiusMiles[site] != null) {
    return Math.max(0, s.geoFencingSiteRadiusMiles[site]!);
  }
  return Math.max(0, s.geoFencingGlobalRadiusMiles);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isOnApprovedLeaveToday(
  leaves: { userId: string; status: string; startDate: string; endDate: string }[],
  userId: string,
  today: Date
): boolean {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return leaves.some((l) => {
    if (String(l.userId) !== String(userId)) return false;
    if (String(l.status || '').trim().toUpperCase() !== 'APPROVED') return false;
    const start = new Date(String(l.startDate || '').slice(0, 10));
    const end = new Date(String(l.endDate || '').slice(0, 10));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return day >= startDay && day <= endDay;
  });
}

/**
 * Clock in with admin policies: ad-hoc master switch, optional geo-fence.
 * Call from the dashboard Clock In button (async).
 */
export async function performClockInWithPolicies(): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = useStore.getState();
  const { currentUser, timesheets, Leave } = state;
  if (!currentUser) return { ok: false, error: 'You must be signed in to clock in.' };

  // Backend is source of truth for shift enable/disable.
  if (currentUser.role !== 'Admin') {
    try {
      const shift = await getShiftStatusApi();
      if (!shift.is_enabled) {
        return { ok: false, error: 'Clock-in is disabled by admin.' };
      }
    } catch {
      if (!state.adhocShiftsEnabled) {
        return { ok: false, error: 'Clock-in is disabled by admin.' };
      }
    }
  }

  const today = new Date();
  if (currentUser.role !== 'Admin') {
    const beforeStartMsg = clockInBlockedBeforeOfficeStart(today, state.attendanceDayOverrides);
    if (beforeStartMsg) return { ok: false, error: beforeStartMsg };
    const afterWindowMsg = clockInBlockedAfterLateWindow(today, state.attendanceDayOverrides);
    if (afterWindowMsg) return { ok: false, error: afterWindowMsg };
  }
  if (isOnApprovedLeaveToday(Leave, currentUser.id, today)) {
    return { ok: false, error: 'You are currently on leave today.' };
  }
  const alreadyCompletedShiftToday = timesheets.some((t) => {
    if (t.userId !== currentUser.id || !t.clockOut) return false;
    const clockInDate = new Date(t.clockIn);
    return isSameLocalDay(clockInDate, today);
  });
  if (alreadyCompletedShiftToday) {
    return { ok: false, error: 'You have already complete shift.' };
  }

  const radius = radiusMilesForUser();
  if (state.geoFencingEnabled && radius > 0) {
    const lat = state.geoFencingOfficeLat;
    const lng = state.geoFencingOfficeLng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        ok: false,
        error: 'Geo-fencing is on but the office location is not set. Ask an admin to set latitude/longitude in Time control.',
      };
    }
    try {
      const pos = await getCurrentLatLng();
      const miles = haversineMiles(lat, lng, pos.lat, pos.lng);
      if (miles > radius) {
        return {
          ok: false,
          error: `You are about ${miles.toFixed(1)} mi from the office anchor — outside the allowed ${radius} mi radius.`,
        };
      }
    } catch {
      return {
        ok: false,
        error: 'Location access is required to clock in while geo-fencing is enabled.',
      };
    }
  }

  try {
    await state.clockIn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to clock in.',
    };
  }
}
