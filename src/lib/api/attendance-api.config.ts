import axios, { AxiosError, AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { ACCESS_TOKEN_COOKIE } from '@/lib/api/axios.config';

const DEFAULT_ATTENDANCE_DEV = 'http://localhost:5003';
const DEFAULT_ATTENDANCE_PROD = 'https://attendence-service-rdvv.onrender.com';

function resolveAttendanceBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_ATTENDANCE_API_URL?.trim() ?? '';
  const normalized = raw.replace(/\/$/, '');
  if (normalized) {
    if (
      process.env.NODE_ENV === 'production' &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
    ) {
      console.error(
        `[attendance-api] NEXT_PUBLIC_ATTENDANCE_API_URL is set to a localhost URL (${normalized}) in production — falling back to ${DEFAULT_ATTENDANCE_PROD}.`
      );
      return DEFAULT_ATTENDANCE_PROD;
    }
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      `[attendance-api] NEXT_PUBLIC_ATTENDANCE_API_URL is missing — using ${DEFAULT_ATTENDANCE_PROD}. Set it in Vercel env vars (no trailing slash).`
    );
    return DEFAULT_ATTENDANCE_PROD;
  }

  console.warn(
    `[attendance-api] NEXT_PUBLIC_ATTENDANCE_API_URL is unset — using ${DEFAULT_ATTENDANCE_DEV}. For deployed attendance API set .env.local, e.g. ${DEFAULT_ATTENDANCE_PROD}`
  );
  return DEFAULT_ATTENDANCE_DEV;
}

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const token = Cookies.get(ACCESS_TOKEN_COOKIE);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (config.data instanceof FormData) headers.delete('Content-Type');
  config.headers = headers;
  return config;
}

export const attendanceApiClient: AxiosInstance = axios.create({
  baseURL: resolveAttendanceBaseURL(),
  timeout: 90_000,
  withCredentials: true,
});

attendanceApiClient.interceptors.request.use((config) => attachAuth(config), (e) => Promise.reject(e));

attendanceApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { __retryOnce?: boolean }) | undefined;
    if (!config) return Promise.reject(error);
    const method = String(config.method || 'get').toUpperCase();
    const canRetry = method === 'GET' && !config.__retryOnce;
    const transient = error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    if (canRetry && transient) {
      config.__retryOnce = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return attendanceApiClient.request(config);
    }
    return Promise.reject(error);
  }
);
