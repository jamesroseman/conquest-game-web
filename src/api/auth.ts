import { getApiUrl } from "@/lib/config";

export interface AuthUser {
  userId: string;
  displayName: string;
  email: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface RawAuthResponse {
  token: string;
  userId: string;
  displayName: string;
  email: string | null;
}

function unwrap(raw: RawAuthResponse): AuthResponse {
  return {
    token: raw.token,
    user: { userId: raw.userId, displayName: raw.displayName, email: raw.email },
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

export async function authGoogle(idToken: string): Promise<AuthResponse> {
  return unwrap(await postJson<RawAuthResponse>("/auth/google", { idToken }));
}

export async function authDevLogin(displayName: string, email?: string): Promise<AuthResponse> {
  return unwrap(
    await postJson<RawAuthResponse>("/auth/dev-login", {
      displayName,
      ...(email ? { email } : {}),
    }),
  );
}

export async function authMe(token: string): Promise<AuthUser | null> {
  const res = await fetch(`${getApiUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = (await res.json()) as RawAuthResponse;
  return { userId: raw.userId, displayName: raw.displayName, email: raw.email };
}
