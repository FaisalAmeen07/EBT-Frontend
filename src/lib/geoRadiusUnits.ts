/** International mile (exact definition vs meter). */
export const METERS_PER_MILE = 1609.344;

/** Stored and API values are always in miles; UI may edit in meters. */
export const GEO_RADIUS_MAX_MILES = 500;
/** Smallest positive radius in miles (~0.5 m) when a non-zero fence is intended. */
export const GEO_RADIUS_MIN_POSITIVE_MILES = 0.00031;
export const GEO_RADIUS_MAX_METERS = GEO_RADIUS_MAX_MILES * METERS_PER_MILE;

export type GeoRadiusUnit = 'miles' | 'meters';

export function normalizeGeoRadiusUnit(raw: unknown): GeoRadiusUnit {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === 'meters' || s === 'meter' ? 'meters' : 'miles';
}

export function metersToMiles(meters: number): number {
  if (!Number.isFinite(meters)) return 0;
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  if (!Number.isFinite(miles)) return 0;
  return miles * METERS_PER_MILE;
}

/** Clamp miles to API-safe range; 0 means “no distance check” (existing behavior). */
export function clampRadiusMiles(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  const capped = Math.min(miles, GEO_RADIUS_MAX_MILES);
  if (capped > 0 && capped < GEO_RADIUS_MIN_POSITIVE_MILES) return GEO_RADIUS_MIN_POSITIVE_MILES;
  return capped;
}

/** When input is in meters, convert then clamp miles. */
export function clampRadiusFromMetersInput(meters: number): number {
  return clampRadiusMiles(metersToMiles(meters));
}

export function formatMilesShort(miles: number): string {
  if (!Number.isFinite(miles)) return '—';
  if (miles === 0) return '0';
  return miles.toFixed(3);
}

export function formatMetersShort(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters === 0) return '0';
  return meters.toFixed(1);
}
