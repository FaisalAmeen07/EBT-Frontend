import type { ReactNode } from 'react';
import { BrandAuthMark } from '@/components/brand/BrandLogo';

export default function AuthShell({
  title,
  children,
  wide = false,
  compact = false,
  formTransition = 'none',
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  formTransition?: 'left' | 'right' | 'none';
}) {
  const maxW = wide ? 'max-w-6xl' : 'max-w-5xl';
  const transitionClass =
    formTransition === 'left'
      ? 'form-enter-left'
      : formTransition === 'right'
        ? 'form-enter-right'
        : '';

  return (
    <div
      className={`fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-[#F2F4FC] px-3 dark:bg-slate-950 sm:px-5 ${compact ? 'py-2.5 sm:py-4' : 'py-3 sm:py-5'}`}
    >
      <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
        <div className={`mx-auto w-full ${maxW}`}>
          <div className="max-h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:border-slate-700/90 dark:bg-slate-900">
            <div className="relative grid min-h-[min(90vh,42rem)] grid-cols-1 md:grid-cols-[minmax(280px,38%)_1fr]">
              <aside className="relative hidden overflow-hidden bg-gradient-to-b from-[#0b4da6] via-[#1260c8] to-[#35a4ff] px-8 py-10 text-white md:flex md:items-center md:justify-center">
                <div className="flex w-full max-w-[300px] flex-col items-center text-center">
                  <BrandAuthMark surface="panel" />
                </div>
              </aside>

              <div className="pointer-events-none absolute inset-y-0 left-[calc(38%-8px)] z-10 hidden w-16 -translate-x-1/2 items-center justify-center md:flex">
                <div className="flex h-full flex-col justify-around">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="h-16 w-16 rounded-full bg-white shadow-none dark:bg-slate-900" />
                  ))}
                </div>
              </div>

              <section className={`flex min-h-0 flex-col justify-center bg-white dark:bg-slate-900 ${transitionClass}`}>
                <div
                  className={`px-6 text-center sm:px-10 ${compact ? 'pb-3 pt-5 sm:pb-4 sm:pt-6' : 'pb-5 pt-8 sm:pb-6 sm:pt-10'}`}
                >
                  <div className="mx-auto flex w-full max-w-xl flex-col items-center md:hidden">
                    <BrandAuthMark surface="card" className="mb-3" />
                    <h1
                      className={`font-semibold text-slate-900 dark:text-slate-50 ${compact ? 'text-[1.9rem] sm:text-[2rem]' : 'text-2xl sm:text-[2.15rem]'}`}
                    >
                      {title}
                    </h1>
                  </div>
                  <h1
                    className={`hidden font-semibold text-slate-900 dark:text-slate-50 md:block ${compact ? 'text-[1.9rem] sm:text-[2rem]' : 'text-2xl sm:text-[2.15rem]'}`}
                  >
                    {title}
                  </h1>
                </div>

                <div className={`mx-auto w-full max-w-xl px-6 sm:px-10 ${compact ? 'py-3 sm:py-4' : 'py-5 sm:py-6'}`}>
                  {children}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .form-enter-left {
          animation: auth-form-enter-left 320ms ease-out;
        }
        .form-enter-right {
          animation: auth-form-enter-right 320ms ease-out;
        }
        @keyframes auth-form-enter-left {
          from {
            opacity: 0;
            transform: translateX(-28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes auth-form-enter-right {
          from {
            opacity: 0;
            transform: translateX(28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
