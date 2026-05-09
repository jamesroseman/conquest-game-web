import { createContext } from "react";
import type { User } from "@/api/types";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInDev: (displayName: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
