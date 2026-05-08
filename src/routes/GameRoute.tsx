import { useParams, Navigate } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { useMyPlayer } from "@/hooks/useMyPlayer";
import { GameLobbyScreen } from "@/routes/screens/GameLobbyScreen";
import { SetupScreen } from "@/routes/screens/SetupScreen";
import { GameScreen } from "@/routes/screens/GameScreen";
import { GameOverScreen } from "@/routes/screens/GameOverScreen";

const SETUP_PHASES = new Set([
  "placing_troops",
  "seeding_disease",
  "placing_researchers",
  "placing_capitals",
]);

export function GameRoute() {
  const { gameId } = useParams<{ gameId: string }>();
  const { data, loading, error } = useGameState(gameId ?? "");
  const myPlayer = useMyPlayer(data?.game ?? null);

  if (!gameId) return <Navigate to="/" replace />;
  if (loading && !data) return <p className="p-8 text-parchment/60">Loading game…</p>;
  if (error)
    return (
      <p className="p-8 text-red-300">Failed to load game: {error.message}</p>
    );
  if (!data?.game) return <p className="p-8 text-parchment/60">Game not found.</p>;

  const state = data.game;
  const status = state.game.status;

  if (status === "lobby") {
    return <GameLobbyScreen game={state.game} players={state.players} />;
  }
  if (SETUP_PHASES.has(status)) {
    return <SetupScreen state={state} myPlayer={myPlayer} />;
  }
  if (status === "in_progress") {
    return <GameScreen state={state} myPlayer={myPlayer} />;
  }
  if (status === "ended") {
    return <GameOverScreen state={state} />;
  }
  return <p className="p-8">Unknown game status: {status}</p>;
}
