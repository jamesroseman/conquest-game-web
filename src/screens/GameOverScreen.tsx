import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { GameStateView } from "@/api/types";
import { PlayerList } from "@/components/PlayerList";
import { MapView } from "@/components/MapView/MapView";
import { Minimap } from "@/components/Minimap";
import { useAuth } from "@/auth/useAuth";
import { TILE_PX } from "@/lib/biomes";
import { fitView, type View } from "@/lib/view";

interface Props {
  state: GameStateView;
}

export function GameOverScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const { game, players, countryStates, map } = state;
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const lastMapId = useRef<string | null>(null);
  const winner = game.winnerPlayerId
    ? players.find((p) => p.playerId === game.winnerPlayerId)
    : null;

  useEffect(() => {
    if (!map || viewport.w <= 1 || viewport.h <= 1) return;
    if (lastMapId.current === map.mapId) return;
    lastMapId.current = map.mapId;
    setView(fitView(viewport.w, viewport.h, map.width * TILE_PX, map.height * TILE_PX));
  }, [map, viewport.w, viewport.h]);

  return (
    <div className="page-game">
      <div style={{ position: "absolute", inset: 0 }}>
        {map && (
          <MapView
            map={map}
            countryStates={countryStates}
            players={players}
            view={view}
            setView={setView}
            onViewportSize={(w, h) => setViewport({ w, h })}
          />
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

      {map && (
        <Minimap
          map={map}
          countryStates={countryStates}
          players={players}
          view={view}
          setView={setView}
          viewportSize={viewport}
        />
      )}
    </div>
  );
}
