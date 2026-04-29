import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api/axios-request-handler';
import type { Department, Role, User } from '@/lib/store';

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  department?: string | null;
  gdc_id?: string | null;
  profile_image?: string | null;
  is_verified?: boolean;
  is_approved?: boolean;
  team_id?: number | null;
};

export type AllUsersApiResponse = {
  success: boolean;
  count: number;
  data: AdminUserRow[];
};

export function dbRoleToFrontendRole(dbRole: string): Role {
  const r = String(dbRole || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (r === 'admin') return 'Admin';
  if (r === 'hr') return 'HR';
  if (r === 'team_leader' || r === 'teamleader') return 'Team Leader';
  if (r === 'pending') return 'Pending User';
  return 'Employee';
}

/** Role string for POST approve / PUT update-role (Express + Postgres). */
export function frontendRoleToApiRole(role: Role): string {
  switch (role) {
    case 'Admin':
      return 'admin';
    case 'HR':
      return 'hr';
    case 'Team Leader':
      return 'team_leader';
    case 'Pending User':
      return 'pending';
    case 'Employee':
    default:
      return 'employee';
  }
}

export function mapAdminUserRowToStoreUser(row: AdminUserRow): User {
  return {
    id: String(row.id),
    name: row.name ?? '',
    email: row.email ?? '',
    role: dbRoleToFrontendRole(row.role),
    phone: row.phone ?? undefined,
    department: row.department ? (row.department as Department) : undefined,
    employeeCode: row.gdc_id ?? undefined,
    avatar: row.profile_image ?? undefined,
    isVerified: row.is_verified,
    isApproved: row.is_approved,
  };
}

export function fetchAllUsersForAdmin(): Promise<AllUsersApiResponse> {
  return apiGet<AllUsersApiResponse>(API_PATHS.admin.allUsers);
}

export function approveUserApi(
  userId: number,
  role: string
): Promise<{ message: string; user: AdminUserRow }> {
  return apiPost(API_PATHS.admin.approveUser, { userId, role });
}

export function updateUserRoleApi(
  userId: string | number,
  role: string
): Promise<{ message: string; user: Pick<AdminUserRow, 'id' | 'name' | 'email' | 'role'> }> {
  return apiPut(API_PATHS.admin.updateRole(userId), { role });
}

export function rejectUserApi(userId: number): Promise<{ message: string }> {
  return apiPost(API_PATHS.admin.rejectUser, { userId });
}

export function fetchAdminDepartmentsApi(): Promise<{ success: boolean; count: number; data: string[] }> {
  return apiGet(API_PATHS.admin.departments);
}

export function addDepartmentApi(name: string): Promise<{ message: string; department: string; data: string[] }> {
  return apiPost(API_PATHS.admin.departments, { name: name.trim() });
}

export function removeDepartmentApi(name: string): Promise<{ message: string; department: string; data: string[] }> {
  return apiDelete(API_PATHS.admin.deleteDepartment(name));
}
