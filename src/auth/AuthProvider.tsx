import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@/api/types";
import { fetchMe, devLogin as apiDevLogin, loginWithGoogle as apiGoogleLogin } from "@/api/auth";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/auth/storage";
import { setUnauthorizedHandler } from "@/api/apollo";
import { AuthContext, type AuthContextValue } from "@/auth/AuthContext";

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  const signOut = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    fetchMe(stored)
      .then((u) => {
        if (cancelled) return;
        if (u) {
          setUser(u);
          setToken(stored);
        } else {
          clearStoredToken();
          setToken(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredToken();
        setToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInDev = useCallback(async (displayName: string) => {
    const { token: t, user: u } = await apiDevLogin(displayName);
    setStoredToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const { token: t, user: u } = await apiGoogleLogin(idToken);
    setStoredToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, signInDev, signInWithGoogle, signOut }),
    [user, token, loading, signInDev, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
