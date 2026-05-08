import type { GameStateView, Player } from "@/api/types";
import { useAuth } from "@/auth/useAuth";

export function useMyPlayer(state: GameStateView | null): Player | null {
  const { user } = useAuth();
  if (!state || !user) return null;
  return state.players.find((p) => p.userId === user.userId) ?? null;
}
