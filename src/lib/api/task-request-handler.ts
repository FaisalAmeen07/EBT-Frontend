import { isAxiosError, type AxiosRequestConfig } from 'axios';
import { taskApiClient } from '@/lib/api/task-api.config';

function logTaskApiError(method: string, url: string, error: unknown): void {
  if (!isAxiosError(error)) {
    console.error(`[task-api] ${method} ${url}`, error);
    return;
  }
  const status = error.response?.status;
  const data = error.response?.data;
  const message =
    data && typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : error.message;
  const baseURL = error.config?.baseURL ?? '';
  const fullUrl = `${baseURL}${url}`;
  const code = (error as { code?: string }).code;
  console.error(`[task-api] ${method} ${fullUrl} failed`, {
    status,
    message: message || '(no message)',
    code: code || undefined,
    data,
    hint:
      !status && !error.response
        ? 'No response — task service down, wrong NEXT_PUBLIC_TASK_API_URL (use your Render URL, e.g. https://taskservice-backend.onrender.com), or task server CORS FRONTEND_ORIGINS missing your Vercel origin.'
        : undefined,
  });
}

export async function taskApiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await taskApiClient.get<T>(url, config);
    return res.data;
  } catch (e) {
    logTaskApiError('GET', url, e);
    throw e;
  }
}

export async function taskApiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    const res = await taskApiClient.post<T>(url, body, config);
    return res.data;
  } catch (e) {
    logTaskApiError('POST', url, e);
    throw e;
  }
}

export async function taskApiPut<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    const res = await taskApiClient.put<T>(url, body, config);
    return res.data;
  } catch (e) {
    logTaskApiError('PUT', url, e);
    throw e;
  }
}

export async function taskApiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await taskApiClient.delete<T>(url, config);
    return res.data;
  } catch (e) {
    logTaskApiError('DELETE', url, e);
    throw e;
  }
}
