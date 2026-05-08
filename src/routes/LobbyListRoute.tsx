import { useMutation, useQuery } from "@apollo/client";
import { Link, useNavigate } from "react-router-dom";
import { JOINABLE_GAMES_QUERY, JOIN_GAME } from "@/api/operations";
import type { Game, GameMutationResult } from "@/api/types";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function LobbyListRoute() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery<{ joinableGames: Game[] }>(
    JOINABLE_GAMES_QUERY,
    { fetchPolicy: "cache-and-network" },
  );
  const [joinGame, { loading: joining }] = useMutation<{ joinGame: GameMutationResult }>(JOIN_GAME);

  async function onJoin(gameId: string) {
    try {
      const res = await joinGame({ variables: { gameId } });
      const r = res.data?.joinGame;
      if (!r) return;
      if (r.__typename === "GameError") {
        toast.push(`${r.code}: ${r.message}`, "error");
        return;
      }
      nav(`/games/${r.game.gameId}`);
    } catch (e) {
      toast.push((e as Error).message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl tracking-wider text-amber-400">CONQUEST</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-parchment/70">{user?.displayName}</span>
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <section className="mt-8 flex items-center justify-between">
        <h2 className="text-xl">Joinable games</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
          <Link to="/games/new">
            <Button>+ New game</Button>
          </Link>
        </div>
      </section>

      {loading && !data && <p className="mt-6 text-parchment/60">Loading…</p>}
      {error && (
        <p className="mt-6 rounded bg-red-900/40 p-3 text-sm text-red-200">
          Failed to load games: {error.message}
        </p>
      )}

      <ul className="mt-4 divide-y divide-parchment/10 rounded-lg border border-parchment/10 bg-ocean/40">
        {data?.joinableGames.length === 0 && (
          <li className="px-4 py-6 text-parchment/60">
            No joinable games yet. Create one to get started.
          </li>
        )}
        {data?.joinableGames.map((g) => (
          <li
            key={g.gameId}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-parchment/60">
                {g.playerCount}/{g.maxPlayers} players · {g.isPublic ? "public" : "private"}
                {g.inviteCode ? ` · invite ${g.inviteCode}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/games/${g.gameId}`}>
                <Button variant="ghost">View</Button>
              </Link>
              <Button onClick={() => onJoin(g.gameId)} disabled={joining}>
                Join
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
