'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import AuthShell from '@/views/auth/AuthShell';
import { AuthAlerts } from '@/views/auth/AuthAlerts';
import { AUTH_INPUT_CLASS, AUTH_PRIMARY_BUTTON_CLASS } from '@/views/auth/authConstants';
import { resetPasswordApi } from '@/services/auth.service';
import { passwordStrength, validatePasswordStrong } from '@/lib/validation/authValidation';

export default function ResetPasswordView() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError({});

    const errs: Record<string, string> = {};
    const pw = validatePasswordStrong(password);
    if (!pw.ok) errs.password = pw.error;
    if (password !== passwordConfirm) {
      errs.passwordConfirm = 'Passwords do not match.';
    }
    if (Object.keys(errs).length > 0) {
      setFieldError(errs);
      setError(Object.values(errs)[0]);
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordApi(password, passwordConfirm);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess('Password updated. You can sign in now.');
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password">
      <AuthAlerts error={error} success={success} onDismiss={() => { setError(null); setSuccess(null); }} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">New password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${AUTH_INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {(() => {
            const s = passwordStrength(password);
            const item = (ok: boolean, label: string) => (
              <span className={ok ? 'text-emerald-700' : 'text-slate-400 dark:text-slate-500'}>{label}</span>
            );
            return (
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold">
                {item(s.minLen, '8+ chars')}
                {item(s.upper, 'Upper')}
                {item(s.lower, 'Lower')}
                {item(s.number, 'Number')}
                {item(s.special, 'Special')}
              </div>
            );
          })()}
          {fieldError.password ? (
            <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.password}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Confirm password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPw2 ? 'text' : 'password'}
              required
              minLength={8}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`${AUTH_INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPw2(!showPw2)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            >
              {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldError.passwordConfirm ? (
            <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.passwordConfirm}</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`${AUTH_PRIMARY_BUTTON_CLASS} w-full`}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          Update password
        </button>
      </form>
    </AuthShell>
  );
}
