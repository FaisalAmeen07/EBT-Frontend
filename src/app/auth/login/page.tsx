import { Suspense } from 'react';
import SignInView from '@/views/auth/login';

export const metadata = {
  title: 'Login',
  description: 'Login to your account',
};

function AuthFallback() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#F2F4FC]">
      <div className="text-slate-600 text-sm font-medium">Loading…</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <SignInView />
    </Suspense>
  );
}
