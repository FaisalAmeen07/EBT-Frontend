'use client';

import { useStore } from '@/lib/store';
import { Clock, ShieldCheck, Mail, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearSessionCookies } from '@/views/auth/authSession';
import { logoutFromApi } from '@/services/auth.service';

export default function PendingPage() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const router = useRouter();

  const handleLogout = () => {
    void logoutFromApi();
    clearSessionCookies();
    setCurrentUser(null);
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/80 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Animated clock icon */}
        <div className="relative mx-auto w-32 h-32">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
          <div className="relative w-32 h-32 bg-white dark:bg-slate-900 rounded-full shadow-2xl shadow-blue-100 flex items-center justify-center border border-slate-100 dark:border-slate-800">
            <Clock className="w-16 h-16 text-blue-500 animate-pulse" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-light text-slate-800 dark:text-slate-100 tracking-tight">
            Account <span className="font-bold text-blue-600">Pending</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            Your registration has been received. An administrator will review your account and assign
            you a role and team shortly.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Awaiting Approval</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your account is under review by the admin team</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentUser?.email}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">You'll be notified once approved</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
