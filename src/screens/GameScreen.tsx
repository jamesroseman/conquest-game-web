import { useEffect, useMemo, useRef, useState } from "react";
import type { GameStateView } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { Minimap } from "@/components/Minimap";
import { PlayerList } from "@/components/PlayerList";
import { ActionPanel } from "@/components/ActionPanel/ActionPanel";
import { CountryInspector } from "@/components/CountryInspector";
import { AiThinkingIndicator } from "@/components/AiThinkingIndicator";
import { useMyPlayer } from "@/hooks/useMyPlayer";
import { useAuth } from "@/auth/useAuth";
import { makeIso } from "@/lib/iso";
import { fitView, type View } from "@/lib/view";

interface Props {
  state: GameStateView;
}

export function GameScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const myPlayer = useMyPlayer(state);
  const { game, players, countryStates, map } = state;
  const lastMapId = useRef<string | null>(null);

  // Auto-fit the world the first time we know both the viewport size and the
  // map id. Re-runs only on map regeneration, not on every state poll.
  useEffect(() => {
    if (!map || viewport.w <= 1 || viewport.h <= 1) return;
    if (lastMapId.current === map.mapId) return;
    lastMapId.current = map.mapId;
    const iso = makeIso(map.width, map.height);
    setView(fitView(viewport.w, viewport.h, iso.canvasW, iso.canvasH));
  }, [map, viewport.w, viewport.h]);

  const activePlayer = useMemo(
    () =>
      game.turn.activePlayerId
        ? players.find((p) => p.playerId === game.turn.activePlayerId) ?? null
        : null,
    [players, game.turn.activePlayerId]
  );

  return (
    <div className="page-game">
      <div style={{ position: "absolute", inset: 0 }}>
        {map ? (
          <MapView
            map={map}
            countryStates={countryStates}
            players={players}
            view={view}
            setView={setView}
            selectedCountryId={selected}
            onCountryClick={(id) => setSelected((prev) => (prev === id ? null : id))}
            onCountryHover={setHover}
            onViewportSize={(w, h) => setViewport({ w, h })}
          />
        ) : (
          <div className="bd dim" style={{ padding: 80, textAlign: "center" }}>
            Map not ready yet…
          </div>
        )}
      </div>

      {/* Top-left: actions panel */}
      <div className="panel panel-fixed" style={{ top: 60, left: 14, width: 280 }}>
        <div className="hd">
          actions
          <span className="right">
            R{game.turn.roundNumber} · T{game.turn.turnNumber} · {game.turn.phase}
          </span>
        </div>
        <div className="bd">
          <AiThinkingIndicator activePlayer={activePlayer} className="mb-8" />
          <ActionPanel
            state={state}
            myPlayer={myPlayer}
            selectedCountryId={selected}
            setSelectedCountryId={setSelected}
          />
        </div>
      </div>

      {/* Top-right: country inspector */}
      <CountryInspector hoverCountryId={hover ?? selected} state={state} />

      {/* Bottom-left: outbreak counter + players */}
      <div className="panel panel-fixed" style={{ bottom: 14, left: 14, width: 280 }}>
        <div className="hd">
          outbreak watch
          <span className="right">
            {game.outbreakCount}/{game.config.outbreakLossThreshold}
          </span>
        </div>
        <div className="bd">
          <div className="meter" style={{ marginBottom: 8 }}>
            <i
              style={{
                width: `${Math.min(
                  100,
                  (game.outbreakCount / game.config.outbreakLossThreshold) * 100
                )}%`,
                background:
                  game.outbreakCount >= game.config.outbreakLossThreshold * 0.66
                    ? "var(--bad)"
                    : game.outbreakCount >= game.config.outbreakLossThreshold * 0.33
                      ? "var(--mid)"
                      : "var(--good)",
                boxShadow: "none",
              }}
            />
          </div>
          <div className="section-hd">players</div>
          <PlayerList
            players={players}
            activePlayerId={game.turn.activePlayerId ?? null}
            ownerUserId={game.ownerUserId}
            myUserId={user?.userId ?? null}
          />
        </div>
      </div>

      {/* Bottom-right: minimap + zoom controls */}
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
