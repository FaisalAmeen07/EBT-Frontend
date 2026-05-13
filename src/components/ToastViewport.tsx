'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore, type ToastTone } from '@/lib/toast';

function leftBorderClass(tone: ToastTone) {
  if (tone === 'error') return 'border-l-[4px] border-l-rose-500';
  if (tone === 'success') return 'border-l-[4px] border-l-emerald-500';
  return 'border-l-[4px] border-l-slate-500';
}

export function ToastViewport() {
  const message = useToastStore((s) => s.message);
  const tone = useToastStore((s) => s.tone);
  const version = useToastStore((s) => s._version);
  const dismiss = useToastStore((s) => s.dismiss);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (!message) return;
    const ms = tone === 'error' ? 5500 : 4500;
    dismissTimerRef.current = setTimeout(() => {
      dismiss();
      dismissTimerRef.current = null;
    }, ms);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [message, tone, version, dismiss]);

  if (typeof document === 'undefined' || !message) return null;

  const isError = tone === 'error';

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-4 sm:pt-5"
      role="status"
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <button
        type="button"
        onClick={() => dismiss()}
        className={`pointer-events-auto w-max max-w-[min(calc(100vw-1.5rem),22rem)] animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 text-left shadow-[0_8px_30px_rgb(15,23,42,0.12),0_2px_8px_rgb(15,23,42,0.06)] outline-none transition hover:shadow-[0_12px_36px_rgb(15,23,42,0.14)] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 px-3 py-2.5 ${leftBorderClass(
          tone
        )}`}
        aria-describedby="global-toast-desc"
      >
        <p
          id="global-toast-desc"
          className="whitespace-normal text-balance text-sm font-medium leading-snug tracking-tight text-slate-700 dark:text-slate-200 sm:text-[15px]"
        >
          {message}
        </p>
        <span className="sr-only">Tap to dismiss</span>
      </button>
    </div>,
    document.body
  );
}
