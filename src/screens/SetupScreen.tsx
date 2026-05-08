import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  PLACE_CAPITAL_MUTATION,
  PLACE_RESEARCHER_MUTATION,
  PLACE_SETUP_TROOP_MUTATION,
} from "@/api/operations";
import type { GameStateView, StateMutationResult } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { PlayerList } from "@/components/PlayerList";
import { useAuth } from "@/auth/useAuth";
import { CountryInspector } from "@/components/CountryInspector";

interface Props {
  state: GameStateView;
}

export function SetupScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const { game, players, countryStates, map } = state;
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const myPlayer = players.find((p) => p.userId === user?.userId) ?? null;
  const activeSeat = game.setup.activeSeatOrder;
  const activePlayer = players.find((p) => p.seatOrder === activeSeat) ?? null;
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

  const phaseLabel = (() => {
    switch (game.setup.phase) {
      case "troops":
        return `Place a troop · ${myPlayer?.troopsRemainingToPlace ?? 0} left for you`;
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
            onCountryClick={onCountryClick}
            onCountryHover={setHover}
          />
        ) : (
          <div className="bd dim" style={{ padding: 80, textAlign: "center" }}>
            Map not ready yet…
          </div>
        )}
      </div>

      <div className="panel panel-fixed" style={{ top: 60, left: 14, minWidth: 240 }}>
        <div className="hd">
          setup · {game.setup.phase}
        </div>
        <div className="bd">
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

      <CountryInspector hoverCountryId={hover} state={state} />
    </div>
  );
}
