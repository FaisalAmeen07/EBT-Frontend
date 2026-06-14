'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import {
  BRAND_AUTH_PANEL_ICON_URL,
  BRAND_ICON_URL,
  BRAND_LOGO_ALT,
  BRAND_LOGO_DARK_URL,
  BRAND_LOGO_URL,
  BRAND_WORDMARK_BOX,
  brandWordmarkDims,
} from '@/lib/brand';
import { BrandTitle } from '@/components/brand/BrandTitle';
import { BrandSlogan } from '@/components/brand/BrandSlogan';
import { cn } from '@/lib/utils';

type BrandSurface = 'light' | 'dark' | 'auto';

type BrandLogoProps = {
  variant: 'icon' | 'wordmark';
  surface?: BrandSurface;
  /** Login/signup blue panel recolored icon. */
  authPanel?: boolean;
  iconSize?: number;
  className?: string;
  priority?: boolean;
};

function resolveDark(surface: BrandSurface, theme?: string): boolean {
  if (surface === 'dark') return true;
  if (surface === 'light') return false;
  return theme === 'dark';
}

export function BrandLogo({
  variant,
  surface = 'auto',
  authPanel = false,
  iconSize = 48,
  className,
  priority = false,
}: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolveDark(surface, resolvedTheme) : surface === 'dark';

  if (variant === 'icon') {
    return (
      <div
        className={cn('relative shrink-0 bg-transparent', className)}
        style={{ width: iconSize, height: iconSize }}
      >
        <Image
          src={authPanel ? BRAND_AUTH_PANEL_ICON_URL : BRAND_ICON_URL}
          alt={`${BRAND_LOGO_ALT} icon`}
          fill
          className="object-contain"
          sizes={`${iconSize}px`}
          priority={priority}
          draggable={false}
        />
      </div>
    );
  }

  const lightDims = brandWordmarkDims(false);
  const darkDims = brandWordmarkDims(true);

  return (
    <div
      className={cn('relative shrink-0 bg-transparent', className)}
      style={{ width: BRAND_WORDMARK_BOX.width, height: BRAND_WORDMARK_BOX.height }}
    >
      <Image
        src={BRAND_LOGO_URL}
        alt={BRAND_LOGO_ALT}
        width={lightDims.width}
        height={lightDims.height}
        className={cn(
          'absolute inset-0 h-full w-full object-contain object-center',
          isDark ? 'hidden' : 'block',
        )}
        priority={priority}
        draggable={false}
      />
      <Image
        src={BRAND_LOGO_DARK_URL}
        alt={BRAND_LOGO_ALT}
        width={darkDims.width}
        height={darkDims.height}
        className={cn(
          'absolute inset-0 h-full w-full object-contain object-center',
          isDark ? 'block' : 'hidden',
        )}
        priority={priority}
        draggable={false}
      />
    </div>
  );
}

type BrandAuthMarkProps = {
  surface: 'panel' | 'card';
  className?: string;
};

/** Login / register — icon + “Elevate Bright Tec” text (no mid wordmark image). */
export function BrandAuthMark({ surface, className }: BrandAuthMarkProps) {
  const onPanel = surface === 'panel';
  const iconSize = onPanel ? 104 : 72;
  const titleSize = onPanel ? 'xl' : 'lg';

  return (
    <div className={cn('flex flex-col items-center bg-transparent text-center', className)}>
      <BrandLogo
        variant="icon"
        iconSize={iconSize}
        authPanel={onPanel}
        className="mb-4 drop-shadow-md"
        priority
      />
      <BrandTitle size={titleSize} onDark={onPanel ? true : undefined} accentWhite={onPanel} />
      <BrandSlogan onDark={onPanel ? true : undefined} className="mt-2 text-xs" />
    </div>
  );
}

type BrandSidebarLockupProps = {
  collapsed?: boolean;
  className?: string;
};

/**
 * Sidebar brand — light: full wordmark image; dark: icon + white title + white slogan (same height).
 */
export function BrandSidebarLockup({ collapsed, className }: BrandSidebarLockupProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (collapsed) {
    return <BrandLogo variant="icon" iconSize={48} className={className} priority />;
  }

  const isDark = mounted && resolvedTheme === 'dark';

  if (!isDark) {
    return <BrandLogo variant="wordmark" className={className} priority />;
  }

  return (
    <div className={cn('flex w-[220px] min-h-[52px] items-center gap-2.5', className)}>
      <BrandLogo variant="icon" iconSize={52} priority />
      <div className="min-w-0 flex-1">
        <BrandTitle size="md" onDark className="text-[15px] leading-tight" />
        <BrandSlogan onDark className="mt-0.5 text-[10px] leading-tight" />
      </div>
    </div>
  );
}
