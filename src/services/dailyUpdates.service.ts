import { taskApiGet, taskApiPut } from '@/lib/api/task-request-handler';
import { API_PATHS } from '@/lib/api/api-base-urls';
import type { EmployeeDailyUpdate, HRDailySummary, TeamLeaderDailySummary } from '@/lib/store';

const DAILY_UPDATES_API_PATHS = API_PATHS.task.dailyUpdates;

type EmployeeUpdateRow = {
  id: string | number;
  userId: string | number;
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type TeamLeaderSummaryRow = {
  id: string | number;
  team: string;
  date: string;
  authorId: string | number;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type HrSummaryRow = {
  id: string | number;
  date: string;
  authorId: string | number;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse<T> = { success: boolean; data: T[] };
type OneResponse<T> = { success: boolean; data: T };

type TlBundleResponse = {
  success: boolean;
  team_name: string | null;
  members?: Array<{
    id: string | number;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  }>;
  employee_updates: EmployeeUpdateRow[];
  team_leader_summary: TeamLeaderSummaryRow | null;
};

type LeadershipResponse = {
  success: boolean;
  team_leader_summaries?: TeamLeaderSummaryRow[] | unknown;
  hr_summary?: HrSummaryRow | unknown | null;
  /** Some gateways / older payloads wrap under `data`. */
  data?: {
    team_leader_summaries?: unknown[];
    hr_summary?: unknown | null;
  };
};

function toYmd(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function mapEmployeeRow(r: EmployeeUpdateRow): EmployeeDailyUpdate {
  return {
    id: String(r.id),
    userId: String(r.userId),
    date: toYmd(r.date),
    body: r.body ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapTlRow(r: TeamLeaderSummaryRow): TeamLeaderDailySummary {
  return {
    id: String(r.id),
    team: r.team ?? '',
    date: toYmd(r.date),
    authorId: String(r.authorId),
    body: r.body ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Normalize TL summary rows whether the API sent camelCase (model mapper) or raw snake_case.
 */
export function normalizeTeamLeaderSummaryPayload(row: unknown): TeamLeaderDailySummary | null {
  if (!isPlainObject(row)) return null;
  const id =
    row.id != null ? String(row.id) : '';
  const team = String(row.team ?? row.team_name ?? '').trim();
  const authorRaw = row.authorId ?? row.author_id;
  const authorId = authorRaw != null ? String(authorRaw) : '';
  const body = String(row.body ?? '');
  const date = toYmd(row.date);
  const createdAt =
    typeof row.createdAt === 'string'
      ? row.createdAt
      : typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString();
  const updatedAt =
    typeof row.updatedAt === 'string'
      ? row.updatedAt
      : typeof row.updated_at === 'string'
        ? row.updated_at
        : createdAt;

  const stableId =
    id ||
    (authorId || team || date
      ? `tl-${authorId || 'na'}-${team || 'noteam'}-${date || 'nodate'}`
      : '');
  if (!stableId || (!team && !body && !authorId)) return null;

  return {
    id: stableId,
    team,
    date,
    authorId,
    body,
    createdAt,
    updatedAt,
  };
}

function normalizeHrSummaryPayload(row: unknown): HRDailySummary | null {
  if (!isPlainObject(row)) return null;
  const idRaw = row.id;
  const authorRaw = row.authorId ?? row.author_id;
  if (idRaw == null || authorRaw == null) return null;
  return mapHrRow({
    id: idRaw as string | number,
    date: String(row.date ?? ''),
    authorId: authorRaw as string | number,
    body: String(row.body ?? ''),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.created_at ?? ''),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : String(row.updated_at ?? ''),
  });
}

function mapHrRow(r: HrSummaryRow): HRDailySummary {
  return {
    id: String(r.id),
    date: toYmd(r.date),
    authorId: String(r.authorId),
    body: r.body ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchMyEmployeeDailyUpdatesApi(): Promise<EmployeeDailyUpdate[]> {
  const res = await taskApiGet<ListResponse<EmployeeUpdateRow>>(DAILY_UPDATES_API_PATHS.employeeList);
  return (res.data || []).map(mapEmployeeRow);
}

export async function upsertMyEmployeeDailyUpdateApi(input: {
  date: string;
  body: string;
}): Promise<EmployeeDailyUpdate> {
  const res = await taskApiPut<OneResponse<EmployeeUpdateRow>>(DAILY_UPDATES_API_PATHS.employeeUpsert, {
    date: input.date,
    body: input.body,
  });
  return mapEmployeeRow(res.data);
}

export async function fetchTeamLeaderDailyBundleApi(date: string): Promise<{
  teamName: string | null;
  members: Array<{ id: string; name: string; email: string; role: string }>;
  employeeUpdates: EmployeeDailyUpdate[];
  mySummary: TeamLeaderDailySummary | null;
}> {
  const res = await taskApiGet<TlBundleResponse>(DAILY_UPDATES_API_PATHS.teamLeaderBundle, { params: { date } });
  return {
    teamName: res.team_name,
    members: (res.members || []).map((m) => ({
      id: String(m.id),
      name: m.name != null ? String(m.name) : '',
      email: m.email != null ? String(m.email) : '',
      role: m.role != null ? String(m.role) : '',
    })),
    employeeUpdates: (res.employee_updates || []).map(mapEmployeeRow),
    mySummary: res.team_leader_summary ? mapTlRow(res.team_leader_summary) : null,
  };
}

export async function upsertTeamLeaderSummaryApi(input: {
  date: string;
  body: string;
}): Promise<TeamLeaderDailySummary> {
  const res = await taskApiPut<OneResponse<TeamLeaderSummaryRow>>(DAILY_UPDATES_API_PATHS.teamLeaderUpsertSummary, {
    date: input.date,
    body: input.body,
  });
  return mapTlRow(res.data);
}

export async function fetchLeadershipOverviewApi(date: string): Promise<{
  teamLeaderSummaries: TeamLeaderDailySummary[];
  hrSummary: HRDailySummary | null;
}> {
  const res = await taskApiGet<LeadershipResponse>(DAILY_UPDATES_API_PATHS.leadershipOverview, { params: { date } });
  const rawList = Array.isArray(res.team_leader_summaries)
    ? res.team_leader_summaries
    : Array.isArray(res.data?.team_leader_summaries)
      ? res.data?.team_leader_summaries
      : [];

  const teamLeaderSummaries = rawList
    .map((row) => normalizeTeamLeaderSummaryPayload(row))
    .filter((r): r is TeamLeaderDailySummary => Boolean(r));

  const rawHr =
    res.hr_summary != null ? res.hr_summary : res.data?.hr_summary != null ? res.data?.hr_summary : null;
  const hrSummaryNorm = normalizeHrSummaryPayload(rawHr);

  return {
    teamLeaderSummaries,
    hrSummary: hrSummaryNorm,
  };
}

export async function upsertHrSummaryApi(input: { date: string; body: string }): Promise<HRDailySummary> {
  const res = await taskApiPut<OneResponse<HrSummaryRow>>(DAILY_UPDATES_API_PATHS.hrUpsertSummary, {
    date: input.date,
    body: input.body,
  });
  return mapHrRow(res.data);
}

