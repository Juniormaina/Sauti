import { firebaseAuth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  retryAfterSeconds?: number;

  constructor(message: string, status = 0, isNetworkError = false, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

export function isOfflineOrNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof ApiError) return err.isNetworkError || err.status === 0;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && (err.name === 'AbortError' || /network|fetch|timeout/i.test(err.message))) {
    return true;
  }
  return false;
}

async function resolveBearerToken(): Promise<string | null> {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  if (firebaseAuth.currentUser) {
    return await firebaseAuth.currentUser.getIdToken();
  }
  return null;
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 20000, retries, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const maxRetries = retries ?? (method === 'GET' ? 1 : 0);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError('You appear to be offline.', 0, true);
  }

  const token = await resolveBearerToken();
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(path, {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal || controller.signal,
      });
      clearTimeout(timer);

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text };
      }

      if (!response.ok) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let retryAfterSeconds: number | undefined;
        if (retryAfterHeader) {
          const parsedInt = Number(retryAfterHeader);
          if (Number.isFinite(parsedInt) && parsedInt > 0) {
            retryAfterSeconds = Math.ceil(parsedInt);
          } else {
            const parsedDate = Date.parse(retryAfterHeader);
            if (!Number.isNaN(parsedDate)) {
              const deltaSec = Math.ceil((parsedDate - Date.now()) / 1000);
              if (deltaSec > 0) retryAfterSeconds = deltaSec;
            }
          }
        }
        const apiErr = new ApiError(
          data?.error || `Request failed (${response.status})`,
          response.status,
          false,
          retryAfterSeconds
        );
        if (attempt < maxRetries && [502, 503, 504].includes(response.status)) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        throw apiErr;
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof ApiError && !err.isNetworkError) {
        throw err;
      }
      if (attempt < maxRetries && typeof navigator !== 'undefined' && navigator.onLine) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        err?.name === 'AbortError'
          ? 'The connection timed out on a slow network.'
          : err?.message || 'Unable to reach SAUTI right now.',
        0,
        true
      );
    }
  }

  throw lastError instanceof Error ? lastError : new ApiError('Request failed', 0, true);
}

export async function getActiveAuthToken(): Promise<string | null> {
  return resolveBearerToken();
}
