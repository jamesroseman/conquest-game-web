import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
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
    <>
      <header className="title-bar">
        <Link to="/login" className="brand">
          PANDEMRISK
        </Link>
        <span className="sub">// strategic atlas — login</span>
      </header>
      <div className="page starfield">
        <div className="panel" style={{ width: 360 }}>
          <div className="hd">
            authenticate <span className="right">v0.1</span>
          </div>
          <div className="bd" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, color: "var(--ink-dim)", lineHeight: 1.5, fontSize: 11 }}>
              Sign in to dispatch agents and contain the outbreak. Google sign-in is wired
              server-side; the dev login below is for local play.
            </p>

            <button
              type="button"
              disabled
              title="Configure VITE_GOOGLE_CLIENT_ID and wire @react-oauth/google to enable"
              className="btn"
            >
              Sign in with Google · disabled
            </button>

            {DEV_LOGIN_ENABLED ? (
              <form onSubmit={onDevSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="section-hd">dev login</div>
                <label className="label" htmlFor="display-name">Display name</label>
                <input
                  id="display-name"
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="commander"
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting || !name.trim()}
                >
                  {submitting ? "Signing in…" : "Continue"}
                </button>
                {error && <div className="alert">{error}</div>}
              </form>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 11 }}>
                Dev login is disabled in this build.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
