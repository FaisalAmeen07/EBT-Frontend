import {
  clockInBlockedAfterLateWindow,
  clockInBlockedBeforeOfficeStart,
  companyShiftTimesFromApi,
} from '@/lib/attendanceRules';
import { useStore } from '@/lib/store';
import { getCurrentLatLng, haversineMiles } from '@/lib/geoDistance';
import {
  geoFenceRequiresClientCoordinates,
  radiusMilesForGeoSlice,
} from '@/lib/geoFencingAttendance';
import { getCurrentShiftApi, getShiftStatusApi } from '@/services/attendance.service';

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
  const state0 = useStore.getState();
  const { currentUser } = state0;
  if (!currentUser) return { ok: false, error: 'You must be signed in to clock in.' };

  await state0.hydrateAttendanceControlSettingsFromApi();
  const state = useStore.getState();
  const { timesheets, Leave } = state;

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
    let companyShift = state.companyShiftTimes;
    try {
      const cur = await getCurrentShiftApi();
      companyShift = companyShiftTimesFromApi(cur.shift_start, cur.shift_end);
      useStore.getState().setCompanyShiftTimes(companyShift);
    } catch {
      /* use cached companyShift */
    }
    const beforeStartMsg = clockInBlockedBeforeOfficeStart(
      today,
      state.attendanceDayOverrides,
      companyShift
    );
    if (beforeStartMsg) return { ok: false, error: beforeStartMsg };
    const afterWindowMsg = clockInBlockedAfterLateWindow(
      today,
      state.attendanceDayOverrides,
      companyShift
    );
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

  const radius = radiusMilesForGeoSlice(state);
  let geoBodyForApi: { latitude: number; longitude: number; work_site?: string } | undefined;
  if (geoFenceRequiresClientCoordinates(state)) {
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
          error: `Your location is approximately ${miles.toFixed(1)} mile(s) from the office. Clock-in is only permitted within ${radius} mile(s) of the authorized site. Please move to an approved location or contact your administrator if you need assistance.`,
        };
      }
      geoBodyForApi = { latitude: pos.lat, longitude: pos.lng };
      const site = state.currentUser?.workSite?.trim();
      if (site) geoBodyForApi.work_site = site;
    } catch {
      return {
        ok: false,
        error: 'Location access is required to clock in while geo-fencing is enabled.',
      };
    }
  }

  try {
    await state.clockIn(geoBodyForApi);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to clock in.',
    };
  }
}
