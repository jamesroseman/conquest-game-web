import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

const DEV_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === "1";

export function LoginRoute(): JSX.Element {
  const { token, signInDev } = useAuth();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token) return <Navigate to="/" replace />;

  async function onDevSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInDev(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-semibold text-slate-100">Conquest</h1>
        <p className="mb-6 text-sm text-slate-400">
          Sign in to play. The Google sign-in flow is wired up server-side; the dev login is here
          for local play.
        </p>

        <button
          type="button"
          disabled
          title="Configure VITE_GOOGLE_CLIENT_ID and wire @react-oauth/google to enable"
          className="mb-6 w-full cursor-not-allowed rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-400"
        >
          Sign in with Google (configure to enable)
        </button>

        {DEV_LOGIN_ENABLED ? (
          <form onSubmit={onDevSubmit} className="space-y-3">
            <label className="block text-sm font-medium text-slate-300" htmlFor="display-name">
              Dev login
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900"
            >
              {submitting ? "Signing in…" : "Continue"}
            </button>
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </form>
        ) : (
          <p className="text-sm text-slate-400">Dev login is disabled in this build.</p>
        )}
      </div>
    </div>
  );
}
