export const MAX_SHIFT_WORK_HOURS = 12;
export const MAX_SHIFT_WORK_MS = MAX_SHIFT_WORK_HOURS * 60 * 60 * 1000;

/** Backend sets `LIMIT_REACHED` when net work hits 12h (auto-pause); user must clock out, not break out. */
export function isLimitReachedSessionStatus(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toUpperCase() === 'LIMIT_REACHED';
}


