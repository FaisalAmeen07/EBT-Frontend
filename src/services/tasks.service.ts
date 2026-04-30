import { taskApiDelete, taskApiGet, taskApiPost, taskApiPut } from '@/lib/api/task-request-handler';
import { API_PATHS } from '@/lib/api/api-base-urls';
import type { Task, TaskComment, TaskHistoryEntry, TaskWorkflowStatus } from '@/lib/store';

export const TASK_API_PATHS = {
  list: API_PATHS.task.tasks.list,
  create: API_PATHS.task.tasks.create,
  update: API_PATHS.task.tasks.update,
  delete: API_PATHS.task.tasks.delete,
  assignable: API_PATHS.task.tasks.assignable,
  startWork: API_PATHS.task.tasks.startWork,
  submit: API_PATHS.task.tasks.submit,
  sendReview: API_PATHS.task.tasks.sendReview,
  approve: API_PATHS.task.tasks.approve,
  forwardTl: API_PATHS.task.tasks.forwardTl,
  comment: API_PATHS.task.tasks.comment,
  pendingTasksCount: API_PATHS.task.tasks.pendingTasksCount,
  overdueTasksCount: API_PATHS.task.tasks.overdueTasksCount,
} as const;

type ApiTaskRow = {
  id: number;
  title: string;
  description?: string | null;
  assigned_to: number;
  created_by: number;
  creator_role?: string | null;
  status: string;
  deadline?: string | null;
  attachment?: string | null;
  attachment_file_name?: string | null;
  attachment_file_size?: number | null;
  history?: TaskHistoryEntry[];
  comments?: TaskComment[];
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type ListResponse = { success: boolean; data: ApiTaskRow[]; pagination?: Pagination };
type OneResponse = { success: boolean; data: ApiTaskRow };
type PendingTasksCountResponse = { pendingTasks?: number };
type OverdueTasksCountResponse = { overdueTasks?: number };

function statusFromApi(s: string): TaskWorkflowStatus {
  const x = String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (x === 'pending') return 'Pending';
  if (x === 'in_progress') return 'In Progress';
  if (x === 'submitted') return 'Submitted';
  if (x === 'review') return 'Review';
  if (x === 'approved') return 'Approved';
  return 'Pending';
}

function deadlineToIso(deadline: string | null | undefined): string {
  if (deadline == null || String(deadline).trim() === '') {
    return new Date().toISOString();
  }
  const d = new Date(deadline);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return new Date(`${String(deadline).slice(0, 10)}T12:00:00.000Z`).toISOString();
}

export function mapApiTaskToStore(row: ApiTaskRow): Task {
  const att =
    row.attachment && String(row.attachment).trim() !== ''
      ? {
          fileName: row.attachment_file_name || 'attachment',
          fileSize: row.attachment_file_size ?? 0,
          dataUrl: row.attachment,
        }
      : undefined;

  return {
    id: String(row.id),
    title: row.title ?? '',
    description: row.description != null ? String(row.description) : '',
    assignedTo: String(row.assigned_to),
    assignedBy: String(row.created_by),
    creatorRole: row.creator_role != null ? String(row.creator_role) : undefined,
    status: statusFromApi(row.status),
    deadline: deadlineToIso(row.deadline ?? null),
    comments: Array.isArray(row.comments) ? row.comments : [],
    history: Array.isArray(row.history) ? row.history : [],
    attachment: att,
  };
}

export async function fetchTasksFromApi(): Promise<Task[]> {
  const res = await taskApiGet<ListResponse>(TASK_API_PATHS.list);
  return (res.data || []).map(mapApiTaskToStore);
}

export async function fetchTasksPageFromApi(input: {
  page: number;
  pageSize: number;
  status?: 'pending' | 'in_progress' | 'submitted' | 'review' | 'approved';
  q?: string;
  from?: string; // YYYY-MM-DD (deadline date)
  to?: string; // YYYY-MM-DD (deadline date)
}): Promise<{ tasks: Task[]; pagination: Pagination }> {
  const res = await taskApiGet<ListResponse>(TASK_API_PATHS.list, {
    params: {
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
      q: input.q,
      from: input.from,
      to: input.to,
    },
  });
  const pagination = res.pagination || {
    page: input.page,
    pageSize: input.pageSize,
    total: (res.data || []).length,
    totalPages: 1,
  };
  return { tasks: (res.data || []).map(mapApiTaskToStore), pagination };
}

export async function createTaskMultipart(input: {
  title: string;
  description?: string;
  assignedTo: string;
  deadlineYmd: string;
  file: File;
}): Promise<Task> {
  const fd = new FormData();
  fd.append('title', input.title.trim());
  fd.append('assigned_to', String(parseInt(input.assignedTo, 10)));
  fd.append('deadline', input.deadlineYmd);
  if (input.description?.trim()) fd.append('description', input.description.trim());
  fd.append('attachment', input.file);
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.create, fd);
  return mapApiTaskToStore(res.data);
}

export async function updatePendingTaskMultipart(
  id: string,
  input: {
    title: string;
    description: string;
    assignedTo: string;
    deadlineYmd: string;
    file?: File | null;
  }
): Promise<Task> {
  const fd = new FormData();
  fd.append('title', input.title.trim());
  fd.append('assigned_to', String(parseInt(input.assignedTo, 10)));
  fd.append('deadline', input.deadlineYmd);
  fd.append('description', input.description);
  if (input.file && input.file.size > 0) fd.append('attachment', input.file);
  const res = await taskApiPut<OneResponse>(TASK_API_PATHS.update(id), fd);
  return mapApiTaskToStore(res.data);
}

export async function deleteTaskApi(id: string): Promise<void> {
  await taskApiDelete(TASK_API_PATHS.delete(id));
}

export async function startTaskWorkApi(id: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.startWork(id), {});
  return mapApiTaskToStore(res.data);
}

export async function submitTaskApi(id: string, submissionNote: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.submit(id), {
    submission_note: submissionNote.trim(),
  });
  return mapApiTaskToStore(res.data);
}

export async function moveTaskToReviewApi(id: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.sendReview(id), {});
  return mapApiTaskToStore(res.data);
}

export async function approveTaskApi(id: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.approve(id), {});
  return mapApiTaskToStore(res.data);
}

export async function forwardTaskToTeamLeaderApi(taskId: string, teamLeaderId: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.forwardTl(taskId), {
    team_leader_id: parseInt(teamLeaderId, 10),
  });
  return mapApiTaskToStore(res.data);
}

export async function addTaskCommentApi(taskId: string, comment: string): Promise<Task> {
  const res = await taskApiPost<OneResponse>(TASK_API_PATHS.comment(taskId), { comment: comment.trim() });
  return mapApiTaskToStore(res.data);
}

export async function fetchPendingTasksCountApi(): Promise<number> {
  const res = await taskApiGet<PendingTasksCountResponse>(TASK_API_PATHS.pendingTasksCount);
  return Number(res?.pendingTasks ?? 0);
}

export async function fetchOverdueTasksCountApi(): Promise<number> {
  const res = await taskApiGet<OverdueTasksCountResponse>(TASK_API_PATHS.overdueTasksCount);
  return Number(res?.overdueTasks ?? 0);
}
