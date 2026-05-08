import type { Game, Player } from "@/api/types";

interface Props {
  game: Game;
  players: Player[];
  myPlayerId?: string | null;
}

export function PlayerList({ game, players, myPlayerId }: Props) {
  const sorted = [...players].sort((a, b) => a.seatOrder - b.seatOrder);
  const activeId = game.turn.activePlayerId;

  return (
    <div className="rounded-lg border border-parchment/10 bg-ocean/40">
      <div className="border-b border-parchment/10 px-3 py-2 text-xs uppercase tracking-wider text-parchment/60">
        Players
      </div>
      <ul className="divide-y divide-parchment/10">
        {sorted.map((p) => {
          const isMe = p.playerId === myPlayerId;
          const isActive = p.playerId === activeId;
          return (
            <li
              key={p.playerId}
              className={`flex items-center gap-2 px-3 py-2 text-sm ${
                isActive ? "bg-amber-500/10" : ""
              } ${p.eliminated ? "opacity-50" : ""}`}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 truncate">
                {p.kind === "ai" ? `AI · ${p.archetype}` : isMe ? "You" : `Player ${p.seatOrder + 1}`}
                {p.eliminated && <span className="ml-2 text-xs text-red-300">eliminated</span>}
              </span>
              <span className="text-xs text-parchment/60">
                {p.countriesOwned} · {p.totalArmies}🛡
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
