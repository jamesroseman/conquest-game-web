import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { GAME_QUERY } from "@/api/operations";
import type { GameStateView } from "@/api/types";

const ACTIVE_STATUSES = new Set([
  "lobby",
  "placing_troops",
  "seeding_disease",
  "placing_researchers",
  "placing_capitals",
  "in_progress",
]);

interface GameQueryData {
  game: GameStateView | null;
}

interface UseGameStateResult {
  state: GameStateView | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function useGameState(gameId: string | undefined): UseGameStateResult {
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    const handler = () => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<
    GameQueryData,
    { gameId: string }
  >(GAME_QUERY, {
    variables: { gameId: gameId ?? "" },
    skip: !gameId,
    notifyOnNetworkStatusChange: true,
  });

  const status = data?.game?.game.status;
  const shouldPoll = !!status && ACTIVE_STATUSES.has(status) && tabVisible;

  useEffect(() => {
    if (shouldPoll) {
      startPolling(2000);
      return () => stopPolling();
    }
    stopPolling();
    return undefined;
  }, [shouldPoll, startPolling, stopPolling]);

  return {
    state: data?.game ?? null,
    loading,
    error: error ?? null,
    refetch,
  };
}
