import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { JOIN_GAME_MUTATION, JOINABLE_GAMES_QUERY } from "@/api/operations";
import type { Game, GameMutationResult } from "@/api/types";
import { statusLabel } from "@/lib/format";

interface JoinableGamesData {
  joinableGames: Game[];
}

export function LobbyListRoute(): JSX.Element {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery<JoinableGamesData>(JOINABLE_GAMES_QUERY, {
    pollInterval: 5000,
  });
  const [joinGame, { loading: joining }] = useMutation<
    { joinGame: GameMutationResult },
    { gameId: string }
  >(JOIN_GAME_MUTATION);

  async function onJoin(gameId: string): Promise<void> {
    const res = await joinGame({ variables: { gameId } });
    const result = res.data?.joinGame;
    if (result?.__typename === "GameResult") {
      navigate(`/games/${result.game.gameId}`);
    } else if (result?.__typename === "GameError") {
      alert(`Could not join: ${result.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Open lobbies</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
          <Link
            to="/games/new"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New game
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : error ? (
        <p className="text-rose-400">{error.message}</p>
      ) : !data || data.joinableGames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
          No open lobbies right now. Create one to get started.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.joinableGames.map((game) => (
            <li
              key={game.gameId}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <div className="font-medium text-slate-100">{game.name}</div>
                <div className="text-xs text-slate-400">
                  {statusLabel(game.status)} · {game.playerCount}/{game.maxPlayers} players
                  {game.isPublic ? " · public" : " · private"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/games/${game.gameId}`}
                  className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => onJoin(game.gameId)}
                  disabled={joining}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-900"
                >
                  Join
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
