import type { User } from "@/api/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface AuthResponse {
  token: string;
  userId: string;
  displayName: string;
  email: string | null;
}

function userFromAuth(r: AuthResponse): User {
  return { userId: r.userId, displayName: r.displayName, email: r.email };
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function loginWithGoogle(idToken: string): Promise<{ token: string; user: User }> {
  const r = await postJson<AuthResponse>("/auth/google", { idToken });
  return { token: r.token, user: userFromAuth(r) };
}

export async function devLogin(displayName: string): Promise<{ token: string; user: User }> {
  const r = await postJson<AuthResponse>("/auth/dev-login", { displayName });
  return { token: r.token, user: userFromAuth(r) };
}

export async function fetchMe(token: string): Promise<User | null> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/auth/me failed: ${res.status}`);
  const r = (await res.json()) as AuthResponse;
  return userFromAuth(r);
}
