import { isAxiosError } from 'axios';
import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiClient } from '@/lib/api/axios.config';
import { apiGet, apiPost } from '@/lib/api/axios-request-handler';
import type { AuthLoginResponse } from '@/lib/auth/auth.types';
import { mapLoginUserToStore } from '@/lib/auth/map-api-user';
import type { User } from '@/lib/store';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const d = error.response?.data;
    if (d && typeof d === 'object' && d !== null && 'message' in d) {
      return String((d as { message: unknown }).message);
    }
    // Axios may return non-standard error payloads; keep the message high-signal.
    const status = error.response?.status;
    const suffix = status ? ` (HTTP ${status})` : '';
    return `${error.message}${suffix}`;
  }
  if (error instanceof Error) return error.message || 'Something went wrong';
  try {
    const s = typeof error === 'string' ? error : JSON.stringify(error);
    return s?.trim() ? s : 'Something went wrong';
  } catch {
    return 'Something went wrong';
  }
}
  
export async function loginWithApi(
  email: string,
  password: string
): Promise<{ ok: true; user: User; token: string } | { ok: false; error: string }> {
  try {
    const data = await apiPost<AuthLoginResponse, { email: string; password: string }>(
      API_PATHS.auth.login,
      { email: email.trim().toLowerCase(), password }
    );

    // Deployed backend must return `token` + `user`. If it only returns `{ message: "Login successful" }`
    // we cannot establish a session on the dashboard.
    if (!data || typeof data !== 'object' || !('user' in data) || !('token' in data)) {
      throw new Error(
        'Login API response missing user/token. Redeploy backend to return { token, user }.'
      );
    }
    return { ok: true, user: mapLoginUserToStore(data.user), token: data.token };
  } catch (e) {
    return { ok: false, error: apiErrorMessage(e) };
  }
}

export async function registerWithApi(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const res = await apiPost<{ message: string; user?: unknown }, typeof input>(
      API_PATHS.auth.register,
      {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        phone: input.phone.trim(),
        department: input.department,
      }
    );
    return { ok: true, message: res.message || 'Registered.' };
  } catch (e) {
    return { ok: false, error: apiErrorMessage(e) };
  }
}

export async function logoutFromApi(): Promise<void> {
  try {
    await apiPost(API_PATHS.auth.logout, {});
  } catch {
    /* session may already be invalid */
  }
}

export async function fetchPublicDepartmentsApi(): Promise<string[]> {
  try {
    // Silent fetch: register form can safely fall back to defaults when backend is unavailable.
    const res = await apiClient.get<{ success: boolean; count: number; data: string[] }>(
      API_PATHS.auth.departments
    );
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch {
    return [];
  }
}

export async function forgotPasswordApi(
  email: string
): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  try {
    const res = await apiPost<{ message?: string }, { email: string }>(API_PATHS.auth.forgotPassword, {
      email: email.trim().toLowerCase(),
    });
    return { ok: true, message: res.message };
  } catch (e) {
    return { ok: false, error: apiErrorMessage(e) };
  }
}

export async function verifyResetOtpApi(
  otp: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiPost(API_PATHS.auth.verifyOtp, { otp: otp.replace(/\D/g, '').slice(0, 6) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErrorMessage(e) };
  }
}

export async function resetPasswordApi(
  newPassword: string,
  confirmPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiPost(API_PATHS.auth.resetPassword, { newPassword, confirmPassword });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErrorMessage(e) };
  }
}
