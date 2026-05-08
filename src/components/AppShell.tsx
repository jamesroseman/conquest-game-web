import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

export function AppShell(): JSX.Element {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
        <Link to="/" className="text-lg font-semibold tracking-wide text-slate-100">
          Conquest
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user && (
            <span className="text-slate-300">
              Signed in as <span className="font-medium text-slate-100">{user.displayName}</span>
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
