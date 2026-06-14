import { Suspense } from 'react';
import TasksPage from './ProjectManagerClient';

function ProjectManagerFallback() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500 dark:text-slate-400">
      Loading project manager…
    </div>
  );
}

export default function ProjectManagerRoute() {
  return (
    <Suspense fallback={<ProjectManagerFallback />}>
      <TasksPage />
    </Suspense>
  );
}
