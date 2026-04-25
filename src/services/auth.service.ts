import { isAxiosError } from 'axios';
import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiPost } from '@/lib/api/axios-request-handler';
import type { AuthLoginResponse } from '@/lib/auth/auth.types';
import { mapLoginUserToStore } from '@/lib/auth/map-api-user';
import type { User } from '@/lib/store';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const d = error.response?.data;
    if (d && typeof d === 'object' && d !== null && 'message' in d) {
      return String((d as { message: unknown }).message);
    }
    return error.message;
  }
  return 'Something went wrong';
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
