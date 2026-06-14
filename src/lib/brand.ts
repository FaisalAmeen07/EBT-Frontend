/** Elevate Bright Tec (EBT) — app-wide branding. */

export const BRAND_SHORT_NAME = 'EBT';
export const BRAND_COMPANY_NAME = 'Elevate Bright Tec';
export const BRAND_SLOGAN = 'Elevate Your Future';
export const BRAND_ID_LABEL = 'EBT ID';
export const BRAND_ID_PREFIX = 'EBT-';

export const BRAND_NAME_PARTS = {
  prefix: 'Elevate ',
  accent: 'Bright ',
  suffix: 'Tec',
};

export const BRAND_NAVY = '#1E3A5F';
export const BRAND_ORANGE = '#F97316';
/** Login/signup blue panel — recolored logo primary + title accent. */
export const BRAND_AUTH_PANEL_ACCENT = '#FC5D16';

/** Fixed wordmark box — same footprint in light & dark sidebar. */
export const BRAND_WORDMARK_BOX = { width: 220, height: 52 };

/** Square EBT emblem — navbar collapsed, auth icon, launcher source. */
export const BRAND_ICON_URL = '/brand-logo.png';

/** Login/signup blue panel — navy #FC5D16, orange accents white. */
export const BRAND_AUTH_PANEL_ICON_URL = '/brand/brand-logo-auth-panel.png';

/** Horizontal wordmark — light surfaces. */
export const BRAND_LOGO_URL = '/EBT.lightLogo.png';

/** Horizontal wordmark — dark surfaces. */
export const BRAND_LOGO_DARK_URL = '/EBT.darkLogo.png';

/** @deprecated use BRAND_ICON_URL */
export const BRAND_AUTH_ICON_URL = BRAND_ICON_URL;

/** Wordmark for light backgrounds (login card, light sidebar). */
export const BRAND_AUTH_WORDMARK_URL = '/brand/auth-wordmark.png';

/** Wordmark for dark / colored backgrounds (auth panel, dark sidebar). */
export const BRAND_AUTH_WORDMARK_DARK_URL = '/brand/auth-wordmark-dark.png';

/** Intrinsic PNG sizes after trim (used for Next.js Image + w-auto scaling). */
export const BRAND_WORDMARK_LIGHT_DIM = { width: 1569, height: 406 };
export const BRAND_WORDMARK_DARK_DIM = { width: 1615, height: 623 };

export const BRAND_LOGO_ALT = `${BRAND_COMPANY_NAME} (${BRAND_SHORT_NAME})`;

/** Display employee id — maps legacy `GDC-` prefix to `EBT-` in UI. */
export function formatBrandEmployeeId(
  gdcId?: string | null,
  numericFallback?: string | number,
  padLength?: number,
): string {
  const raw = gdcId != null ? String(gdcId).trim() : '';
  if (raw) return raw.replace(/^GDC-/i, BRAND_ID_PREFIX);
  const fallback = String(numericFallback ?? '').trim();
  if (!fallback) return '—';
  const id = padLength ? fallback.toUpperCase().padStart(padLength, '0') : fallback;
  return `${BRAND_ID_PREFIX}${id}`;
}

export function brandWordmarkDims(isDark: boolean) {
  return isDark ? BRAND_WORDMARK_DARK_DIM : BRAND_WORDMARK_LIGHT_DIM;
}
