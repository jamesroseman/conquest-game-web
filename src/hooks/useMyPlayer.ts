import type { GameStateView, Player } from "@/api/types";
import { useAuth } from "@/auth/useAuth";

/** Find the player record in a snapshot belonging to the calling user. */
export function useMyPlayer(state: GameStateView | null | undefined): Player | null {
  const { user } = useAuth();
  if (!state || !user) return null;
  return state.players.find((p) => p.kind === "human" && p.userId === user.userId) ?? null;
}
