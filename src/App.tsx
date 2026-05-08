import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApolloProvider } from "@apollo/client";
import { createApolloClient } from "@/api/apollo";
import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/useAuth";
import { LoginRoute } from "@/routes/LoginRoute";
import { LobbyListRoute } from "@/routes/LobbyListRoute";
import { CreateGameRoute } from "@/routes/CreateGameRoute";
import { GameRoute } from "@/routes/GameRoute";
import { AppShell } from "@/components/AppShell";

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { token, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-300">Loading…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<LobbyListRoute />} />
        <Route path="/games/new" element={<CreateGameRoute />} />
        <Route path="/games/:gameId" element={<GameRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App(): JSX.Element {
  const client = useMemo(() => createApolloClient(), []);
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ApolloProvider>
  );
}
