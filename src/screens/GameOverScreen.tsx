import { Link } from "react-router-dom";
import type { GameStateView } from "@/api/types";
import { PlayerList } from "@/components/PlayerList";
import { MapView } from "@/components/MapView/MapView";
import { useAuth } from "@/auth/useAuth";

interface Props {
  state: GameStateView;
}

export function GameOverScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const { game, players, countryStates, map } = state;
  const winner = game.winnerPlayerId
    ? players.find((p) => p.playerId === game.winnerPlayerId)
    : null;

  return (
    <div className="page-game">
      <div style={{ position: "absolute", inset: 0 }}>
        {map && (
          <MapView map={map} countryStates={countryStates} players={players} />
        )}
      </div>

      <div className="panel panel-fixed" style={{ top: 60, left: 14, width: 320 }}>
        <div className="hd">game over</div>
        <div className="bd">
          {winner ? (
            <div
              style={{
                padding: "8px 10px",
                border: "1px dashed rgba(155,225,93,0.5)",
                color: "var(--good)",
                marginBottom: 10,
                fontSize: 11,
                letterSpacing: "0.06em",
              }}
            >
              Winner — seat {winner.seatOrder + 1}
              {winner.kind === "ai" ? ` · AI ${winner.archetype}` : ""}
            </div>
          ) : (
            <div
              style={{
                padding: "8px 10px",
                border: "1px dashed rgba(232,91,58,0.5)",
                color: "var(--bad)",
                marginBottom: 10,
                fontSize: 11,
                letterSpacing: "0.06em",
              }}
            >
              All players lost — {game.endedReason ?? "outbreak limit reached"}.
            </div>
          )}

          <div className="section-hd">final standings</div>
          <PlayerList
            players={players}
            ownerUserId={game.ownerUserId}
            myUserId={user?.userId ?? null}
          />

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <Link to="/" className="btn" style={{ textDecoration: "none", flex: 1, textAlign: "center" }}>
              Back to lobbies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
