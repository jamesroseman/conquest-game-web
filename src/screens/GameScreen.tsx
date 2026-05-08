import { useState } from "react";
import type { GameStateView } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { PlayerList } from "@/components/PlayerList";
import { ActionPanel } from "@/components/ActionPanel/ActionPanel";
import { useMyPlayer } from "@/hooks/useMyPlayer";

interface Props {
  state: GameStateView;
}

export function GameScreen({ state }: Props): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const myPlayer = useMyPlayer(state);
  const { game, players, countryStates, map } = state;

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col lg:flex-row">
      <aside className="w-full overflow-y-auto border-b border-slate-800 bg-slate-900 p-4 lg:w-96 lg:border-b-0 lg:border-r">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">{game.name}</h2>
          <p className="text-xs text-slate-400">
            Round {game.turn.roundNumber} · turn {game.turn.turnNumber} · phase {game.turn.phase}
          </p>
          <p className="text-xs text-slate-400">
            Outbreaks {game.outbreakCount}/{game.config.outbreakLossThreshold}
          </p>
        </div>

        <ActionPanel
          state={state}
          myPlayer={myPlayer}
          selectedCountryId={selected}
          setSelectedCountryId={setSelected}
        />

        <div className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-slate-400">Players</h3>
          <PlayerList
            players={players}
            activePlayerId={game.turn.activePlayerId ?? null}
            ownerUserId={game.ownerUserId}
          />
        </div>
      </aside>

      <section className="relative flex-1 overflow-hidden bg-slate-950">
        {map ? (
          <MapView
            map={map}
            countryStates={countryStates}
            players={players}
            selectedCountryId={selected}
            onCountryClick={(id) => setSelected((prev) => (prev === id ? null : id))}
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
