import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { CREATE_GAME_MUTATION } from "@/api/operations";
import type { CreateGameResult } from "@/api/types";

interface FormState {
  name: string;
  maxPlayers: number;
  isPublic: boolean;
  seed: string;
}

export function CreateGameRoute(): JSX.Element {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: "",
    maxPlayers: 4,
    isPublic: true,
    seed: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [createGame, { loading }] = useMutation<{ createGame: CreateGameResult }>(
    CREATE_GAME_MUTATION
  );

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const seed = form.seed.trim() === "" ? null : Number(form.seed);
    if (seed !== null && (!Number.isFinite(seed) || !Number.isInteger(seed))) {
      setError("Seed must be an integer.");
      return;
    }
    const res = await createGame({
      variables: {
        name: form.name.trim() || null,
        maxPlayers: form.maxPlayers,
        isPublic: form.isPublic,
        seed,
      },
      refetchQueries: ["JoinableGamesQuery"],
    });
    const result = res.data?.createGame;
    if (result?.__typename === "GameResult") {
      navigate(`/games/${result.game.gameId}`);
    } else if (result?.__typename === "GameError") {
      setError(result.message);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h2 className="mb-6 text-xl font-semibold text-slate-100">Create game</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor="name">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor="maxPlayers">
            Max players
          </label>
          <select
            id="maxPlayers"
            value={form.maxPlayers}
            onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="isPublic"
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="isPublic" className="text-sm text-slate-300">
            Public — listed on the lobby page
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor="seed">
            Map seed (optional integer)
          </label>
          <input
            id="seed"
            type="text"
            value={form.seed}
            onChange={(e) => setForm({ ...form, seed: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
            placeholder="42"
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:bg-indigo-900"
          >
            {loading ? "Creating…" : "Create game"}
          </button>
        </div>
      </form>
    </div>
  );
}
