import { useParams } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { GameLobbyScreen } from "@/screens/GameLobbyScreen";
import { SetupScreen } from "@/screens/SetupScreen";
import { GameScreen } from "@/screens/GameScreen";
import { GameOverScreen } from "@/screens/GameOverScreen";

export function GameRoute(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const { state, loading, error } = useGameState(gameId);

  if (loading && !state) return <div className="p-8 text-slate-400">Loading game…</div>;
  if (error) return <div className="p-8 text-rose-400">Failed to load game: {error.message}</div>;
  if (!state) return <div className="p-8 text-slate-400">Game not found.</div>;

  switch (state.game.status) {
    case "lobby":
      return <GameLobbyScreen state={state} />;
    case "placing_troops":
    case "seeding_disease":
    case "placing_researchers":
    case "placing_capitals":
      return <SetupScreen state={state} />;
    case "in_progress":
      return <GameScreen state={state} />;
    case "ended":
      return <GameOverScreen state={state} />;
  }
}
