import type { Department } from '@/lib/store';

const AUTH_INPUT_BASE =
  'w-full border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-shadow';

/**
 * No `px-*` in base — it fights with `pl-*` for icon spacing. Left icon sits at left-3 (12px);
 * pl-11 (2.75rem) clears 16px icon + gap. Default right padding for fields without trailing icon.
 */
/** text-base on small screens avoids iOS zooming focused inputs below 16px */
export const AUTH_INPUT_CLASS =
  `${AUTH_INPUT_BASE} min-h-11 rounded-xl py-2.5 pl-11 pr-3.5 sm:py-3 sm:pr-4 text-base sm:text-sm`;

/** Tighter fields (register): same icon inset, slightly less vertical padding */
export const AUTH_INPUT_COMPACT_CLASS =
  `${AUTH_INPUT_BASE} min-h-10 rounded-lg py-2 pl-11 pr-3 sm:py-2 sm:pr-3.5 text-base sm:text-sm`;

export const DEPARTMENTS: Department[] = [
  'Web Design',
  'MERN Stack',
  'Web Development',
  'SEO',
];
