'use client';

import { useEffect, useState } from 'react';
import { useStore, useShallow } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Timer, CalendarClock, MapPin } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  getCurrentShiftApi,
  getShiftStatusApi,
  setShiftStatusApi,
  setShiftTimingApi,
} from '@/services/attendance.service';

function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** OFF: light grey track + dark knob (left). ON: green track + white knob + shadow (right). */
function PolicyToggle({
  checked,
  onCheckedChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        checked ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-200'
      )}
    >
      <span
        className={cn(
          'pointer-events-none h-[1.625rem] w-[1.625rem] shrink-0 rounded-full transition-[background-color,box-shadow] duration-200',
          checked ? 'bg-white shadow-md' : 'bg-slate-700 shadow-none'
        )}
      />
    </button>
  );
}

export function TimeControlPage() {
  const {
    sites,
    geoFencingEnabled,
    geoFencingUseGlobalRadius,
    geoFencingGlobalRadiusMiles,
    geoFencingSiteRadiusMiles,
    geoFencingOfficeLat,
    geoFencingOfficeLng,
    patchAttendanceControlSettings,
  } = useStore(
    useShallow((s) => ({
      sites: s.sites,
      geoFencingEnabled: s.geoFencingEnabled,
      geoFencingUseGlobalRadius: s.geoFencingUseGlobalRadius,
      geoFencingGlobalRadiusMiles: s.geoFencingGlobalRadiusMiles,
      geoFencingSiteRadiusMiles: s.geoFencingSiteRadiusMiles,
      geoFencingOfficeLat: s.geoFencingOfficeLat,
      geoFencingOfficeLng: s.geoFencingOfficeLng,
      patchAttendanceControlSettings: s.patchAttendanceControlSettings,
    }))
  );

  const [companyDay, setCompanyDay] = useState(todayDateInput());
  const [companyStartTime, setCompanyStartTime] = useState('09:00');
  const [companyEndTime, setCompanyEndTime] = useState('18:00');
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [loadingShift, setLoadingShift] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingShift(true);
      try {
        const [status, current] = await Promise.all([getShiftStatusApi(), getCurrentShiftApi()]);
        if (cancelled) return;
        setShiftEnabled(Boolean(status.is_enabled));
        setShiftId(status.shift_id ?? null);
        if (current.shift_start) setCompanyStartTime(String(current.shift_start).slice(0, 5));
        if (current.shift_end) setCompanyEndTime(String(current.shift_end).slice(0, 5));
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : 'Unable to load shift config.', 'error');
      } finally {
        if (!cancelled) setLoadingShift(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveShiftTiming = async () => {
    const [h, m] = companyStartTime.split(':').map((x) => parseInt(x, 10));
    const [eh, em] = companyEndTime.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(eh) || Number.isNaN(em)) {
      toast('Enter valid office start/end times.', 'error');
      return;
    }
    if (eh * 60 + em <= h * 60 + m) {
      toast('Office end must be after office start.', 'error');
      return;
    }
    try {
      await setShiftTimingApi({
        shift_start: `${companyStartTime}:00`,
        shift_end: `${companyEndTime}:00`,
        effective_date: companyDay,
      });
      toast('Shift timing updated.');
      void useStore.getState().refreshNotificationsFromApi();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to set shift timing.', 'error');
    }
  };

  const toggleShiftStatus = async (next: boolean) => {
    try {
      await setShiftStatusApi({ shift_id: shiftId ?? 1, is_enabled: next });
      setShiftEnabled(next);
      toast(next ? 'Shift enabled.' : 'Shift disabled.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to update shift status.', 'error');
    }
  };

  return (
    <div className="mx-auto min-h-full max-w-6xl space-y-8 pb-12">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-amber-50/20 p-8 shadow-sm">
        <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-slate-800">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200/50">
            <Timer className="h-7 w-7" />
          </span>
          Time control
        </h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Company office shift by date (all staff)</h2>

          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</label>
            <input
              type="date"
              value={companyDay}
              onChange={(e) => setCompanyDay(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Office start
            </label>
            <input
              type="time"
              value={companyStartTime}
              onChange={(e) => setCompanyStartTime(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Office end
            </label>
            <input
              type="time"
              value={companyEndTime}
              onChange={(e) => setCompanyEndTime(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void saveShiftTiming()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Save shift timing
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-base font-semibold text-slate-900">Shift status</h2>
          <p className="mt-1 text-sm text-slate-600">
            Uses backend `/api/shift-status` and controls whether clock-in is enabled.
          </p>
        </div>
        <PolicyToggle
          checked={shiftEnabled}
          onCheckedChange={(next) => void toggleShiftStatus(next)}
          aria-label="Enable shifts"
        />
        {loadingShift ? <span className="text-xs text-slate-500">Loading...</span> : null}
      </div>

      {/* Geo-Fencing */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-base font-semibold text-slate-900">Geo-Fencing</h2>
            <p className="mt-1 text-sm text-slate-600">
              Restrict clock-ins to within a radius of the office anchor. Requires browser location permission when
              employees clock in.
            </p>
          </div>
          <PolicyToggle
            checked={geoFencingEnabled}
            onCheckedChange={(next) => patchAttendanceControlSettings({ geoFencingEnabled: next })}
            aria-label="Enable geo-fencing"
          />
        </div>

        {geoFencingEnabled && (
          <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
            <fieldset className="space-y-3">
              <legend className="sr-only">Radius mode</legend>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="geo-radius-mode"
                  checked={geoFencingUseGlobalRadius}
                  onChange={() => patchAttendanceControlSettings({ geoFencingUseGlobalRadius: true })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Use radius as global</span>
                  <span className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      disabled={!geoFencingUseGlobalRadius}
                      value={geoFencingGlobalRadiusMiles}
                      onChange={(e) =>
                        patchAttendanceControlSettings({
                          geoFencingGlobalRadiusMiles: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 disabled:opacity-50"
                    />
                    miles
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="geo-radius-mode"
                  checked={!geoFencingUseGlobalRadius}
                  onChange={() => patchAttendanceControlSettings({ geoFencingUseGlobalRadius: false })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Set custom radius per site</span>
                  <p className="mt-1 text-xs text-slate-500">
                    Uses each user&apos;s work site; falls back to global miles if a site has no value.
                  </p>
                </span>
              </label>
            </fieldset>

            {!geoFencingUseGlobalRadius && (
              <div className="grid gap-3 sm:grid-cols-2">
                {sites.map((site) => (
                  <div key={site} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{site}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={geoFencingSiteRadiusMiles[site] ?? 0}
                      onChange={(e) =>
                        patchAttendanceControlSettings({
                          geoFencingSiteRadiusMiles: {
                            [site]: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5"
                    />
                    <span className="text-slate-500">mi</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPin className="h-4 w-4 text-blue-600" />
                Office anchor (latitude / longitude)
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Required when geo-fencing is on and radius &gt; 0. Distance is measured from this point to the
                employee&apos;s device when they tap Clock In.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Latitude
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 31.52"
                    value={geoFencingOfficeLat == null ? '' : geoFencingOfficeLat}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') patchAttendanceControlSettings({ geoFencingOfficeLat: null });
                      else {
                        const n = parseFloat(v);
                        if (Number.isFinite(n)) patchAttendanceControlSettings({ geoFencingOfficeLat: n });
                      }
                    }}
                    className="mt-1 block w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Longitude
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 74.35"
                    value={geoFencingOfficeLng == null ? '' : geoFencingOfficeLng}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') patchAttendanceControlSettings({ geoFencingOfficeLng: null });
                      else {
                        const n = parseFloat(v);
                        if (Number.isFinite(n)) patchAttendanceControlSettings({ geoFencingOfficeLng: n });
                      }
                    }}
                    className="mt-1 block w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
