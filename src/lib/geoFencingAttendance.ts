import { getCurrentLatLng } from '@/lib/geoDistance';

export type GeoFencingStateSlice = {
  geoFencingEnabled: boolean;
  geoFencingUseGlobalRadius: boolean;
  geoFencingGlobalRadiusMiles: number;
  geoFencingSiteRadiusMiles: Record<string, number>;
  geoFencingOfficeLat: number | null;
  geoFencingOfficeLng: number | null;
  currentUser: { workSite?: string } | null;
};

/** Effective radius in miles (0 = no distance check). Mirrors dashboard clock-in policy. */
export function radiusMilesForGeoSlice(s: GeoFencingStateSlice): number {
  if (!s.geoFencingEnabled) return 0;
  if (s.geoFencingUseGlobalRadius) return Math.max(0, s.geoFencingGlobalRadiusMiles);
  const site = s.currentUser?.workSite?.trim();
  if (site && s.geoFencingSiteRadiusMiles[site] != null) {
    return Math.max(0, s.geoFencingSiteRadiusMiles[site]!);
  }
  return Math.max(0, s.geoFencingGlobalRadiusMiles);
}

/** True when device location must be sent to the attendance API for this user. */
export function geoFenceRequiresClientCoordinates(s: GeoFencingStateSlice): boolean {
  const r = radiusMilesForGeoSlice(s);
  if (r <= 0) return false;
  const lat = s.geoFencingOfficeLat;
  const lng = s.geoFencingOfficeLng;
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export type GeoAttendanceRequestBody = {
  latitude: number;
  longitude: number;
  work_site?: string;
};

/**
 * Build JSON body for check-in / check-out / break-end when geo-fencing applies.
 * Caller should only invoke when `geoFenceRequiresClientCoordinates` is true.
 */
export async function getGeoAttendanceRequestBody(s: GeoFencingStateSlice): Promise<GeoAttendanceRequestBody> {
  const pos = await getCurrentLatLng();
  const site = s.currentUser?.workSite?.trim();
  const body: GeoAttendanceRequestBody = {
    latitude: pos.lat,
    longitude: pos.lng,
  };
  if (site) body.work_site = site;
  return body;
}
