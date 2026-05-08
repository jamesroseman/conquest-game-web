import type { Player } from "@/api/types";

interface Props {
  players: Player[];
  activePlayerId?: string | null;
  ownerUserId?: string;
}

export function PlayerList({ players, activePlayerId, ownerUserId }: Props): JSX.Element {
  const ordered = [...players].sort((a, b) => a.seatOrder - b.seatOrder);
  return (
    <ul className="space-y-2">
      {ordered.map((p) => {
        const isActive = p.playerId === activePlayerId;
        const isOwner = ownerUserId && p.userId === ownerUserId;
        return (
          <li
            key={p.playerId}
            className={`flex items-center justify-between rounded-md border px-3 py-2 ${
              isActive ? "border-amber-400 bg-amber-400/10" : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="text-sm text-slate-100">
                Seat {p.seatOrder + 1}{" "}
                {p.kind === "ai" ? (
                  <span className="text-slate-400">(AI {p.archetype}/{p.difficulty})</span>
                ) : (
                  <span className="text-slate-400">(human{isOwner ? " · owner" : ""})</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{p.countriesOwned} ctry</span>
              <span>{p.totalArmies} army</span>
              {p.eliminated && <span className="text-rose-400">eliminated</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
