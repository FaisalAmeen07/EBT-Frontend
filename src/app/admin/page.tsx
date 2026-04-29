'use client';

import Link from 'next/link';
import { ShieldCheck, UsersRound, Timer, ArrowRight, Building2 } from 'lucide-react';

const cards = [
  {
    href: '/admin/employees-management',
    title: 'Employees management',
    description: 'User directory, roles, promote or remove accounts.',
    icon: UsersRound,
    accent: 'from-blue-600 to-indigo-600 shadow-blue-200/50',
  },
  {
    href: '/admin/time-control',
    title: 'Time control',
    description:
      'Company office start by date, enable or disable live shifts, and geo-fencing settings for clock-in.',
    icon: Timer,
    accent: 'from-amber-500 to-orange-600 shadow-amber-200/50',
  },
  {
    href: '/admin/departments-control',
    title: 'Departments control',
    description: 'Add or remove departments used by the register form dropdown.',
    icon: Building2,
    accent: 'from-emerald-600 to-teal-600 shadow-emerald-200/50',
  },
];

export default function AdminHomePage() {
  return (
    <div className="mx-auto min-h-full max-w-5xl space-y-8 px-4 pb-12 pt-6 sm:px-0">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/90 to-indigo-50/35 p-8 shadow-md shadow-slate-200/40 sm:rounded-[2.5rem]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/25 ring-4 ring-slate-900/5">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Administration</p>
            <h1 className="mt-1 text-3xl font-light tracking-tight text-slate-900">Admin Control</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              Manage users, time and attendance policies, and registration departments from one place.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100/80 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition group-hover:scale-105 ${c.accent}`}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{c.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600 transition group-hover:gap-2">
                Open
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
