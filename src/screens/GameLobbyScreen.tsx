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
import { useState } from "react";

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

  function handleResult(
    result: GameMutationResult | StateMutationResult | undefined
  ): boolean {
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
    handleResult(res.data?.addAiSeat);
  }

  async function onRemove(playerId: string): Promise<void> {
    const res = await removeSeat({
      variables: { gameId: game.gameId, targetPlayerId: playerId },
    });
    handleResult(res.data?.removeSeat);
  }

  async function onLeave(): Promise<void> {
    const res = await leaveGame({ variables: { gameId: game.gameId } });
    if (handleResult(res.data?.leaveGame)) navigate("/");
  }

  async function onStart(): Promise<void> {
    const res = await startGame({ variables: { gameId: game.gameId } });
    handleResult(res.data?.startGame);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-100">{game.name}</h2>
        <p className="text-sm text-slate-400">
          Lobby · {game.playerCount}/{game.maxPlayers} seats ·{" "}
          {game.isPublic ? "public" : "private"}
          {game.inviteCode && (
            <>
              {" · invite "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                {game.inviteCode}
              </code>
            </>
          )}
        </p>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
          Seats
        </h3>
        <PlayerList players={players} ownerUserId={game.ownerUserId} />
        {isOwner && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {players
              .filter((p) => p.userId !== user?.userId)
              .map((p) => (
                <button
                  key={p.playerId}
                  type="button"
                  onClick={() => onRemove(p.playerId)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Remove seat {p.seatOrder + 1}
                </button>
              ))}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-200">Add AI seat</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-slate-400">
              Archetype
              <select
                value={aiArchetype}
                onChange={(e) => setAiArchetype(e.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-slate-400">
              Difficulty
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                {["easy", "medium", "hard", "brutal"].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onAddAi}
              disabled={addingAi || game.playerCount >= game.maxPlayers}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:bg-indigo-900"
            >
              Add AI
            </button>
          </div>
        </section>
      )}

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      <div className="flex gap-2">
        {isOwner ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting || game.playerCount < game.minPlayers}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-900"
          >
            {starting ? "Starting…" : "Start game"}
          </button>
        ) : myPlayer ? (
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Leave lobby
          </button>
        ) : null}
      </div>
    </div>
  );
}
