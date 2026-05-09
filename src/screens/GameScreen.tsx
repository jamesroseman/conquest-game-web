import { useEffect, useMemo, useRef, useState } from "react";
import type { GameStateView } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { Minimap } from "@/components/Minimap";
import { PlayerList } from "@/components/PlayerList";
import { ActionPanel, type TargetMode } from "@/components/ActionPanel/ActionPanel";
import { EventLog } from "@/components/EventLog";
import { DiseasePanel } from "@/components/DiseasePanel";
import { buildAnimationDirective, type FloatingNumber } from "@/lib/animations";
import type { GameEvent } from "@/api/types";
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
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const [targetMode, setTargetMode] = useState<TargetMode>(null);
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const [diseasePlayback, setDiseasePlayback] = useState<{
    until: number;
    events: GameEvent[];
  } | null>(null);
  const lastSeqRef = useRef<number>(0);
  const myPlayer = useMyPlayer(state);
  const { game, players, countryStates, map } = state;
  const lastMapId = useRef<string | null>(null);
  // ActionPanel writes a dispatcher here while target mode is active so map
  // clicks on highlighted countries can fire the chosen attack/move.
  const dispatchTargetRef = useRef<((id: string) => void) | null>(null);

  const playerColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.playerId, p.color);
    return m;
  }, [players]);

  // Whenever new events come in, expand them into floating-number spawns
  // and schedule them. Older spawns expire on a timer.
  useEffect(() => {
    if (!state.recentEvents || state.recentEvents.length === 0) return;
    // First-paint: don't re-animate the entire history.
    if (lastSeqRef.current === 0) {
      const last = state.recentEvents[state.recentEvents.length - 1];
      lastSeqRef.current = last?.sequence ?? 0;
      return;
    }
    const now = performance.now();
    const { directive, nextSeq } = buildAnimationDirective(
      state.recentEvents,
      lastSeqRef.current,
      now,
      {
        playerColor: (id) => (id ? playerColorById.get(id) ?? "#aab8c4" : "#aab8c4"),
      }
    );
    if (nextSeq <= lastSeqRef.current) return;
    lastSeqRef.current = nextSeq;
    if (directive.spawns.length > 0) {
      setFloats((prev) => {
        const live = prev.filter((f) => now - f.startAt < f.duration + 200);
        return [...live, ...directive.spawns];
      });
    }
    if (directive.diseasePlayback) {
      setDiseasePlayback((prev) => {
        const next = directive.diseasePlayback!;
        if (!prev) return next;
        return { until: Math.max(prev.until, next.until), events: [...prev.events, ...next.events] };
      });
    }
  }, [state.recentEvents, playerColorById]);

  // Sweep expired floats + clear the disease panel once playback ends.
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      setFloats((prev) => prev.filter((f) => now - f.startAt < f.duration + 200));
      setDiseasePlayback((prev) => (prev && now > prev.until + 800 ? null : prev));
    }, 250);
    return () => clearInterval(id);
  }, []);

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
            floats={floats}
            onCountryClick={(id) => {
              // In target mode, route the click to the ActionPanel's
              // dispatcher when the country is a valid candidate. Anything
              // else (clicking a non-candidate) is a no-op so the source
              // doesn't silently change mid-attack.
              if (targetMode) {
                if (highlightedIds?.has(id)) dispatchTargetRef.current?.(id);
                return;
              }
              setSelected((prev) => (prev === id ? null : id));
            }}
            onViewportSize={(w, h) => setViewport({ w, h })}
          />
        ) : (
          <div className="bd dim" style={{ padding: 80, textAlign: "center" }}>
            Map not ready yet…
          </div>
        )}
      </div>

      {/* Top-left: actions / disease panel (swaps during virus playback) */}
      <div className="panel panel-fixed" style={{ top: 60, left: 14, width: 280 }}>
        <div className="hd">
          {diseasePlayback ? "disease" : "actions"}
          <span className="right">
            R{game.turn.roundNumber} · T{game.turn.turnNumber} · {game.turn.phase}
          </span>
        </div>
        <div className="bd">
          <AiThinkingIndicator activePlayer={activePlayer} className="mb-8" />
          {diseasePlayback ? (
            <DiseasePanel state={state} events={diseasePlayback.events} />
          ) : (
            <ActionPanel
              state={state}
              myPlayer={myPlayer}
              selectedCountryId={selected}
              setSelectedCountryId={setSelected}
              targetMode={targetMode}
              setTargetMode={setTargetMode}
              dispatchTargetRef={dispatchTargetRef}
            />
          )}
        </div>
      </div>

      {/* Top-right: live event log so the human can see what bots are doing */}
      <EventLog state={state} />

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
