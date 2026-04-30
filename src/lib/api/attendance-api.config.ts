import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { ACCESS_TOKEN_COOKIE } from '@/lib/api/axios.config';

const DEFAULT_ATTENDANCE_DEV = 'http://localhost:5003';

function resolveAttendanceBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_ATTENDANCE_API_URL?.trim() ?? '';
  const normalized = raw.replace(/\/$/, '');
  if (normalized) return normalized;

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[attendance-api] NEXT_PUBLIC_ATTENDANCE_API_URL is unset — using ${DEFAULT_ATTENDANCE_DEV}.`
    );
  } else {
    console.warn(
      `[attendance-api] NEXT_PUBLIC_ATTENDANCE_API_URL is unset — using ${DEFAULT_ATTENDANCE_DEV}. Set it on your host.`
    );
  }
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
  timeout: 30_000,
  withCredentials: true,
});

attendanceApiClient.interceptors.request.use((config) => attachAuth(config), (e) => Promise.reject(e));
