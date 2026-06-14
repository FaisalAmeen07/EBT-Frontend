import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

export const ACCESS_TOKEN_COOKIE = 'accessToken';

const DEFAULT_DEV_ORIGIN = 'http://localhost:5000';
/** Deployed Express API (Render). Override with NEXT_PUBLIC_API_URL in hosting env or .env.production. */
const DEFAULT_PROD_ORIGIN = 'https://authservices-backend.onrender.com';

function resolveBaseURL(): string {
  // Browser dev: same-origin `/api/*` → Next.js rewrites (BACKEND_PROXY_URL / NEXT_PUBLIC_API_URL).
  // Must run before NEXT_PUBLIC_API_URL so local dev does not bypass the proxy and hit Render cross-origin.
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    return '';
  }

  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  const normalized = raw.replace(/\/$/, '');
  if (normalized) return normalized;

  if (process.env.NODE_ENV === 'development') {
    return DEFAULT_DEV_ORIGIN;
  }
  console.warn(
    `[api] NEXT_PUBLIC_API_URL is unset — using ${DEFAULT_PROD_ORIGIN}. Set NEXT_PUBLIC_API_URL on your host to override.`
  );
  return DEFAULT_PROD_ORIGIN;
}

function resolveClientVersion(): string {
  return (process.env.NEXT_PUBLIC_APP_VERSION?.trim() || process.env.npm_package_version || '0.0.0').trim();
}

function attachAuthAndDefaults(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const headers = AxiosHeaders.from(config.headers ?? {});

  const token = Cookies.get(ACCESS_TOKEN_COOKIE);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  headers.set('X-Client-Platform', 'web');
  headers.set('X-Client-Version', resolveClientVersion());

  if (config.data instanceof FormData) {
    headers.delete('Content-Type');
  } else if (
    !headers.has('Content-Type') &&
    config.data != null &&
    typeof config.data === 'object'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  config.headers = headers;
  return config;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => attachAuthAndDefaults(config),
  (error) => Promise.reject(error)
);
