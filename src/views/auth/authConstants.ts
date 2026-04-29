import type { Department } from '@/lib/store';

const AUTH_INPUT_BASE =
  'w-full border-0 border-b-2 border-sky-200 bg-transparent text-slate-800 placeholder:text-slate-300 outline-none focus:border-sky-500 transition-colors';

/**
 * No `px-*` in base — it fights with `pl-*` for icon spacing. Left icon sits at left-3 (12px);
 * pl-11 (2.75rem) clears 16px icon + gap. Default right padding for fields without trailing icon.
 */
/** text-base on small screens avoids iOS zooming focused inputs below 16px */
export const AUTH_INPUT_CLASS =
  `${AUTH_INPUT_BASE} min-h-10 rounded-none py-2 pl-11 pr-3 text-base sm:text-sm`;

/** Tighter fields (register): same icon inset, slightly less vertical padding */
export const AUTH_INPUT_COMPACT_CLASS =
  `${AUTH_INPUT_BASE} min-h-10 rounded-none py-1.5 pl-11 pr-3 text-base sm:text-sm`;

export const AUTH_PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-600 to-blue-700 px-6 py-2 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(37,99,235,0.35)] hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed';

export const AUTH_SECONDARY_BUTTON_CLASS =
  'inline-flex items-center justify-center w-full gap-2 rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed';

export const DEPARTMENTS: Department[] = [
  'Web Design',
  'MERN Stack',
  'Web Development',
  'SEO',
];
