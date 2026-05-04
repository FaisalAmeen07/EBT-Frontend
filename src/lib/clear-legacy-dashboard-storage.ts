/**
 * One-time cleanup: historical persist keys held full app state (PII).
 * Safe to run on every load.
 */
export function clearLegacyDashboardLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('gdc-dashboard');
    localStorage.removeItem('gdc-storage');
  } catch {
    /* quota or disabled */
  }
}
