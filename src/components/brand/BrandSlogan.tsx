'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { BRAND_SLOGAN } from '@/lib/brand';
import { cn } from '@/lib/utils';

type BrandSloganProps = {
  onDark?: boolean;
  className?: string;
};

/** Tagline — white on dark surfaces, muted on light. */
export function BrandSlogan({ onDark, className }: BrandSloganProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = onDark ?? (mounted && resolvedTheme === 'dark');

  return (
    <p
      className={cn(
        'font-semibold uppercase tracking-wide',
        isDark ? 'text-white/90' : 'text-slate-500',
        className,
      )}
    >
      {BRAND_SLOGAN}
    </p>
  );
}
