import { Suspense } from 'react';
import { EmployeesManagementPage } from '@/features/admin/EmployeesManagementPage';

function EmployeesManagementFallback() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500 dark:text-slate-400">
      Loading employees…
    </div>
  );
}

export default function EmployeesManagementRoute() {
  return (
    <Suspense fallback={<EmployeesManagementFallback />}>
      <EmployeesManagementPage />
    </Suspense>
  );
}
