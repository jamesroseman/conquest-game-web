import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import {
  PLACE_CAPITAL_MUTATION,
  PLACE_RESEARCHER_MUTATION,
  PLACE_SETUP_TROOP_MUTATION,
} from "@/api/operations";
import type { GameStateView, StateMutationResult } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { Minimap } from "@/components/Minimap";
import { PlayerList } from "@/components/PlayerList";
import { EventLog } from "@/components/EventLog";
import { AiThinkingIndicator } from "@/components/AiThinkingIndicator";
import { useAuth } from "@/auth/useAuth";
import { makeIso } from "@/lib/iso";
import { fitView, type View } from "@/lib/view";

interface Props {
  state: GameStateView;
}

export function SetupScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const { game, players, countryStates, map } = state;
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const lastMapId = useRef<string | null>(null);

  useEffect(() => {
    if (!map || viewport.w <= 1 || viewport.h <= 1) return;
    if (lastMapId.current === map.mapId) return;
    lastMapId.current = map.mapId;
    const iso = makeIso(map.width, map.height);
    setView(fitView(viewport.w, viewport.h, iso.canvasW, iso.canvasH));
  }, [map, viewport.w, viewport.h]);

  const myPlayer = players.find((p) => p.userId === user?.userId) ?? null;
  const activeSeat = game.setup.activeSeatOrder;
  const activePlayer = useMemo(
    () => players.find((p) => p.seatOrder === activeSeat) ?? null,
    [players, activeSeat]
  );
  const isMyTurn = !!myPlayer && myPlayer.seatOrder === activeSeat;

  const [placeTroop] = useMutation<
    { placeSetupTroop: StateMutationResult },
    { gameId: string; countryId: string }
  >(PLACE_SETUP_TROOP_MUTATION);
  const [placeResearcher] = useMutation<
    { placeResearcher: StateMutationResult },
    { gameId: string; countryId: string }
  >(PLACE_RESEARCHER_MUTATION);
  const [placeCapital] = useMutation<
    { placeCapital: StateMutationResult },
    { gameId: string; countryId: string }
  >(PLACE_CAPITAL_MUTATION);

  function handle(result: StateMutationResult | undefined): void {
    if (!result) return;
    if (result.__typename === "GameError") setError(result.message);
    else setError(null);
  }

  async function onCountryClick(countryId: string): Promise<void> {
    if (!isMyTurn) return;
    switch (game.setup.phase) {
      case "troops": {
        const r = await placeTroop({ variables: { gameId: game.gameId, countryId } });
        handle(r.data?.placeSetupTroop);
        break;
      }
      case "researchers": {
        const r = await placeResearcher({ variables: { gameId: game.gameId, countryId } });
        handle(r.data?.placeResearcher);
        break;
      }
      case "capitals": {
        const r = await placeCapital({ variables: { gameId: game.gameId, countryId } });
        handle(r.data?.placeCapital);
        break;
      }
      default:
        break;
    }
  }

  // Risk-style claim rule: until every country has at least one owner, a
  // player can only place on UNCLAIMED countries. Once everything's
  // claimed, placement switches to reinforcing your own.
  const unclaimedCount = countryStates.filter((s) => s.ownerPlayerId === null).length;
  const stillClaiming = unclaimedCount > 0;
  const phaseLabel = (() => {
    switch (game.setup.phase) {
      case "troops":
        if (stillClaiming) {
          return `Claim a country · ${unclaimedCount} unclaimed · ${myPlayer?.troopsRemainingToPlace ?? 0} troops left`;
        }
        return `Reinforce a country you own · ${myPlayer?.troopsRemainingToPlace ?? 0} troops left`;
      case "researchers":
        return "Place your researcher on a country you own";
      case "capitals":
        return "Place your capital on a country you own";
      case "disease_seed":
        return "Server is seeding disease — auto-progressing";
      default:
        return game.setup.phase;
    }
  })();

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
            onCountryClick={onCountryClick}
            onViewportSize={(w, h) => setViewport({ w, h })}
          />
        ) : (
          <div className="bd dim" style={{ padding: 80, textAlign: "center" }}>
            Map not ready yet…
          </div>
        )}
      </div>

      <div className="panel panel-fixed" style={{ top: 60, left: 14, minWidth: 240, width: 280 }}>
        <div className="hd">
          setup · {game.setup.phase}
        </div>
        <div className="bd">
          <AiThinkingIndicator activePlayer={isMyTurn ? null : activePlayer} className="mb-8" />
          <div
            style={{
              padding: "6px 8px",
              border: `1px dashed ${isMyTurn ? "rgba(255,180,84,0.6)" : "rgba(91,227,255,0.18)"}`,
              color: isMyTurn ? "var(--warn)" : "var(--ink-dim)",
              marginBottom: 8,
              fontSize: 11,
            }}
          >
            {isMyTurn ? phaseLabel : `Waiting for seat ${activeSeat + 1}…`}
          </div>
          <div className="section-hd">seats</div>
          <PlayerList
            players={players}
            activePlayerId={activePlayer?.playerId ?? null}
            ownerUserId={game.ownerUserId}
            myUserId={user?.userId ?? null}
          />
          {error && <div className="alert">{error}</div>}
        </div>
      </div>

      <EventLog state={state} />

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
