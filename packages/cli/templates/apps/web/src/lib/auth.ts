const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const TOKEN_KEY = 'ship_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { message?: string } & T;
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}

export async function hasAdmin(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/has-admin`);
  const data = (await res.json()) as { hasAdmin?: boolean };
  return Boolean(data.hasAdmin);
}

export function registerFirstAdmin(email: string, password: string) {
  return post<{ token: string; user: AuthUser }>('/auth/register-first-admin', { email, password });
}

export function login(email: string, password: string) {
  return post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
}

export async function me(token: string): Promise<AuthUser | null> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: AuthUser };
  return data.user ?? null;
}
