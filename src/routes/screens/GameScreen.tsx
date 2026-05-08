import { useState } from "react";
import type { GameStateView, Player } from "@/api/types";
import { ActionPanel } from "@/components/ActionPanel/ActionPanel";
import { MapView } from "@/components/MapView/MapView";
import { PlayerList } from "@/components/PlayerList";

interface Props {
  state: GameStateView;
  myPlayer: Player | null;
}

export function GameScreen({ state, myPlayer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!state.map) return <p className="p-8 text-parchment/60">Loading map…</p>;

  const activePlayer = state.players.find(
    (p) => p.playerId === state.game.turn.activePlayerId,
  );

  return (
    <div className="grid h-screen grid-cols-[1fr_340px]">
      <div className="relative">
        <MapView
          map={state.map}
          countryStates={state.countryStates}
          players={state.players}
          selectedCountryId={selected}
          onCountryClick={(id) => setSelected((cur) => (cur === id ? null : id))}
        />
      </div>
      <aside className="flex flex-col gap-3 overflow-y-auto bg-ocean-deep/80 p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-parchment/60">
            Round {state.game.turn.roundNumber + 1} · Turn {state.game.turn.turnNumber + 1}
          </div>
          <div className="mt-1 text-sm">
            {activePlayer?.kind === "ai"
              ? `AI · ${activePlayer.archetype} (${activePlayer.difficulty})`
              : activePlayer?.userId === myPlayer?.userId
                ? "Your turn"
                : "Opponent's turn"}
          </div>
          <div className="mt-1 text-xs text-parchment/60">
            Outbreaks: {state.game.outbreakCount} / {state.game.config.outbreakLossThreshold}
          </div>
        </div>

        <ActionPanel
          state={state}
          myPlayer={myPlayer}
          selectedCountryId={selected}
          setSelectedCountryId={setSelected}
        />

        <PlayerList game={state.game} players={state.players} myPlayerId={myPlayer?.playerId} />
      </aside>
    </div>
  );
}
