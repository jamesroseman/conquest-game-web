import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authDevLogin, authGoogle, authMe, type AuthUser } from "@/api/auth";
import { getStoredToken, setStoredToken } from "@/lib/config";
import { setUnauthorizedHandler } from "@/api/apollo";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  status: "loading" | "anonymous" | "authenticated";
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInDev: (displayName: string, email?: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "anonymous" | "authenticated">(
    token ? "loading" : "anonymous",
  );

  const signOut = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus("anonymous");
      setUser(null);
      return;
    }
    setStatus("loading");
    authMe(token)
      .then((u) => {
        if (cancelled) return;
        if (!u) {
          signOut();
        } else {
          setUser(u);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) signOut();
      });
    return () => {
      cancelled = true;
    };
  }, [token, signOut]);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const res = await authGoogle(idToken);
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const signInDev = useCallback(async (displayName: string, email?: string) => {
    const res = await authDevLogin(displayName, email);
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, status, signInWithGoogle, signInDev, signOut }),
    [user, token, status, signInWithGoogle, signInDev, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
