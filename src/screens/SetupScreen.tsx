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

interface Props {
  state: GameStateView;
}

export function SetupScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const { game, players, countryStates, map } = state;
  const [error, setError] = useState<string | null>(null);

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

  function handleResult(result: StateMutationResult | undefined): void {
    if (!result) return;
    if (result.__typename === "GameError") setError(result.message);
    else setError(null);
  }

  async function onCountryClick(countryId: string): Promise<void> {
    if (!isMyTurn) return;
    switch (game.setup.phase) {
      case "troops": {
        const r = await placeTroop({ variables: { gameId: game.gameId, countryId } });
        handleResult(r.data?.placeSetupTroop);
        break;
      }
      case "researchers": {
        const r = await placeResearcher({ variables: { gameId: game.gameId, countryId } });
        handleResult(r.data?.placeResearcher);
        break;
      }
      case "capitals": {
        const r = await placeCapital({ variables: { gameId: game.gameId, countryId } });
        handleResult(r.data?.placeCapital);
        break;
      }
      default:
        break;
    }
  }

  const phaseLabel = (() => {
    switch (game.setup.phase) {
      case "troops":
        return `Place a troop (${myPlayer?.troopsRemainingToPlace ?? 0} left for you)`;
      case "researchers":
        return "Place your researcher on a country you own";
      case "capitals":
        return "Place your capital on a country you own";
      case "disease_seed":
        return "Server is seeding disease — auto-progresses";
      default:
        return game.setup.phase;
    }
  })();

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col lg:flex-row">
      <aside className="w-full border-b border-slate-800 bg-slate-900 p-4 lg:w-80 lg:border-b-0 lg:border-r">
        <h2 className="text-lg font-semibold text-slate-100">{game.name}</h2>
        <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Setup · {game.setup.phase}</p>
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            isMyTurn ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-slate-700 bg-slate-950 text-slate-300"
          }`}
        >
          {isMyTurn ? phaseLabel : `Waiting for seat ${activeSeat + 1}…`}
        </div>
        <PlayerList players={players} activePlayerId={activePlayer?.playerId ?? null} ownerUserId={game.ownerUserId} />
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </aside>

      <section className="relative flex-1 overflow-hidden bg-slate-950">
        {map ? (
          <MapView
            map={map}
            countryStates={countryStates}
            players={players}
            onCountryClick={onCountryClick}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            Map not ready yet…
          </div>
        )}
      </section>
    </div>
  );
}
