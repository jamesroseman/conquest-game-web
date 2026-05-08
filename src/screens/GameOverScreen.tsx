import { Link } from "react-router-dom";
import type { GameStateView } from "@/api/types";
import { PlayerList } from "@/components/PlayerList";
import { MapView } from "@/components/MapView/MapView";

interface Props {
  state: GameStateView;
}

export function GameOverScreen({ state }: Props): JSX.Element {
  const { game, players, countryStates, map } = state;
  const winner = game.winnerPlayerId
    ? players.find((p) => p.playerId === game.winnerPlayerId)
    : null;

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col lg:flex-row">
      <aside className="w-full border-b border-slate-800 bg-slate-900 p-4 lg:w-80 lg:border-b-0 lg:border-r">
        <h2 className="text-lg font-semibold text-slate-100">{game.name}</h2>
        <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Game over</p>
        <div className="mb-4 rounded-md border border-slate-700 bg-slate-950 p-3 text-sm">
          {winner ? (
            <p className="text-emerald-300">
              Winner: seat {winner.seatOrder + 1}
              {winner.kind === "ai" ? ` (AI ${winner.archetype})` : ""}
            </p>
          ) : (
            <p className="text-rose-300">
              All players lost — {game.endedReason ?? "outbreak limit reached"}.
            </p>
          )}
        </div>
        <PlayerList players={players} ownerUserId={game.ownerUserId} />
        <Link
          to="/"
          className="mt-4 inline-block rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Back to lobbies
        </Link>
      </aside>
      <section className="relative flex-1 overflow-hidden bg-slate-950">
        {map && <MapView map={map} countryStates={countryStates} players={players} />}
      </section>
    </div>
  );
}
