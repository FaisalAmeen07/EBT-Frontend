import type { ReactNode } from 'react';
import Image from 'next/image';
import { BRAND_LOGO_URL } from '@/lib/brand';

export default function AuthShell({
  title,
  children,
  wide = false,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  /** Longer forms (register): slightly wider card on tablet/desktop */
  wide?: boolean;
  /** Less vertical padding / smaller header (register) */
  compact?: boolean;
}) {
  const maxW = wide
    ? 'max-w-6xl'
    : 'max-w-5xl';

  return (
    <div
      className={`fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-[#F2F4FC] px-3 sm:px-5 ${compact ? 'py-2.5 sm:py-4' : 'py-3 sm:py-5'}`}
    >
      <div
        className="mx-auto flex h-full w-full flex-col items-center justify-center"
      >
        <div className={`mx-auto w-full ${maxW}`}>
          <div className="max-h-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
            <div className="relative grid min-h-[min(90vh,42rem)] grid-cols-1 md:grid-cols-[minmax(280px,38%)_1fr]">
              <aside className="relative hidden overflow-hidden bg-gradient-to-b from-[#0b4da6] via-[#1260c8] to-[#35a4ff] px-10 py-10 text-white md:flex md:items-center md:justify-center">
                <div className="relative h-16 w-[220px]">
                  <Image
                    src={BRAND_LOGO_URL}
                    alt="Global Digital Care"
                    fill
                    className="object-contain"
                    sizes="220px"
                    priority
                    draggable={false}
                  />
                </div>
              </aside>

              <div className="pointer-events-none absolute inset-y-0 left-[calc(38%-8px)] z-10 hidden w-16 -translate-x-1/2 items-center justify-center md:flex">
                <div className="flex h-full flex-col justify-around">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="h-16 w-16 rounded-full bg-white shadow-none" />
                  ))}
                </div>
              </div>

              <section className="flex min-h-0 flex-col justify-center bg-white">
                <div className={`px-6 text-center sm:px-10 ${compact ? 'pb-3 pt-5 sm:pb-4 sm:pt-6' : 'pb-5 pt-8 sm:pb-6 sm:pt-10'}`}>
                  <div className="mx-auto flex w-full max-w-xl flex-col items-center">
                    <h1 className={`font-semibold text-slate-900 ${compact ? 'mt-1 text-[1.9rem] sm:text-[2rem]' : 'mt-1 text-2xl sm:mt-2 sm:text-[2.15rem]'}`}>
                      {title}
                    </h1>
                  </div>
                </div>

                <div className={`mx-auto w-full max-w-xl px-6 sm:px-10 ${compact ? 'py-3 sm:py-4' : 'py-5 sm:py-6'}`}>
                  {children}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
