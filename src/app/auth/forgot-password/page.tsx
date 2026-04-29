import { Suspense } from 'react';
import ForgotPasswordView from '@/views/auth/forgot-password';

export const metadata = {
  title: 'Forgot password',
  description: 'Reset your password',
};

function AuthFallback() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#F2F4FC]">
      <div className="text-slate-600 text-sm font-medium">Loading…</div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ForgotPasswordView />
    </Suspense>
  );
}
