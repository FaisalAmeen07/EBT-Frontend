import { Suspense } from 'react';
import ResetPasswordView from '@/views/auth/reset-password';

export const metadata = {
  title: 'Reset password',
  description: 'Set a new password',
};

function AuthFallback() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#F2F4FC]">
      <div className="text-slate-600 text-sm font-medium">Loading…</div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ResetPasswordView />
    </Suspense>
  );
}
