import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/auth/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ApiUrlSettings } from "@/components/ui/ApiUrlSettings";
import { getDevLoginEnabled, getGoogleClientId } from "@/lib/config";

export function LoginRoute() {
  const { status, signInDev, signInWithGoogle } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;

  const showDev = getDevLoginEnabled();
  const googleClientId = getGoogleClientId();

  async function onDevSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await signInDev(name.trim());
      nav("/", { replace: true });
    } catch (err) {
      toast.push((err as Error).message || "Dev login failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl tracking-wider text-amber-400">CONQUEST</h1>
        <p className="mt-1 text-parchment/70">
          A turn-based strategy game with a shared pandemic mechanic.
        </p>

        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-parchment/20 bg-ocean/40 p-6 shadow-xl">
          {googleClientId && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-parchment/60">
                Sign in
              </p>
              <GoogleLogin
                onSuccess={async (cred) => {
                  if (!cred.credential) {
                    toast.push("No Google credential returned", "error");
                    return;
                  }
                  try {
                    await signInWithGoogle(cred.credential);
                    nav("/", { replace: true });
                  } catch (err) {
                    toast.push((err as Error).message || "Google sign-in failed", "error");
                  }
                }}
                onError={() => toast.push("Google sign-in failed", "error")}
              />
            </div>
          )}

          {showDev && (
            <form onSubmit={onDevSubmit} className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-parchment/60">
                Dev login
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                className="rounded bg-ocean-deep px-3 py-2 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              />
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting ? "Signing in…" : "Continue"}
              </Button>
            </form>
          )}

          {!googleClientId && !showDev && (
            <p className="text-sm text-red-300">
              No sign-in methods are enabled. Set VITE_GOOGLE_CLIENT_ID or VITE_DEV_LOGIN.
            </p>
          )}
        </div>

        <div className="mt-4">
          <ApiUrlSettings />
        </div>
      </div>
    </div>
  );
}
