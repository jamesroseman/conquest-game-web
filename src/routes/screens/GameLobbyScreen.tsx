import { useState } from "react";
import { useMutation } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import {
  ADD_AI_SEAT,
  LEAVE_GAME,
  REMOVE_SEAT,
  START_GAME,
} from "@/api/operations";
import { ARCHETYPES, DIFFICULTIES } from "@/api/types";
import type {
  Archetype,
  Difficulty,
  Game,
  GameMutationResult,
  Player,
  StateMutationResult,
} from "@/api/types";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Props {
  game: Game;
  players: Player[];
}

export function GameLobbyScreen({ game, players }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [archetype, setArchetype] = useState<Archetype>("aggressor");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const isOwner = user?.userId === game.ownerUserId;
  const sorted = [...players].sort((a, b) => a.seatOrder - b.seatOrder);

  const [addAi, { loading: addingAi }] = useMutation<{ addAiSeat: GameMutationResult }>(
    ADD_AI_SEAT,
    { refetchQueries: ["GameQuery"] },
  );
  const [removeSeat, { loading: removing }] = useMutation<{ removeSeat: GameMutationResult }>(
    REMOVE_SEAT,
    { refetchQueries: ["GameQuery"] },
  );
  const [leaveGame, { loading: leaving }] = useMutation<{ leaveGame: GameMutationResult }>(
    LEAVE_GAME,
  );
  const [startGame, { loading: starting }] = useMutation<{ startGame: StateMutationResult }>(
    START_GAME,
    { refetchQueries: ["GameQuery"] },
  );

  function handle<T extends { __typename: string; code?: string; message?: string }>(
    name: string,
    r?: T,
  ): boolean {
    if (!r) return false;
    if (r.__typename === "GameError") {
      toast.push(`${name}: ${r.code} — ${r.message}`, "error");
      return false;
    }
    return true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wider text-amber-400">{game.name}</h1>
          <p className="text-sm text-parchment/60">
            Lobby · {game.playerCount}/{game.maxPlayers} players
            {game.inviteCode ? ` · invite ${game.inviteCode}` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={() => nav("/")}>
          ← Lobby
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-parchment/10 bg-ocean/40 p-4">
        <h2 className="text-sm uppercase tracking-wider text-parchment/60">Seats</h2>
        <ul className="mt-2 divide-y divide-parchment/10">
          {sorted.map((p) => {
            const isMe = p.userId === user?.userId;
            return (
              <li
                key={p.playerId}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: p.color }}
                />
                <span className="flex-1">
                  Seat {p.seatOrder + 1}:{" "}
                  {p.kind === "ai"
                    ? `AI · ${p.archetype} (${p.difficulty})`
                    : isMe
                      ? "You"
                      : `Player ${p.seatOrder + 1}`}
                </span>
                {isOwner && p.userId !== game.ownerUserId && (
                  <Button
                    variant="ghost"
                    disabled={removing}
                    onClick={async () => {
                      const res = await removeSeat({
                        variables: { gameId: game.gameId, targetPlayerId: p.playerId },
                      });
                      handle("remove_seat", res.data?.removeSeat);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {sorted.length < game.maxPlayers && (
          <p className="mt-2 text-xs text-parchment/50">
            {game.maxPlayers - sorted.length} seat
            {game.maxPlayers - sorted.length === 1 ? "" : "s"} open.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="mt-4 rounded-lg border border-parchment/10 bg-ocean/40 p-4">
          <h2 className="text-sm uppercase tracking-wider text-parchment/60">Add AI seat</h2>
          <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
            <div className="flex flex-col">
              <label className="text-xs text-parchment/50">Archetype</label>
              <select
                value={archetype}
                onChange={(e) => setArchetype(e.target.value as Archetype)}
                className="rounded bg-ocean-deep px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              >
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-parchment/50">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="rounded bg-ocean-deep px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={addingAi || sorted.length >= game.maxPlayers}
              onClick={async () => {
                const res = await addAi({
                  variables: { gameId: game.gameId, archetype, difficulty },
                });
                handle("add_ai_seat", res.data?.addAiSeat);
              }}
            >
              + Add AI
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {isOwner ? (
          <Button
            disabled={starting || sorted.length < game.minPlayers}
            onClick={async () => {
              const res = await startGame({ variables: { gameId: game.gameId } });
              handle("start_game", res.data?.startGame);
            }}
          >
            {starting ? "Starting…" : "Start game"}
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={leaving}
            onClick={async () => {
              const res = await leaveGame({ variables: { gameId: game.gameId } });
              if (handle("leave_game", res.data?.leaveGame)) nav("/");
            }}
          >
            Leave lobby
          </Button>
        )}
      </div>
    </div>
  );
}
