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
    <div className="page-shell">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="panel">
          <div className="hd">new game</div>
          <div className="bd">
            <form onSubmit={onSubmit} className="form-grid">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="optional · server picks one if blank"
                />
              </div>
              <div>
                <label className="label" htmlFor="maxPlayers">Max players</label>
                <select
                  id="maxPlayers"
                  className="select"
                  value={form.maxPlayers}
                  onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                />
                Public — listed on the lobby page
              </label>
              <div>
                <label className="label" htmlFor="seed">Map seed</label>
                <input
                  id="seed"
                  type="text"
                  className="input"
                  value={form.seed}
                  onChange={(e) => setForm({ ...form, seed: e.target.value })}
                  placeholder="optional integer"
                />
              </div>

              {error && <div className="alert">{error}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Forging…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
