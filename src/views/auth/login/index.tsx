'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { useStore } from '@/lib/store';
import AuthShell from '@/views/auth/AuthShell';
import { AuthAlerts } from '@/views/auth/AuthAlerts';
import { AUTH_INPUT_CLASS, AUTH_PRIMARY_BUTTON_CLASS, AUTH_SECONDARY_BUTTON_CLASS } from '@/views/auth/authConstants';
import { commitSession } from '@/views/auth/authSession';
import { loginWithApi } from '@/services/auth.service';
import { validateEmail } from '@/lib/validation/authValidation';

export default function SignInView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const upsertUser = useStore((s) => s.upsertUser);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    const e = searchParams.get('email');
    if (e) setEmail(e);
    if (searchParams.get('registered') === '1') {
      setSuccess(
        'Account created. Check your email to verify if required, then sign in. If your account needs admin approval, wait before logging in.'
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError({});

    const errs: Record<string, string> = {};
    const em = validateEmail(email);
    if (!em.ok) errs.email = em.error;
    if (!String(password || '').trim()) errs.password = 'Password is required.';
    if (Object.keys(errs).length > 0) {
      setFieldError(errs);
      setError(Object.values(errs)[0]);
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithApi(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCurrentUser(res.user);
      upsertUser(res.user);
      commitSession(res.user, res.token);
      void useStore.getState().refreshNotificationsFromApi();
      router.push(res.user.role === 'Pending User' ? '/pending' : '/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" formTransition="left">
      <AuthAlerts error={error} success={success} onDismiss={() => { setError(null); setSuccess(null); }} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={AUTH_INPUT_CLASS}
              placeholder="you@company.com"
            />
          </div>
          {fieldError.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.email}</p> : null}
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${AUTH_INPUT_CLASS} pr-11`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldError.password ? (
            <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.password}</p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={loading} className={`${AUTH_PRIMARY_BUTTON_CLASS} w-full`}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          Sign in
        </button>
        <div className="flex justify-center pt-1">
          <Link href="/auth/register" className={AUTH_SECONDARY_BUTTON_CLASS}>
            Register
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
