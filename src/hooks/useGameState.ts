import { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { GAME_QUERY } from "@/api/operations";
import type { GameStateView } from "@/api/types";

/**
 * Subscribes to a game by polling the GraphQL `game(gameId)` query every 2s
 * while the game is active and the tab is visible.
 *
 * v0.2 will swap this for a WebSocket subscription; isolating that change here
 * means the rest of the app doesn't care.
 */
export function useGameState(gameId: string) {
  const result = useQuery<{ game: GameStateView | null }>(GAME_QUERY, {
    variables: { gameId },
    pollInterval: 2000,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "hidden") {
        result.stopPolling();
      } else {
        const status = result.data?.game?.game.status;
        if (status && status !== "ended") result.startPolling(2000);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [result]);

  useEffect(() => {
    if (result.data?.game?.game.status === "ended") {
      result.stopPolling();
    }
  }, [result, result.data?.game?.game.status]);

  return result;
}
