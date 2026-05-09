import { useEffect, useMemo, useRef, useState } from "react";
import type { GameStateView } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { Minimap } from "@/components/Minimap";
import { PlayerList } from "@/components/PlayerList";
import { ActionPanel, type TargetMode } from "@/components/ActionPanel/ActionPanel";
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
  const [targetMode, setTargetMode] = useState<TargetMode>(null);
  const myPlayer = useMyPlayer(state);
  const { game, players, countryStates, map } = state;
  const lastMapId = useRef<string | null>(null);

  // While in attack/move mode, the parent computes the highlight set and
  // re-routes map clicks. Highlighted = adjacent enemy (attack) or
  // adjacent owned (move) countries.
  const highlightedIds = useMemo<Set<string> | null>(() => {
    if (!targetMode || !selected || !state.map || !myPlayer) return null;
    const adjacent = new Set<string>();
    for (const p of state.map.paths) {
      if (p.countryAId === selected) adjacent.add(p.countryBId);
      else if (p.countryBId === selected) adjacent.add(p.countryAId);
    }
    const stateById = new Map(state.countryStates.map((s) => [s.countryId, s] as const));
    const out = new Set<string>();
    for (const id of adjacent) {
      const s = stateById.get(id);
      if (!s) continue;
      if (targetMode === "attack" && s.ownerPlayerId !== myPlayer.playerId) out.add(id);
      if (targetMode === "move" && s.ownerPlayerId === myPlayer.playerId) out.add(id);
    }
    return out;
  }, [targetMode, selected, state.map, state.countryStates, myPlayer]);

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
            highlightedIds={highlightedIds}
            onCountryClick={(id) => {
              // In target mode, leave selection alone — the ActionPanel's
              // target list owns the click resolution. Selecting a new
              // country here would silently change the source mid-attack.
              if (targetMode) return;
              setSelected((prev) => (prev === id ? null : id));
            }}
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
            targetMode={targetMode}
            setTargetMode={setTargetMode}
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
