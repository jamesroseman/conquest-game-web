import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

interface Props {
  meta?: React.ReactNode;
}

export function AppShell({ meta }: Props): JSX.Element {
  const { user, signOut } = useAuth();
  return (
    <>
      <header className="title-bar">
        <Link to="/" className="brand">
          PANDEMRISK
        </Link>
        <span className="sub">// strategic atlas</span>
        <span className="meta">
          {meta}
          {user && (
            <span>
              <b>{user.displayName}</b>
            </span>
          )}
          <button type="button" onClick={signOut} className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            Sign out
          </button>
        </span>
      </header>
      <Outlet />
    </>
  );
}
