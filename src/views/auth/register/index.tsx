'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User, Building2 } from 'lucide-react';
import { useStore, type Department } from '@/lib/store';
import AuthShell from '@/views/auth/AuthShell';
import { AuthAlerts } from '@/views/auth/AuthAlerts';
import {
  AUTH_INPUT_COMPACT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
} from '@/views/auth/authConstants';
import { fetchPublicDepartmentsApi, registerWithApi } from '@/services/auth.service';
import {
  validateDepartment,
  validateEmail,
  validateName,
  validatePasswordStrong,
  validatePhone,
} from '@/lib/validation/authValidation';

export default function RegisterView() {
  const router = useRouter();
  const departments = useStore((s) => s.departments);
  const setDepartments = useStore((s) => s.setDepartments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<Department>(departments[0] || 'Web Development');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!departments.length) return;
    if (!departments.includes(department)) setDepartment(departments[0]);
  }, [departments, department]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const fromApi = await fetchPublicDepartmentsApi();
      if (cancelled || !fromApi.length) return;
      setDepartments(fromApi);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [setDepartments]);

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
    const dep = validateDepartment(department, departments);
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
    <AuthShell title="Create account" wide compact formTransition="right">
      <AuthAlerts
        error={error}
        success={null}
        compact
        onDismiss={() => {
          setError(null);
        }}
      />
      <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Full name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoComplete="name"
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
                aria-invalid={fieldError.name ? 'true' : 'false'}
              />
            </div>
            {fieldError.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.name}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_INPUT_COMPACT_CLASS}
                placeholder="you@company.com"
                aria-invalid={fieldError.email ? 'true' : 'false'}
              />
            </div>
            {fieldError.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.email}</p> : null}
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Phone
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                autoComplete="tel"
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
                aria-invalid={fieldError.phone ? 'true' : 'false'}
              />
            </div>
            {fieldError.phone ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.phone}</p> : null}
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
                disabled={departments.length === 0}
                aria-invalid={fieldError.department ? 'true' : 'false'}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {departments.length === 0 ? (
              <p className="mt-1 text-xs font-semibold text-rose-600">
                No department configured. Ask admin to add one in Admin Control.
              </p>
            ) : null}
            {fieldError.department ? (
              <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.department}</p>
            ) : null}
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${AUTH_INPUT_COMPACT_CLASS} pr-11`}
              placeholder="Password"
              aria-invalid={fieldError.password ? 'true' : 'false'}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 sm:right-3"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldError.password ? <p className="mt-1 text-xs font-semibold text-rose-600">{fieldError.password}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className={`${AUTH_PRIMARY_BUTTON_CLASS} w-full`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
          <Link href="/auth/login" className={`${AUTH_SECONDARY_BUTTON_CLASS} w-full`}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
