'use client';

import {
  Building2,
  Briefcase,
  Calendar,
  CheckCircle2,
  Check,
  ClipboardList,
  Plus,
  X,
  Send,
  Play,
  Eye,
  Trash2,
  Pencil,
  ListTodo,
  UserRound,
  CalendarDays,
  AlignLeft,
  ArrowRightCircle,
  Paperclip,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'next/navigation';
import { TaskWorkElapsed } from '@/components/tasks/TaskWorkElapsed';
import { getLatestSubmitNote } from '@/lib/task-submit-note';
import { getCurrentInProgressStartedAtIso } from '@/lib/taskWorkTimer';
import { fetchTasksPageFromApi } from '@/services/tasks.service';
import {
  useStore,
  useShallow,
  getManagementTaskDisplayStatus,
  isAdminCreatedTask,
  isTeamLeaderCreatedTask,
} from '@/lib/store';
import type { Task, TaskWorkflowStatus, Role } from '@/lib/store';
import { format } from 'date-fns';

import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/file-upload-limits';
import { toast } from '@/lib/toast';

const MAX_TASK_FILE_BYTES = MAX_UPLOAD_FILE_BYTES;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function taskApiErr(e: unknown): string {
  if (
    isAxiosError(e) &&
    e.response?.data &&
    typeof e.response.data === 'object' &&
    e.response.data !== null &&
    'message' in e.response.data
  ) {
    return String((e.response.data as { message: unknown }).message);
  }
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

function deadlineToIso(dateYmd: string): string {
  return new Date(`${dateYmd}T12:00:00`).toISOString();
}

type StatusFilter = 'All' | TaskWorkflowStatus;

const PROJECT_MANAGER_PAGE_SIZE = 6; // 2 rows (3 columns on lg)
const PROJECT_MANAGER_PAGE_SIZE_OPTIONS = [6, 12, 18] as const;

export default function TasksPage() {
  const searchParams = useSearchParams();
  const {
    tasks: allTasks,
    tasksListGeneration,
    currentUser,
    users,
    availability,
    createTask,
    startTaskWork,
    submitTask,
    moveTaskToReview,
    approveTask,
    deletePendingTask,
    updatePendingTask,
    forwardTaskToTeamLeader,
    refreshTasksFromApi,
  } = useStore(
    useShallow((s) => ({
      tasks: s.tasks,
      tasksListGeneration: s.tasksListGeneration,
      currentUser: s.currentUser,
      users: s.users,
      availability: s.availability,
      createTask: s.createTask,
      forwardTaskToTeamLeader: s.forwardTaskToTeamLeader,
      startTaskWork: s.startTaskWork,
      submitTask: s.submitTask,
      moveTaskToReview: s.moveTaskToReview,
      approveTask: s.approveTask,
      deletePendingTask: s.deletePendingTask,
      updatePendingTask: s.updatePendingTask,
      refreshTasksFromApi: s.refreshTasksFromApi,
    }))
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Pending');
  const [forwardTlId, setForwardTlId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [createAttachmentFile, setCreateAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [pmPage, setPmPage] = useState(1);
  const [pmPageSize, setPmPageSize] = useState<(typeof PROJECT_MANAGER_PAGE_SIZE_OPTIONS)[number]>(
    PROJECT_MANAGER_PAGE_SIZE
  );
  const [pmSearch, setPmSearch] = useState('');
  const [pmFrom, setPmFrom] = useState(''); // YYYY-MM-DD (deadline)
  const [pmTo, setPmTo] = useState(''); // YYYY-MM-DD (deadline)
  const [pmDateOpen, setPmDateOpen] = useState(false);
  const pmDatePopoverRef = useRef<HTMLDivElement>(null);
  const [pmListTasks, setPmListTasks] = useState<Task[]>([]);
  const [pmListPagination, setPmListPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>({ page: 1, pageSize: PROJECT_MANAGER_PAGE_SIZE, total: 0, totalPages: 1 });
  const [pmListLoading, setPmListLoading] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const pmPagedListMeta = useRef<{ filterKey: string; generation: number }>({
    filterKey: '',
    generation: -1,
  });

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [submitNote, setSubmitNote] = useState('');

  useEffect(() => {
    const id = searchParams.get('taskId');
    if (!id) return;
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    if (
      currentUser &&
      (currentUser.role === 'Admin' || currentUser.role === 'HR') &&
      isTeamLeaderCreatedTask(task, users)
    ) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId(id);
  }, [searchParams, allTasks, currentUser, users]);

  useEffect(() => {
    const rawStatus = searchParams.get('status');
    if (!rawStatus) return;
    const decodedStatus = decodeURIComponent(rawStatus).trim();
    const allowed: StatusFilter[] = ['All', 'Pending', 'In Progress', 'Submitted', 'Review', 'Approved'];
    if (allowed.includes(decodedStatus as StatusFilter)) {
      setStatusFilter(decodedStatus as StatusFilter);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!pmDateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPmDateOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const el = pmDatePopoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setPmDateOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [pmDateOpen]);

  useEffect(() => {
    setForwardTlId('');
  }, [selectedTaskId]);

  useEffect(() => {
    setSubmitNote('');
  }, [selectedTaskId]);

  useEffect(() => {
    if (!currentUser) return;
    void refreshTasksFromApi();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshTasksFromApi();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [currentUser?.id, refreshTasksFromApi]);

  const canCreateTask =
    currentUser?.role === 'Admin' || currentUser?.role === 'Team Leader';

  const tasks = (() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin' || currentUser.role === 'HR') {
      return allTasks.filter(t => !isTeamLeaderCreatedTask(t, users));
    }
    if (currentUser.role === 'Team Leader') {
      return allTasks.filter(t => {
        if (t.assignedTo === currentUser.id) return true;
        if (t.assignedBy === currentUser.id) return true;
        const a = users.find(u => u.id === t.assignedTo);
        return a?.role === 'Employee' && a.team === currentUser.team;
      });
    }
    return allTasks.filter(t => t.assignedTo === currentUser.id);
  })();

  const matchesStatusFilter = (t: Task, viewer: Role | undefined) => {
    if (statusFilter === 'All') return true;
    if (viewer === 'Admin' || viewer === 'HR') {
      const display = getManagementTaskDisplayStatus(t, users, viewer);
      if (statusFilter === 'Pending') return display === 'Pending';
      if (statusFilter === 'In Progress') return display === 'Working' || t.status === 'In Progress';
      return t.status === statusFilter;
    }
    return t.status === statusFilter;
  };

  const apiStatus = useMemo(() => {
    if (statusFilter === 'All') return undefined;
    if (statusFilter === 'Pending') return 'pending' as const;
    if (statusFilter === 'In Progress') return 'in_progress' as const;
    if (statusFilter === 'Submitted') return 'submitted' as const;
    if (statusFilter === 'Review') return 'review' as const;
    if (statusFilter === 'Approved') return 'approved' as const;
    return undefined;
  }, [statusFilter]);

  useEffect(() => {
    setPmPage(1);
  }, [statusFilter, pmPageSize, pmSearch, pmFrom, pmTo]);

  useEffect(() => {
    if (!currentUser) return;
    const filterKey = `${pmPage}|${pmPageSize}|${apiStatus ?? ''}|${pmSearch.trim()}|${pmFrom}|${pmTo}`;
    const prev = pmPagedListMeta.current;
    const onlyGenerationBump =
      prev.generation >= 0 &&
      filterKey === prev.filterKey &&
      tasksListGeneration !== prev.generation;
    pmPagedListMeta.current = { filterKey, generation: tasksListGeneration };

    let cancelled = false;
    void (async () => {
      if (!onlyGenerationBump) setPmListLoading(true);
      try {
        const qTrim = pmSearch.trim();
        const res = await fetchTasksPageFromApi({
          page: pmPage,
          pageSize: pmPageSize,
          status: apiStatus,
          q: qTrim || undefined,
          from: pmFrom || undefined,
          to: pmTo || undefined,
        });
        if (cancelled) return;
        setPmListTasks(res.tasks);
        setPmListPagination(res.pagination);
      } catch {
        if (cancelled) return;
        setPmListTasks([]);
        setPmListPagination({ page: pmPage, pageSize: pmPageSize, total: 0, totalPages: 1 });
      } finally {
        if (!cancelled) setPmListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch paged grid once when tasks sync signals (socket / mutations / tab focus), not every silent poll.
  }, [
    currentUser?.id,
    pmPage,
    pmPageSize,
    apiStatus,
    pmSearch,
    pmFrom,
    pmTo,
    tasksListGeneration,
  ]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    const task = allTasks.find(t => t.id === selectedTaskId) || null;
    if (!task) return null;
    if (
      currentUser &&
      (currentUser.role === 'Admin' || currentUser.role === 'HR') &&
      isTeamLeaderCreatedTask(task, users)
    )
      return null;
    return task;
  }, [allTasks, selectedTaskId, currentUser, users]);

  const selectedTaskSubmitNote = useMemo(
    () => (selectedTask ? getLatestSubmitNote(selectedTask) : null),
    [selectedTask]
  );

  const teamEmployeesForTl = useMemo(() => {
    if (!currentUser?.team) return [];
    return users.filter(u => u.role === 'Employee' && u.team === currentUser.team);
  }, [users, currentUser]);

  /** Create: Admin → HR only. Team Leader → own team employees. */
  const assignableUsersCreate = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return users.filter(u => u.role === 'HR');
    if (currentUser.role === 'Team Leader') return teamEmployeesForTl;
    return [];
  }, [users, currentUser, teamEmployeesForTl]);

  const teamLeaderOptions = useMemo(
    () => users.filter(u => u.role === 'Team Leader'),
    [users]
  );

  const assignableUsersAdminEdit = useMemo(
    () => users.filter(u => u.role === 'HR' || u.role === 'Team Leader'),
    [users]
  );

  const assigneeSelectOptions = useMemo(() => {
    if (!editTaskId) return assignableUsersCreate;
    if (currentUser?.role === 'Admin') return assignableUsersAdminEdit;
    if (currentUser?.role === 'Team Leader') return teamEmployeesForTl;
    return [];
  }, [
    editTaskId,
    assignableUsersCreate,
    assignableUsersAdminEdit,
    teamEmployeesForTl,
    currentUser?.role,
  ]);

  const canManagePendingTask = (task: Task) => {
    if (!currentUser || task.status !== 'Pending') return false;
    const assignee = users.find(u => u.id === task.assignedTo);
    if (currentUser.role === 'Admin') return !isTeamLeaderCreatedTask(task, users);
    if (currentUser.role === 'HR') {
      if (!(assignee?.role === 'HR' && task.assignedTo === currentUser.id)) return false;
      if (isAdminCreatedTask(task, users)) return false;
      return true;
    }
    if (currentUser.role === 'Team Leader') {
      if (task.assignedBy !== currentUser.id) return false;
      return assignee?.role === 'Employee' && assignee.team === currentUser.team;
    }
    return false;
  };

  const canForwardToTeamLead = (task: Task | null) => {
    if (!task || !currentUser) return false;
    if (currentUser.role !== 'HR') return false;
    if (task.status !== 'Pending') return false;
    if (task.assignedTo !== currentUser.id) return false;
    const assignee = users.find(u => u.id === task.assignedTo);
    return assignee?.role === 'HR';
  };

  const resetTaskForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDeadline('');
    setCreateAttachmentFile(null);
    setAttachmentError('');
    if (createFileInputRef.current) createFileInputRef.current.value = '';
  };

  const closeTaskFormModal = () => {
    setIsCreateModalOpen(false);
    setEditTaskId(null);
    resetTaskForm();
  };

  const openEditTask = (task: Task) => {
    if (!canManagePendingTask(task)) return;
    setIsCreateModalOpen(false);
    setEditTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedTo(task.assignedTo);
    setDeadline(format(new Date(task.deadline), 'yyyy-MM-dd'));
    setCreateAttachmentFile(null);
    setAttachmentError('');
    if (createFileInputRef.current) createFileInputRef.current.value = '';
  };

  const handleCreateAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      setCreateAttachmentFile(null);
      setAttachmentError('');
      return;
    }
    if (f.size > MAX_TASK_FILE_BYTES) {
      setCreateAttachmentFile(null);
      setAttachmentError(`Maximum file size is ${MAX_TASK_FILE_BYTES / (1024 * 1024)} MB.`);
      e.target.value = '';
      return;
    }
    setCreateAttachmentFile(f);
    setAttachmentError('');
  };

  const createFormReady =
    Boolean(
      title.trim() &&
        assignedTo &&
        deadline &&
        createAttachmentFile &&
        createAttachmentFile.size > 0 &&
        createAttachmentFile.size <= MAX_TASK_FILE_BYTES
    );

  const editFormReady = Boolean(title.trim() && assignedTo && deadline);

  const handleTaskFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (editTaskId) {
      if (!editFormReady) return;
      try {
        await updatePendingTask(editTaskId, {
          title: title.trim(),
          description,
          assignedTo,
          deadline: deadlineToIso(deadline),
        });
        setEditTaskId(null);
        resetTaskForm();
        toast('Task Updated Successfully', 'success');
      } catch (e) {
        const msg = isAxiosError(e)
          ? String((e.response?.data as { message?: string })?.message ?? e.message)
          : 'Update failed';
        toast(msg, 'error');
      }
      return;
    }

    if (!createFormReady || !createAttachmentFile) return;
    setIsCreatingTask(true);
    try {
      const dataUrl = await readFileAsDataUrl(createAttachmentFile);
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo,
        deadline: deadlineToIso(deadline),
        attachment: {
          fileName: createAttachmentFile.name,
          fileSize: createAttachmentFile.size,
          dataUrl,
        },
      });
      setIsCreateModalOpen(false);
      resetTaskForm();
      toast('Task Created Successfully', 'success');
    } catch (e) {
      if (isAxiosError(e)) {
        const msg = String((e.response?.data as { message?: string })?.message ?? e.message);
        toast(msg || 'Create failed', 'error');
      } else {
        setAttachmentError('Could not read the file. Try another file.');
      }
    } finally {
      setIsCreatingTask(false);
    }
  };

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'Pending', label: 'Pending' },
    { value: 'All', label: 'All status' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Review', label: 'Review' },
    { value: 'Approved', label: 'Approved' },
  ];

  const statusBadge = (status: string) => {
    if (status === 'Pending')
      return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-800';
    if (status === 'Working')
      return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-800';
    if (status === 'In Progress')
      return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-800';
    if (status === 'Submitted')
      return 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-100 dark:border-indigo-800';
    if (status === 'Review')
      return 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/50 dark:text-violet-100 dark:border-violet-800';
    if (status === 'Approved')
      return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-800';
    if (status === 'Rejected')
      return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/50 dark:text-rose-100 dark:border-rose-800';
    return 'bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800';
  };

  const reviewerCanActOnTask = (task: Task | null) => {
    if (!task || !currentUser) return false;
    if (task.status !== 'Submitted' && task.status !== 'Review') return false;
    if (isTeamLeaderCreatedTask(task, users)) {
      return currentUser.role === 'Team Leader' && task.assignedBy === currentUser.id;
    }
    if (currentUser.role === 'Admin' || currentUser.role === 'HR') return true;
    if (currentUser.role === 'Team Leader') {
      if (task.assignedTo === currentUser.id) return false;
      const assignedUser = users.find(u => u.id === task.assignedTo);
      return !!assignedUser && assignedUser.team === currentUser.team;
    }
    return false;
  };

  const reviewerCanMoveToReview = (task: Task | null) => {
    if (!task || !currentUser) return false;
    if (task.status !== 'Submitted') return false;
    if (isTeamLeaderCreatedTask(task, users)) {
      return currentUser.role === 'Team Leader' && task.assignedBy === currentUser.id;
    }
    if (currentUser.role === 'Admin' || currentUser.role === 'HR') return true;
    if (currentUser.role === 'Team Leader') {
      if (task.assignedTo === currentUser.id) return false;
      const assignedUser = users.find(u => u.id === task.assignedTo);
      return !!assignedUser && assignedUser.team === currentUser.team;
    }
    return false;
  };

  const showWorkflowPanel = useMemo(() => {
    if (!selectedTask || !currentUser) return false;
    const isWorker =
      (currentUser.role === 'Employee' || currentUser.role === 'Team Leader') &&
      selectedTask.assignedTo === currentUser.id &&
      (selectedTask.status === 'Pending' ||
        selectedTask.status === 'In Progress' ||
        selectedTask.status === 'Review');
    if (isWorker) return true;
    if (reviewerCanMoveToReview(selectedTask)) return true;
    if (reviewerCanActOnTask(selectedTask)) return true;
    return false;
  }, [selectedTask, currentUser, users]);

  const outsideAvailabilityHint = useMemo(() => {
    if (!selectedTask || !currentUser) return false;
    if (currentUser.role !== 'Employee' && currentUser.role !== 'Team Leader') return false;
    if (selectedTask.assignedTo !== currentUser.id) return false;

    if (currentUser.status && currentUser.status !== 'Available') return true;

    const dayName = format(new Date(selectedTask.deadline), 'EEEE');
    const userAvail = availability.find(a => a.userId === currentUser.id);
    const dayAvail = userAvail?.days.find(d => d.day === dayName);
    return !dayAvail || !dayAvail.enabled;
  }, [selectedTask, currentUser, availability]);

  const taskRefLabel = (id: string) =>
    `(TASK-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()})`;

  const shortName = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');

  const deadlineLabel = useMemo(() => {
    const from = pmFrom ? new Date(`${pmFrom}T12:00:00`) : null;
    const to = pmTo ? new Date(`${pmTo}T12:00:00`) : null;
    if (!from && !to) return 'Select range';
    if (from && !to) return `${format(from, 'MMM d, yyyy')} — …`;
    if (!from && to) return `… — ${format(to, 'MMM d, yyyy')}`;
    return `${format(from!, 'MMM d, yyyy')} — ${format(to!, 'MMM d, yyyy')}`;
  }, [pmFrom, pmTo]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-blue-500" />
          Project Manager
        </h1>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.02]">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(140px,180px)_minmax(220px,1fr)_minmax(180px,1fr)_auto] xl:items-end xl:gap-3">
          <div className="space-y-1">
            <label
              htmlFor="task-status-filter"
              className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
            >
              Status
            </label>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 text-xs font-semibold text-slate-900 dark:text-slate-50 shadow-none outline-none transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:border-blue-400 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/15 dark:focus:ring-blue-500/25"
            >
              {filterOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Deadline</span>
            <div className="relative" ref={pmDatePopoverRef}>
              <button
                type="button"
                onClick={() => setPmDateOpen((v) => !v)}
                className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 text-left text-xs font-semibold text-slate-900 dark:text-slate-50 shadow-none transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:focus:ring-indigo-500/25"
                aria-expanded={pmDateOpen}
              >
                <span
                  className={`min-w-0 flex-1 truncate ${pmFrom || pmTo ? 'text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {deadlineLabel}
                </span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
              </button>

              {pmDateOpen ? (
                <div className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-[min(100vw-2rem,20.5rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Deadline range</p>
                    <button
                      type="button"
                      onClick={() => setPmDateOpen(false)}
                      className="rounded-md p-1 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                      aria-label="Close date filter"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">From</span>
                      <input
                        type="date"
                        value={pmFrom}
                        max={pmTo || undefined}
                        onChange={(e) => setPmFrom(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">To</span>
                      <input
                        type="date"
                        value={pmTo}
                        min={pmFrom || undefined}
                        onChange={(e) => setPmTo(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPmFrom('');
                        setPmTo('');
                      }}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setPmDateOpen(false)}
                      className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1 sm:col-span-2 xl:col-span-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={pmSearch}
                onChange={(e) => setPmSearch(e.target.value)}
                placeholder="Project name…"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 py-0 pl-8 pr-8 text-xs font-semibold text-slate-900 dark:text-slate-50 shadow-none outline-none transition placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:border-blue-400 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/15 dark:focus:ring-blue-500/25"
              />
              {pmSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => setPmSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          {canCreateTask ? (
            <button
              type="button"
              onClick={() => {
                setEditTaskId(null);
                resetTaskForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-700 active:scale-[0.98] sm:col-span-2 xl:col-span-1 xl:w-auto xl:self-end"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          ) : null}
        </div>
      </div>

      {pmListLoading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-14 text-center text-slate-500 dark:text-slate-400">
          Loading tasks…
        </div>
      ) : pmListTasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 py-16 text-center text-slate-500 dark:text-slate-400">
          No tasks match this filter.
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pmListTasks.map(task => {
            const assignee = users.find(u => u.id === task.assignedTo);
            const dl = new Date(task.deadline);
            const deptOrTeam = assignee?.department ?? assignee?.team ?? '—';
            const listLabel =
              currentUser?.role === 'Admin' || currentUser?.role === 'HR'
                ? getManagementTaskDisplayStatus(task, users, currentUser.role)
                : task.status;
            return (
              <div key={task.id} className="relative">
              <button
                type="button"
                onClick={() => setSelectedTaskId(task.id)}
                className="group w-full text-left"
              >
                <div className="flex h-full w-full overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/60 transition hover:shadow-lg">
                  <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-slate-100/90 px-2 py-4 dark:bg-slate-800/95">
                    <span className="text-2xl font-semibold leading-none text-sky-600 dark:text-sky-400">
                      {format(dl, 'd')}
                    </span>
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                      {format(dl, 'MMM')}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 p-4">
                    <p className="min-w-0 font-bold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-blue-600">
                      {task.title}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge(
                        listLabel
                      )}`}
                    >
                      {listLabel}
                    </span>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {taskRefLabel(task.id)}
                      {currentUser?.role !== 'Employee' ? (
                        isTeamLeaderCreatedTask(task, users) && assignee?.name?.trim() ? (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            {shortName(assignee.name)}
                          </span>
                        ) : assignee?.team?.trim() ? (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                            {assignee.team.trim()}
                          </span>
                        ) : null
                      ) : null}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Building2 className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                      <span className="truncate">{deptOrTeam}</span>
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Briefcase className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                      <span className="truncate">{assignee?.role ?? 'Assignee'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden />
                      Due {format(dl, 'EEE, MMM d')}
                    </p>
                  </div>
                </div>
              </button>
              {canManagePendingTask(task) && (
                <div className="absolute right-3 top-3 z-10 flex gap-1">
                  <button
                    type="button"
                    aria-label="Edit pending task"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 dark:hover:border-sky-700 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditTask(task);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete pending task"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmAction({
                        title: 'Delete task',
                        message: 'Delete this pending task? This cannot be undone.',
                        confirmLabel: 'Delete',
                        onConfirm: () => {
                          void (async () => {
                            try {
                              await deletePendingTask(task.id);
                              setConfirmAction(null);
                              toast('Task deleted.', 'info');
                            } catch (e) {
                              toast(taskApiErr(e), 'error');
                            }
                          })();
                        },
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              </div>
            );
          })}
        </div>
        {pmListPagination.totalPages > 1 ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span>Rows per page:</span>
                <select
                  value={pmPageSize}
                  onChange={(e) =>
                    setPmPageSize(Number(e.target.value) as (typeof PROJECT_MANAGER_PAGE_SIZE_OPTIONS)[number])
                  }
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none transition hover:border-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/80 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/40"
                >
                  {PROJECT_MANAGER_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {pmListPagination.total === 0 ? 0 : (pmListPagination.page - 1) * pmListPagination.pageSize + 1}
                </span>
                –
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {Math.min(pmListPagination.page * pmListPagination.pageSize, pmListPagination.total)}
                </span>{' '}
                of <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{pmListPagination.total}</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={pmPage <= 1}
                onClick={() => setPmPage(p => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </button>
              <span className="px-2 text-sm font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                Page {pmPage} / {pmListPagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pmPage >= pmListPagination.totalPages}
                onClick={() => setPmPage(p => Math.min(pmListPagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
        </>
      )}

      {/* Create / Edit Task Modal */}
      {(isCreateModalOpen || editTaskId) && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeTaskFormModal();
          }}
        >
          <div
            className="flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-form-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-800/10 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 px-5 py-5 sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,rgba(59,130,246,0.15),transparent)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 dark:bg-white/5 text-white shadow-inner ring-1 ring-white/20">
                    {editTaskId ? (
                      <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden />
                    ) : (
                      <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 id="task-form-modal-title" className="text-lg font-bold tracking-tight text-white sm:text-xl">
                      {editTaskId ? 'Edit task' : 'New task'}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-300">
                      {editTaskId ? 'Update details before work starts.' : 'New task'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeTaskFormModal}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 dark:bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleTaskFormSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900 dark:to-slate-950"
            >
              <div className="space-y-5 px-5 py-6 sm:px-6">
                <div>
                  <label
                    htmlFor="task-title-input"
                    className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                  >
                    <ListTodo className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                    Task title
                  </label>
                  <input
                    id="task-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-50 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    placeholder="e.g. Update documentation"
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-assignee-select"
                    className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                  >
                    <UserRound className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                    Assign to
                  </label>
                  <div className="relative">
                    <select
                      id="task-assignee-select"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-4 pr-10 text-sm font-medium text-slate-900 dark:text-slate-50 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      required
                    >
                      <option value="">
                        {editTaskId
                          ? currentUser?.role === 'Team Leader'
                            ? 'Select employee'
                            : 'Select HR or Team Lead'
                          : currentUser?.role === 'Team Leader'
                            ? 'Select team employee'
                            : 'Select HR'}
                      </option>
                      {assigneeSelectOptions.map((user) => {
                        const dept = user.department ?? user.team ?? '—';
                        return (
                          <option key={user.id} value={user.id} title={`${user.role} · ${dept}`}>
                            {user.name} — {user.role} · {dept}
                          </option>
                        );
                      })}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="task-deadline-input"
                    className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                    Deadline
                  </label>
                  <div className="relative">
                    <input
                      id="task-deadline-input"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-4 pr-4 text-sm font-medium text-slate-900 dark:text-slate-50 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 [color-scheme:light]"
                      required
                    />
                  </div>
                </div>

                {!editTaskId && (
                  <div>
                    <label
                      htmlFor="task-attachment-input"
                      className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                      Attachment{' '}
                      <span className="font-normal normal-case text-slate-400 dark:text-slate-500">
                        (required · max {MAX_UPLOAD_FILE_MB} MB)
                      </span>
                    </label>
                    <input
                      ref={createFileInputRef}
                      id="task-attachment-input"
                      type="file"
                      onChange={handleCreateAttachmentChange}
                      className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-white dark:bg-slate-900 px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    />
                    {createAttachmentFile && (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        Selected: {createAttachmentFile.name} ({formatFileSize(createAttachmentFile.size)})
                      </p>
                    )}
                    {attachmentError ? (
                      <p className="mt-2 text-xs font-medium text-rose-600">{attachmentError}</p>
                    ) : null}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="task-description-input"
                    className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                  >
                    <AlignLeft className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                    Description <span className="font-normal normal-case text-slate-400 dark:text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="task-description-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="min-h-[7rem] w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-900 dark:text-slate-50 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    placeholder="Optional — acceptance criteria, links, or notes."
                  />
                </div>
              </div>

              <div className="mt-auto border-t border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-5 py-4 sm:px-6">
                <button
                  type="submit"
                  disabled={editTaskId ? !editFormReady : !createFormReady || isCreatingTask}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
                >
                  <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                  {isCreatingTask ? 'Creating…' : editTaskId ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 md:p-6 min-h-0 overflow-y-auto overscroll-contain bg-slate-900/60 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTaskId(null);
          }}
        >
          <div
            className="my-auto flex min-h-0 w-full max-w-2xl max-h-[min(92dvh,56rem)] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl sm:rounded-[2rem] sm:border-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-4 sm:px-6 sm:py-5 md:px-8">
              <div className="min-w-0 flex-1">
                <h2 id="task-detail-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 sm:text-xl flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 shrink-0 text-blue-500" />
                  Task Details
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Assignee: {users.find(u => u.id === selectedTask.assignedTo)?.name || 'Unassigned'} (
                  {users.find(u => u.id === selectedTask.assignedTo)?.role ?? '—'})
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {canManagePendingTask(selectedTask) && (
                  <button
                    type="button"
                    onClick={() => {
                      openEditTask(selectedTask);
                      setSelectedTaskId(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 transition hover:bg-sky-50 dark:hover:bg-sky-950/50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </button>
                )}
                {canManagePendingTask(selectedTask) && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        title: 'Delete task',
                        message: 'Delete this pending task? This cannot be undone.',
                        confirmLabel: 'Delete',
                        onConfirm: () => {
                          void (async () => {
                            try {
                              await deletePendingTask(selectedTask.id);
                              setSelectedTaskId(null);
                              setConfirmAction(null);
                              toast('Task deleted.', 'info');
                            } catch (e) {
                              toast(taskApiErr(e), 'error');
                            }
                          })();
                        },
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white dark:border-rose-800 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                  }}
                  className="shrink-0 rounded-full border border-transparent p-2 transition-colors hover:border-slate-100 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  title="Close"
                >
                  <X className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
              <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold leading-snug text-slate-900 dark:text-slate-50 sm:text-2xl">{selectedTask.title}</h3>
                    {selectedTask.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base whitespace-pre-wrap break-words">
                        {selectedTask.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-slate-400 dark:text-slate-500">No description</p>
                    )}
                    {selectedTask.attachment && (
                      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Attachment</p>
                        <a
                          href={selectedTask.attachment.dataUrl}
                          download={selectedTask.attachment.fileName}
                          className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 hover:text-blue-800"
                        >
                          <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                          {selectedTask.attachment.fileName}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            ({formatFileSize(selectedTask.attachment.fileSize)})
                          </span>
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${statusBadge(
                        currentUser?.role === 'Admin' || currentUser?.role === 'HR'
                          ? getManagementTaskDisplayStatus(selectedTask, users, currentUser.role)
                          : selectedTask.status
                      )}`}
                    >
                      {currentUser?.role === 'Admin' || currentUser?.role === 'HR'
                        ? getManagementTaskDisplayStatus(selectedTask, users, currentUser.role)
                        : selectedTask.status}
                    </span>
                    {outsideAvailabilityHint && (
                      <span className="text-[10px] font-bold px-3 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-100 uppercase tracking-widest dark:bg-rose-950/50 dark:text-rose-100 dark:border-rose-800">
                        Outside availability
                      </span>
                    )}
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      Due {format(new Date(selectedTask.deadline), 'MMM d')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 break-all">
                    {taskRefLabel(selectedTask.id)}
                    {currentUser?.role !== 'Employee' ? (
                      isTeamLeaderCreatedTask(selectedTask, users) &&
                      users.find((u) => u.id === selectedTask.assignedTo)?.name?.trim() ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          {shortName(users.find((u) => u.id === selectedTask.assignedTo)!.name!)}
                        </span>
                      ) : users.find((u) => u.id === selectedTask.assignedTo)?.team?.trim() ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          {users.find((u) => u.id === selectedTask.assignedTo)!.team!.trim()}
                        </span>
                      ) : null
                    ) : null}
                  </span>
                </div>

                {selectedTaskSubmitNote ? (
                  <div className="rounded-xl border border-indigo-100/60 bg-gradient-to-br from-slate-50/90 to-indigo-50/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/80">
                      Submission note
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                      {selectedTaskSubmitNote}
                    </p>
                  </div>
                ) : null}

                {currentUser?.role === 'Team Leader' &&
                  selectedTask.status === 'In Progress' &&
                  selectedTask.assignedTo !== currentUser.id && (
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 to-indigo-50/40 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200/50">
                          <Clock className="h-5 w-5" aria-hidden />
                        </span>
                        <TaskWorkElapsed
                          startedAtIso={getCurrentInProgressStartedAtIso(selectedTask)}
                          label="Team member — time on task"
                        />
                      </div>
                      <p className="max-w-sm text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        Live timer from when they pressed Start Work. Employees do not see this card — only Team Leaders do.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {canForwardToTeamLead(selectedTask) && (
                <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50/80 p-4 sm:p-5 space-y-3">
                  <h4 className="text-sm font-bold text-indigo-900">Forward to Team Lead (HR only)</h4>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="forward-tl" className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-indigo-700">
                        Team Lead
                      </label>
                      <select
                        id="forward-tl"
                        value={forwardTlId}
                        onChange={(e) => setForwardTlId(e.target.value)}
                        className="w-full rounded-xl border border-indigo-200 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-50 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Select Team Lead</option>
                        {teamLeaderOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} — {u.team ?? 'Team'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={!forwardTlId}
                      onClick={() => {
                        if (!forwardTlId) return;
                        void (async () => {
                          try {
                            await forwardTaskToTeamLeader(selectedTask.id, forwardTlId);
                            setForwardTlId('');
                            toast(
                              'Forwarded to Team Lead. They can start work from Project Manager.',
                              'success'
                            );
                          } catch (e) {
                            toast(taskApiErr(e), 'error');
                          }
                        })();
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowRightCircle className="h-4 w-4" />
                      Forward
                    </button>
                  </div>
                </div>
              )}

              {showWorkflowPanel && (
              <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] p-4 sm:p-5 space-y-4">
                {(currentUser?.role === 'Employee' || currentUser?.role === 'Team Leader') &&
                  selectedTask.assignedTo === currentUser.id &&
                  (selectedTask.status === 'In Progress' || selectedTask.status === 'Review') && (
                    <div className="space-y-2">
                      <label htmlFor="task-submit-note" className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Submission note <span className="text-rose-600">(required)</span>
                      </label>
                      <textarea
                        id="task-submit-note"
                        value={submitNote}
                        onChange={e => setSubmitNote(e.target.value)}
                        rows={3}
                        placeholder="Describe what you completed, links, or handoff details for your Team Leader…"
                        className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  )}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Workflow Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {(currentUser?.role === 'Employee' || currentUser?.role === 'Team Leader') &&
                      selectedTask.assignedTo === currentUser.id &&
                      selectedTask.status === 'Pending' && (
                        <button
                          onClick={() => {
                            void (async () => {
                              try {
                                await startTaskWork(selectedTask.id);
                                toast('Task started. Status updated to In Progress.', 'success');
                              } catch (e) {
                                toast(taskApiErr(e), 'error');
                              }
                            })();
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Work
                        </button>
                      )}

                    {(currentUser?.role === 'Employee' || currentUser?.role === 'Team Leader') &&
                      selectedTask.assignedTo === currentUser.id &&
                      (selectedTask.status === 'In Progress' || selectedTask.status === 'Review') && (
                        <button
                          disabled={!submitNote.trim()}
                          onClick={() => {
                            const note = submitNote.trim();
                            if (!note) return;
                            void (async () => {
                              try {
                                await submitTask(selectedTask.id, note);
                                setSubmitNote('');
                                toast(
                                  selectedTask.status === 'Review'
                                    ? 'Resubmitted. Waiting for approval.'
                                    : 'Task submitted. Waiting for approval.',
                                  'success'
                                );
                              } catch (e) {
                                toast(taskApiErr(e), 'error');
                              }
                            })();
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          Submit
                        </button>
                      )}

                    {reviewerCanMoveToReview(selectedTask) && (
                      <button
                        onClick={() => {
                          void (async () => {
                            try {
                              await moveTaskToReview(selectedTask.id);
                              toast('Task moved to Review.', 'success');
                            } catch (e) {
                              toast(taskApiErr(e), 'error');
                            }
                          })();
                        }}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Send to Review
                      </button>
                    )}

                    {reviewerCanActOnTask(selectedTask) && (
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              await approveTask(selectedTask.id);
                              toast('Approved. Task marked as Approved.', 'success');
                              setSelectedTaskId(null);
                            } catch (e) {
                              toast(taskApiErr(e), 'error');
                            }
                          })();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="schedule-confirm-title"
            aria-describedby="schedule-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="schedule-confirm-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {confirmAction.title}
            </h2>
            <p id="schedule-confirm-desc" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {confirmAction.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmAction.onConfirm()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700"
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
