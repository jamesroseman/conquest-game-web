import { useMemo } from "react";
import { ApolloProvider } from "@apollo/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { createApolloClient } from "@/api/apollo";
import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { LoginRoute } from "@/routes/LoginRoute";
import { LobbyListRoute } from "@/routes/LobbyListRoute";
import { CreateGameRoute } from "@/routes/CreateGameRoute";
import { GameRoute } from "@/routes/GameRoute";
import { getGoogleClientId } from "@/lib/config";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <p className="p-8 text-parchment/60">Loading…</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <LobbyListRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/games/new"
          element={
            <RequireAuth>
              <CreateGameRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/games/:gameId"
          element={
            <RequireAuth>
              <GameRoute />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  // One client per app instance. The HTTP URI is read at request time so
  // changes to localStorage["conquest.apiUrl"] take effect on the next request.
  const client = useMemo(() => createApolloClient(), []);
  const googleClientId = getGoogleClientId();

  const tree = (
    <ApolloProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </ApolloProvider>
  );

  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
  }
  return tree;
}
