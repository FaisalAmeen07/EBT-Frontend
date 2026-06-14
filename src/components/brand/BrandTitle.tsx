'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { BRAND_NAME_PARTS, BRAND_NAVY, BRAND_ORANGE } from '@/lib/brand';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  sm: 'text-sm leading-tight',
  md: 'text-base leading-tight',
  lg: 'text-lg leading-snug',
  xl: 'text-xl leading-snug sm:text-2xl',
};

type BrandTitleProps = {
  size?: keyof typeof SIZE_CLASS;
  /** Force light text (blue auth panel). */
  onDark?: boolean;
  /** Auth panel — “Bright Tec” white instead of orange. */
  accentWhite?: boolean;
  className?: string;
};

/** Styled “Elevate Bright Tec” — readable on light and dark surfaces. */
export function BrandTitle({ size = 'md', onDark, accentWhite, className }: BrandTitleProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = onDark ?? (mounted && resolvedTheme === 'dark');
  const titleColor = isDark ? '#FFFFFF' : BRAND_NAVY;
  const accentColor = accentWhite ? '#FFFFFF' : BRAND_ORANGE;

  return (
    <p className={cn('font-extrabold tracking-tight', SIZE_CLASS[size], className)}>
      <span style={{ color: titleColor }}>{BRAND_NAME_PARTS.prefix}</span>
      <span style={{ color: accentColor }}>
        {BRAND_NAME_PARTS.accent}
        {BRAND_NAME_PARTS.suffix}
      </span>
    </p>
  );
}
