import { firebaseAuth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

async function resolveBearerToken(): Promise<string | null> {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  if (firebaseAuth.currentUser) {
    return await firebaseAuth.currentUser.getIdToken();
  }
  return null;
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveBearerToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export async function getActiveAuthToken(): Promise<string | null> {
  return resolveBearerToken();
}
