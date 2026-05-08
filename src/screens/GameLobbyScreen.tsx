import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import {
  ADD_AI_SEAT_MUTATION,
  LEAVE_GAME_MUTATION,
  REMOVE_SEAT_MUTATION,
  START_GAME_MUTATION,
} from "@/api/operations";
import type {
  GameMutationResult,
  GameStateView,
  StateMutationResult,
} from "@/api/types";
import { PlayerList } from "@/components/PlayerList";
import { useAuth } from "@/auth/useAuth";

const ARCHETYPES = [
  "aggressor",
  "turtle",
  "medic",
  "opportunist",
  "expansionist",
  "consolidator",
  "saboteur",
  "kingmaker",
  "doomsayer",
  "isolationist",
  "bandwagon",
  "chaos",
];

interface Props {
  state: GameStateView;
}

export function GameLobbyScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { game, players } = state;
  const [aiArchetype, setAiArchetype] = useState("chaos");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.userId === game.ownerUserId;
  const myPlayer = players.find((p) => p.userId === user?.userId);

  const [addAiSeat, { loading: addingAi }] = useMutation<
    { addAiSeat: GameMutationResult },
    { gameId: string; archetype: string; difficulty: string }
  >(ADD_AI_SEAT_MUTATION, { refetchQueries: ["GameQuery"] });

  const [removeSeat] = useMutation<
    { removeSeat: GameMutationResult },
    { gameId: string; targetPlayerId: string }
  >(REMOVE_SEAT_MUTATION, { refetchQueries: ["GameQuery"] });

  const [leaveGame] = useMutation<
    { leaveGame: GameMutationResult },
    { gameId: string }
  >(LEAVE_GAME_MUTATION);

  const [startGame, { loading: starting }] = useMutation<
    { startGame: StateMutationResult },
    { gameId: string }
  >(START_GAME_MUTATION, { refetchQueries: ["GameQuery"] });

  function handle(result: GameMutationResult | StateMutationResult | undefined): boolean {
    if (!result) return false;
    if (result.__typename === "GameError") {
      setError(result.message);
      return false;
    }
    setError(null);
    return true;
  }

  async function onAddAi(): Promise<void> {
    const res = await addAiSeat({
      variables: { gameId: game.gameId, archetype: aiArchetype, difficulty: aiDifficulty },
    });
    handle(res.data?.addAiSeat);
  }

  async function onRemove(playerId: string): Promise<void> {
    const res = await removeSeat({
      variables: { gameId: game.gameId, targetPlayerId: playerId },
    });
    handle(res.data?.removeSeat);
  }

  async function onLeave(): Promise<void> {
    const res = await leaveGame({ variables: { gameId: game.gameId } });
    if (handle(res.data?.leaveGame)) navigate("/");
  }

  async function onStart(): Promise<void> {
    const res = await startGame({ variables: { gameId: game.gameId } });
    handle(res.data?.startGame);
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <div className="hd">
            {game.name}
            <span className="right">
              {game.playerCount}/{game.maxPlayers} seats · {game.isPublic ? "public" : "private"}
              {game.inviteCode && (
                <>
                  {" · "}
                  <span className="chip">{game.inviteCode}</span>
                </>
              )}
            </span>
          </div>
          <div className="bd">
            <div className="section-hd">seats</div>
            <PlayerList players={players} ownerUserId={game.ownerUserId} myUserId={user?.userId ?? null} />
            {isOwner && players.filter((p) => p.userId !== user?.userId).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {players
                  .filter((p) => p.userId !== user?.userId)
                  .map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "3px 8px", fontSize: 9 }}
                      onClick={() => onRemove(p.playerId)}
                    >
                      Remove seat {p.seatOrder + 1}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="panel">
            <div className="hd">add ai seat</div>
            <div className="bd" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ minWidth: 160 }}>
                <label className="label">archetype</label>
                <select
                  className="select"
                  value={aiArchetype}
                  onChange={(e) => setAiArchetype(e.target.value)}
                >
                  {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 120 }}>
                <label className="label">difficulty</label>
                <select
                  className="select"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                >
                  {["easy", "medium", "hard", "brutal"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn"
                onClick={onAddAi}
                disabled={addingAi || game.playerCount >= game.maxPlayers}
              >
                Add AI
              </button>
            </div>
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          {isOwner ? (
            <button
              type="button"
              className="btn btn-good"
              onClick={onStart}
              disabled={starting || game.playerCount < game.minPlayers}
              style={{ flex: 1 }}
            >
              {starting ? "Starting…" : "Start game"}
            </button>
          ) : myPlayer ? (
            <button type="button" className="btn btn-bad" onClick={onLeave}>
              Leave lobby
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
