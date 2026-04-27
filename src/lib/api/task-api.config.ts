import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { ACCESS_TOKEN_COOKIE } from '@/lib/api/axios.config';

/** Local dev only when `NEXT_PUBLIC_TASK_API_URL` is unset. Production must set the env var (e.g. Render HTTPS URL). */
const DEFAULT_TASK_DEV = 'http://localhost:5001';
/** Production fallback when env var is missing (Render). */
const DEFAULT_TASK_PROD = 'https://taskmanagment-backend-34i7.onrender.com';

function resolveTaskBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_TASK_API_URL?.trim() ?? '';
  const normalized = raw.replace(/\/$/, '');
  if (normalized) {
    if (
      process.env.NODE_ENV === 'production' &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
    ) {
      console.error(
        `[task-api] NEXT_PUBLIC_TASK_API_URL is set to a localhost URL (${normalized}) in production — falling back to ${DEFAULT_TASK_PROD}. Fix the Production env var and redeploy.`
      );
      return DEFAULT_TASK_PROD;
    }
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      `[task-api] NEXT_PUBLIC_TASK_API_URL is missing — using ${DEFAULT_TASK_PROD}. Set it in Vercel env vars (no trailing slash).`
    );
    return DEFAULT_TASK_PROD;
  }

  console.warn(
    `[task-api] NEXT_PUBLIC_TASK_API_URL is unset — using ${DEFAULT_TASK_DEV}. For deployed task API set .env.local, e.g. ${DEFAULT_TASK_PROD}`
  );
  return DEFAULT_TASK_DEV;
}

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const token = Cookies.get(ACCESS_TOKEN_COOKIE);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (config.data instanceof FormData) headers.delete('Content-Type');
  config.headers = headers;
  return config;
}

/** Axios client for `taskmanagment-backend` (separate from main GDC auth API). */
export const taskApiClient: AxiosInstance = axios.create({
  baseURL: resolveTaskBaseURL(),
  timeout: 120_000,
  withCredentials: true,
});

taskApiClient.interceptors.request.use((config) => attachAuth(config), (e) => Promise.reject(e));
