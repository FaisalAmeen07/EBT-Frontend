import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiDelete, apiGet, apiPost } from '@/lib/api/axios-request-handler';
import type { Department, User } from '@/lib/store';
import { dbRoleToFrontendRole, fetchAllUsersForAdmin, mapAdminUserRowToStoreUser } from '@/services/admin.service';

export type TeamRow = {
  id: number;
  name: string;
  department?: string | null;
  leader_id?: number | null;
  created_at?: string;
};

export type GetTeamsResponse = {
  message: string;
  teams: TeamRow[];
};

export async function getTeamsApi(): Promise<GetTeamsResponse> {
  return apiGet<GetTeamsResponse>(API_PATHS.teams.list);
}

export type CreateTeamBody = {
  name: string;
  department?: string;
  leader_id: number;
  employee_ids: number[];
};

export async function createTeamApi(
  body: CreateTeamBody
): Promise<{ message: string; team: TeamRow }> {
  return apiPost(API_PATHS.teams.create, body);
}

export async function deleteTeamApi(teamId: number): Promise<{ message: string; team?: TeamRow }> {
  return apiDelete(API_PATHS.teams.delete(teamId));
}

export async function detachMemberApi(
  teamId: number,
  userId: number
): Promise<{ message: string }> {
  return apiPost<{ message: string }>(API_PATHS.teams.detachMember, {
    team_id: teamId,
    user_id: userId,
  });
}

export async function addEmployeesApi(
  teamId: number,
  employeeIds: number[]
): Promise<{ message: string; added?: number[] }> {
  return apiPost(API_PATHS.teams.addEmployees, {
    team_id: teamId,
    employee_ids: employeeIds,
  });
}

export async function moveMemberApi(
  userId: number,
  targetTeamId: number
): Promise<{ message: string }> {
  return apiPost<{ message: string }>(API_PATHS.teams.moveMember, {
    user_id: userId,
    target_team_id: targetTeamId,
  });
}

/** Resolve a team row by display name (case-insensitive trim). */
export async function findTeamRowByName(teamName: string): Promise<TeamRow | undefined> {
  const res = await getTeamsApi();
  const want = teamName.trim().toLowerCase();
  return res.teams?.find((t) => String(t.name).trim().toLowerCase() === want);
}

/** Two team names in one GET (e.g. shift member). */
export async function findTwoTeamRowsByName(
  nameA: string,
  nameB: string
): Promise<{ a?: TeamRow; b?: TeamRow }> {
  const res = await getTeamsApi();
  const norm = (s: string) => s.trim().toLowerCase();
  const na = norm(nameA);
  const nb = norm(nameB);
  let a: TeamRow | undefined;
  let b: TeamRow | undefined;
  for (const t of res.teams || []) {
    const key = String(t.name).trim().toLowerCase();
    if (key === na) a = t;
    if (key === nb) b = t;
    if (a && b) break;
  }
  return { a, b };
}

/** Admin directory users: `team` + roster `workSite` from `teams` (name + department on `teams` row). */
export type TeamRosterMemberRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  gdc_id?: string | null;
  profile_image?: string | null;
  /** Backend may attach per-member team label (e.g. Admin rows vs roster team name). */
  member_team_name?: string | null;
  member_work_site?: string | null;
};

export type MyTeamRosterResponse = {
  success: boolean;
  team_name: string | null;
  work_site: string | null;
  members: TeamRosterMemberRow[];
};

/** Maps API roster row → store user (shared `team` / `workSite` from roster response). */
export function mapRosterMemberToStoreUser(
  row: TeamRosterMemberRow,
  teamName: string | null,
  workSite: string | null
): User {
  const tn = teamName?.trim();
  const ws = workSite?.trim();
  return {
    id: String(row.id),
    name: row.name ?? '',
    email: row.email ?? '',
    role: dbRoleToFrontendRole(row.role),
    team: tn || undefined,
    workSite: ws || undefined,
    department: row.department ? (row.department as Department) : undefined,
    employeeCode: row.gdc_id ?? undefined,
    avatar: row.profile_image ?? undefined,
  };
}

export async function fetchMyTeamRoster(): Promise<MyTeamRosterResponse> {
  return apiGet<MyTeamRosterResponse>(API_PATHS.teams.myTeamRoster);
}

/** Team Leader / Employee: full allowed directory slice from API (never the admin “All users” list). */
export async function fetchVisibleDirectory(): Promise<MyTeamRosterResponse> {
  return apiGet<MyTeamRosterResponse>(API_PATHS.teams.visibleDirectory);
}

export function visibleDirectoryMembersToUsers(res: MyTeamRosterResponse): User[] {
  const fallbackTeam = res.team_name?.trim() ?? null;
  const fallbackSite = res.work_site?.trim() ?? null;
  return (res.members ?? []).map((row) =>
    mapRosterMemberToStoreUser(
      row,
      row.member_team_name?.trim() || fallbackTeam,
      row.member_work_site?.trim() || fallbackSite,
    ),
  );
}

export async function buildUsersWithResolvedTeams(): Promise<User[]> {
  const [teamsRes, usersRes] = await Promise.all([getTeamsApi(), fetchAllUsersForAdmin()]);
  const idToMeta = new Map<number, { name: string; department: string }>();
  for (const t of teamsRes.teams || []) {
    const dept = t.department != null && String(t.department).trim() !== '' ? String(t.department).trim() : '';
    idToMeta.set(Number(t.id), { name: String(t.name), department: dept });
  }
  return (usersRes.data || []).map((row) => {
    const u = mapAdminUserRowToStoreUser(row);
    const tid = row.team_id;
    if (tid != null && idToMeta.has(Number(tid))) {
      const meta = idToMeta.get(Number(tid))!;
      const profileDept =
        u.department != null && String(u.department).trim() !== '' ? String(u.department).trim() : '';
      const workSite = meta.department || profileDept || undefined;
      return { ...u, team: meta.name, workSite };
    }
    return u;
  });
}
