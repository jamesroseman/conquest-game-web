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
    <div className="page-shell">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="panel">
          <div className="hd">
            open lobbies
            <span className="right">
              <button type="button" className="btn btn-ghost" onClick={() => refetch()} style={{ padding: "3px 10px" }}>
                Refresh
              </button>
              <Link to="/games/new" className="btn" style={{ padding: "3px 10px", textDecoration: "none" }}>
                New game
              </Link>
            </span>
          </div>
          <div className="bd" style={{ padding: 0 }}>
            {loading && !data ? (
              <div className="bd dim">Loading…</div>
            ) : error ? (
              <div className="bd dim" style={{ color: "var(--bad)" }}>{error.message}</div>
            ) : !data || data.joinableGames.length === 0 ? (
              <div className="bd dim">No open lobbies. Create one to get started.</div>
            ) : (
              data.joinableGames.map((game) => (
                <div key={game.gameId} className="lobby-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{game.name}</div>
                    <div className="meta">
                      {statusLabel(game.status)} · {game.playerCount}/{game.maxPlayers} seats ·{" "}
                      {game.isPublic ? "public" : "private"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link
                      to={`/games/${game.gameId}`}
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", textDecoration: "none" }}
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      className="btn btn-good"
                      style={{ padding: "4px 10px" }}
                      onClick={() => onJoin(game.gameId)}
                      disabled={joining}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
