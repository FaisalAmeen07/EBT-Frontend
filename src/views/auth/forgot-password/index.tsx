'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import AuthShell from '@/views/auth/AuthShell';
import { AuthAlerts } from '@/views/auth/AuthAlerts';
import { AUTH_INPUT_CLASS, AUTH_PRIMARY_BUTTON_CLASS, AUTH_SECONDARY_BUTTON_CLASS } from '@/views/auth/authConstants';
import { forgotPasswordApi, verifyResetOtpApi } from '@/services/auth.service';
import { validateEmail, validateOtp } from '@/lib/validation/authValidation';

type Step = 'email' | 'otp';

export default function ForgotPasswordView() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError({});

    const em = validateEmail(email);
    if (!em.ok) {
      setFieldError({ email: em.error });
      setError(em.error);
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPasswordApi(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const trimmed = email.trim().toLowerCase();
      setSubmittedEmail(trimmed);
      setOtp('');
      setStep('otp');
      setSuccess(res.message || 'If an account exists, a code was sent to your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError({});

    const o = validateOtp(otp);
    if (!o.ok) {
      setFieldError({ otp: o.error });
      setError(o.error);
      return;
    }
    setLoading(true);
    try {
      const res = await verifyResetOtpApi(otp);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace('/auth/reset-password');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      const res = await forgotPasswordApi(submittedEmail);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOtp('');
      setSuccess(res.message || 'Code resent. Check your email.');
    } finally {
      setResending(false);
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setError(null);
    setSuccess(null);
    setOtp('');
  };

  return (
    <AuthShell title={step === 'email' ? 'Forgot password' : 'Verify code'}>
      <AuthAlerts error={error} success={success} onDismiss={() => { setError(null); setSuccess(null); }} />

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            {fieldError.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.email}</p> : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`${AUTH_PRIMARY_BUTTON_CLASS} w-full`}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
            Send verification code
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={goBackToEmail}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Use a different email
          </button>

          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                6-digit code
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={AUTH_INPUT_CLASS}
                  placeholder="••••••"
                />
              </div>
            {fieldError.otp ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.otp}</p> : null}
            </div>
            <button
              type="submit"
              disabled={loading || resending || otp.length !== 6}
              className={`${AUTH_PRIMARY_BUTTON_CLASS} w-full`}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
              Verify code
            </button>
          </form>

          <button
            type="button"
            disabled={loading || resending}
            onClick={handleResend}
            className={`${AUTH_SECONDARY_BUTTON_CLASS} w-full`}
          >
            <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} aria-hidden />
            Resend code
          </button>
        </div>
      )}
    </AuthShell>
  );
}
