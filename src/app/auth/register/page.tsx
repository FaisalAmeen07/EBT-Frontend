import { Suspense } from 'react';
import RegisterView from '@/views/auth/register';

export const metadata = {
  title: 'Register',
  description: 'Create your account',
};

function AuthFallback() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#F2F4FC]">
      <div className="text-slate-600 text-sm font-medium">Loading…</div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RegisterView />
    </Suspense>
  );
}
