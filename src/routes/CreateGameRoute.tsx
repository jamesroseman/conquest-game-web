import { useState } from "react";
import { useMutation } from "@apollo/client";
import { useNavigate, Link } from "react-router-dom";
import { CREATE_GAME } from "@/api/operations";
import type { CreateGameResult } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CreateGameRoute() {
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [seed, setSeed] = useState("");
  const [actionsPerTurn, setActionsPerTurn] = useState(5);
  const [startingTroops, setStartingTroops] = useState(30);
  const [outbreakLossThreshold, setOutbreakLossThreshold] = useState(11);

  const nav = useNavigate();
  const toast = useToast();
  const [createGame, { loading }] = useMutation<{ createGame: CreateGameResult }>(CREATE_GAME);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await createGame({
        variables: {
          name: name.trim() || null,
          maxPlayers,
          isPublic,
          seed: seed.trim() ? Number(seed) : null,
          config: {
            actionsPerTurn,
            startingTroopsPerPlayer: startingTroops,
            outbreakLossThreshold,
          },
        },
      });
      const r = res.data?.createGame;
      if (!r) return;
      if (r.__typename === "GameError") {
        toast.push(`${r.code}: ${r.message}`, "error");
        return;
      }
      nav(`/games/${r.game.gameId}`);
    } catch (err) {
      toast.push((err as Error).message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link to="/" className="text-sm text-parchment/60 hover:text-parchment">
        ← Back to lobby
      </Link>
      <h1 className="mt-4 font-display text-3xl tracking-wider text-amber-400">New game</h1>

      <form
        onSubmit={onSubmit}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-parchment/20 bg-ocean/40 p-6"
      >
        <Field label="Name (optional)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Long Game"
            className="rounded bg-ocean-deep px-3 py-2 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
          />
        </Field>

        <Field label="Max players">
          <input
            type="number"
            min={2}
            max={6}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-24 rounded bg-ocean-deep px-3 py-2 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Listed publicly in lobby
        </label>

        <Field label="Map seed (optional)">
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="e.g. 42"
            className="rounded bg-ocean-deep px-3 py-2 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
          />
        </Field>

        <details className="rounded border border-parchment/10 px-3 py-2">
          <summary className="cursor-pointer text-sm text-parchment/80">Advanced config</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Actions / turn">
              <input
                type="number"
                min={1}
                max={20}
                value={actionsPerTurn}
                onChange={(e) => setActionsPerTurn(Number(e.target.value))}
                className="w-full rounded bg-ocean-deep px-2 py-1 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              />
            </Field>
            <Field label="Starting troops">
              <input
                type="number"
                min={5}
                max={100}
                value={startingTroops}
                onChange={(e) => setStartingTroops(Number(e.target.value))}
                className="w-full rounded bg-ocean-deep px-2 py-1 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              />
            </Field>
            <Field label="Outbreak loss threshold">
              <input
                type="number"
                min={1}
                max={50}
                value={outbreakLossThreshold}
                onChange={(e) => setOutbreakLossThreshold(Number(e.target.value))}
                className="w-full rounded bg-ocean-deep px-2 py-1 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
              />
            </Field>
          </div>
        </details>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create game"}
          </Button>
          <Link to="/">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wider text-parchment/60">{label}</label>
      {children}
    </div>
  );
}
