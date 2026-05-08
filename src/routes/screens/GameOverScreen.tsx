import { Link } from "react-router-dom";
import type { GameStateView } from "@/api/types";
import { Button } from "@/components/ui/Button";

export function GameOverScreen({ state }: { state: GameStateView }) {
  const winner = state.players.find((p) => p.playerId === state.game.winnerPlayerId);
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-4xl tracking-wider text-amber-400">Game over</h1>
      <p className="mt-4 text-lg">
        {state.game.endedReason === "outbreak_limit" ? (
          <>The pandemic ran wild. Everyone loses.</>
        ) : winner ? (
          <>
            Winner:{" "}
            <span style={{ color: winner.color }}>
              {winner.kind === "ai"
                ? `AI · ${winner.archetype}`
                : `Player ${winner.seatOrder + 1}`}
            </span>
          </>
        ) : (
          <>Game ended.</>
        )}
      </p>
      <p className="mt-2 text-sm text-parchment/60">
        Outbreaks: {state.game.outbreakCount} / {state.game.config.outbreakLossThreshold}
      </p>
      <div className="mt-8">
        <Link to="/">
          <Button>Back to lobby</Button>
        </Link>
      </div>
    </div>
  );
}
