'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User, Building2 } from 'lucide-react';
import type { Department } from '@/lib/store';
import AuthShell from '@/views/auth/AuthShell';
import { AuthAlerts } from '@/views/auth/AuthAlerts';
import { AUTH_INPUT_COMPACT_CLASS, DEPARTMENTS } from '@/views/auth/authConstants';
import { registerWithApi } from '@/services/auth.service';
import {
  passwordStrength,
  validateDepartment,
  validateEmail,
  validateName,
  validatePasswordStrong,
  validatePhone,
} from '@/lib/validation/authValidation';

export default function RegisterView() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<Department>('Web Development');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError({});

    const errs: Record<string, string> = {};
    const n = validateName(name);
    if (!n.ok) errs.name = n.error;
    const em = validateEmail(email);
    if (!em.ok) errs.email = em.error;
    const ph = validatePhone(phone);
    if (!ph.ok) errs.phone = ph.error;
    const dep = validateDepartment(department);
    if (!dep.ok) errs.department = dep.error;
    const pw = validatePasswordStrong(password);
    if (!pw.ok) errs.password = pw.error;

    if (Object.keys(errs).length > 0) {
      setFieldError(errs);
      setError(Object.values(errs)[0]);
      return;
    }

    setLoading(true);
    try {
      const res = await registerWithApi({
        name,
        email,
        password,
        phone,
        department,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const trimmedEmail = email.trim().toLowerCase();
      const q = new URLSearchParams({
        registered: '1',
        email: trimmedEmail,
      });
      router.replace(`/auth/login?${q.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create account" wide compact>
      <AuthAlerts
        error={error}
        success={null}
        compact
        onDismiss={() => {
          setError(null);
        }}
      />
      <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Full name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                const raw = e.target.value;
                // English alphabets + spaces only
                const cleaned = raw.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ');
                setName(cleaned);
              }}
              className={AUTH_INPUT_COMPACT_CLASS}
              placeholder="Your name"
            />
          </div>

        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={AUTH_INPUT_COMPACT_CLASS}
              placeholder="you@company.com"
            />
          </div>

        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Phone
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                const raw = e.target.value;
                // Digits only (keep it simple and consistent)
                const cleaned = raw.replace(/\D/g, '').slice(0, 16);
                setPhone(cleaned);
              }}
              className={AUTH_INPUT_COMPACT_CLASS}
              placeholder="03000000000"
            />
          </div>

        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Department
          </label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className={`${AUTH_INPUT_COMPACT_CLASS} cursor-pointer appearance-none`}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${AUTH_INPUT_COMPACT_CLASS} pr-11`}
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 sm:right-3"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-0.5 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200/80 hover:bg-blue-700 disabled:opacity-60 sm:min-h-10 sm:rounded-xl sm:py-2.5 sm:shadow-lg"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" /> : null}
          Create account
        </button>
        <p className="text-center text-xs text-slate-500 sm:text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-bold text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
