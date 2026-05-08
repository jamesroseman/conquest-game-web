/**
 * Runtime app configuration.
 *
 * Resolution order (first match wins):
 *   1. localStorage["conquest.apiUrl"]      — per-browser override, set via the login UI
 *   2. window.__CONQUEST_CONFIG__.apiUrl    — from /public/config.js, editable post-build
 *   3. import.meta.env.VITE_API_URL         — build-time default
 *   4. "http://localhost:8000"              — fallback
 *
 * This means the same compiled bundle can point at any backend. Useful for:
 *   - swapping localhost ↔ deployed
 *   - playing on a friend's machine
 *   - running multiple backends side-by-side in different browser profiles
 */

const LS_API_URL = "conquest.apiUrl";
const LS_JWT = "conquest.jwt";

declare global {
  interface Window {
    __CONQUEST_CONFIG__?: {
      apiUrl?: string;
      devLogin?: boolean;
      googleClientId?: string;
    };
  }
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function getApiUrl(): string {
  const fromLs = typeof window !== "undefined" ? localStorage.getItem(LS_API_URL) : null;
  if (fromLs) return trimSlash(fromLs);
  const fromGlobal = typeof window !== "undefined" ? window.__CONQUEST_CONFIG__?.apiUrl : undefined;
  if (fromGlobal) return trimSlash(fromGlobal);
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return trimSlash(fromEnv);
  return "http://localhost:8000";
}

export function setApiUrl(url: string | null): void {
  if (url === null || url.trim() === "") {
    localStorage.removeItem(LS_API_URL);
  } else {
    localStorage.setItem(LS_API_URL, trimSlash(url.trim()));
  }
}

export function getDevLoginEnabled(): boolean {
  if (typeof window !== "undefined" && window.__CONQUEST_CONFIG__?.devLogin !== undefined) {
    return Boolean(window.__CONQUEST_CONFIG__.devLogin);
  }
  if (import.meta.env.VITE_DEV_LOGIN) {
    return import.meta.env.VITE_DEV_LOGIN === "1" || import.meta.env.VITE_DEV_LOGIN === "true";
  }
  return import.meta.env.DEV;
}

export function getGoogleClientId(): string | null {
  const fromGlobal =
    typeof window !== "undefined" ? window.__CONQUEST_CONFIG__?.googleClientId : undefined;
  if (fromGlobal) return fromGlobal;
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
}

export function getStoredToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(LS_JWT) : null;
}

export function setStoredToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(LS_JWT);
  } else {
    localStorage.setItem(LS_JWT, token);
  }
}
