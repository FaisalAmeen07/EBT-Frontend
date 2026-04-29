'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function AuthAlerts({
  error,
  success,
  compact = false,
  onDismiss,
}: {
  error: string | null;
  success: string | null;
  compact?: boolean;
  /** Clears error and success (auto-dismiss or tap toast to close). */
  onDismiss?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  const visible = Boolean(error || success);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (!visible) return;
    const ms = error ? 5500 : 4500;
    dismissTimerRef.current = setTimeout(() => {
      onDismissRef.current?.();
      dismissTimerRef.current = null;
    }, ms);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [error, success, visible]);

  if (!mounted || !visible) return null;

  const isError = Boolean(error);
  const message = error ?? success ?? '';

  const toast = (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-4 sm:pt-5"
      role="status"
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <button
        type="button"
        onClick={() => onDismiss?.()}
        className={`pointer-events-auto w-max max-w-[min(calc(100vw-1.5rem),22rem)] animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-slate-200/90 bg-white text-left shadow-[0_8px_30px_rgb(15,23,42,0.12),0_2px_8px_rgb(15,23,42,0.06)] outline-none transition hover:shadow-[0_12px_36px_rgb(15,23,42,0.14)] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
          compact ? 'px-3 py-2' : 'px-3 py-2.5'
        } ${isError ? 'border-l-[4px] border-l-rose-500' : 'border-l-[4px] border-l-emerald-500'}`}
        aria-describedby="auth-alert-desc"
      >
        <p
          id="auth-alert-desc"
          className={`whitespace-normal text-balance font-medium leading-snug tracking-tight text-slate-700 ${compact ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-[15px]'}`}
        >
          {message}
        </p>
        <span className="sr-only">Tap to dismiss</span>
      </button>
    </div>
  );

  return createPortal(toast, document.body);
}
