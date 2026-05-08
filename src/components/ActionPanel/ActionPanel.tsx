import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  AIRDROP_RESEARCHER,
  ATTACK,
  CREATE_VACCINE,
  CURE,
  END_TURN,
  MOVE_RESEARCHER,
  MOVE_TROOPS,
  PLACE_REINFORCEMENTS,
} from "@/api/operations";
import type { CountryState, GameStateView, Player, StateMutationResult } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Mode = "idle" | "reinforce" | "attack" | "move-troops" | "move-researcher" | "airdrop";

interface Props {
  state: GameStateView;
  myPlayer: Player | null;
  selectedCountryId: string | null;
  setSelectedCountryId: (id: string | null) => void;
}

export function ActionPanel({
  state,
  myPlayer,
  selectedCountryId,
  setSelectedCountryId,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [armiesInput, setArmiesInput] = useState(1);
  const toast = useToast();

  const csById = new Map<string, CountryState>(
    state.countryStates.map((s) => [s.countryId, s]),
  );
  const selected = selectedCountryId ? csById.get(selectedCountryId) : null;
  const isMyTurn = !!myPlayer && state.game.turn.activePlayerId === myPlayer.playerId;
  const phase = state.game.turn.phase;
  const reinforcementsToPlace = state.game.turn.reinforcementsToPlace;
  const actionsRemaining = state.game.turn.actionsRemaining;

  function handleResult(name: string, r?: StateMutationResult): boolean {
    if (!r) return false;
    if (r.__typename === "GameError") {
      toast.push(`${name}: ${r.code} — ${r.message}`, "error");
      return false;
    }
    return true;
  }

  const [placeReinf, { loading: rLoading }] = useMutation<{
    placeReinforcements: StateMutationResult;
  }>(PLACE_REINFORCEMENTS);
  const [moveResearcher, { loading: mrLoading }] = useMutation<{
    moveResearcher: StateMutationResult;
  }>(MOVE_RESEARCHER);
  const [airdrop, { loading: adLoading }] = useMutation<{
    airdropResearcher: StateMutationResult;
  }>(AIRDROP_RESEARCHER);
  const [cure, { loading: cureLoading }] = useMutation<{ cure: StateMutationResult }>(CURE);
  const [vaccine, { loading: vacLoading }] = useMutation<{
    createVaccine: StateMutationResult;
  }>(CREATE_VACCINE);
  const [attack, { loading: atkLoading }] = useMutation<{ attack: StateMutationResult }>(ATTACK);
  const [moveTroops, { loading: mtLoading }] = useMutation<{
    moveTroops: StateMutationResult;
  }>(MOVE_TROOPS);
  const [endTurn, { loading: etLoading }] = useMutation<{ endTurn: StateMutationResult }>(END_TURN);

  const gameId = state.game.gameId;
  const busy =
    rLoading || mrLoading || adLoading || cureLoading || vacLoading || atkLoading || mtLoading || etLoading;

  if (!myPlayer) {
    return (
      <Panel title="Spectator">
        <p className="text-sm text-parchment/70">You are not seated in this game.</p>
      </Panel>
    );
  }

  if (!isMyTurn) {
    return (
      <Panel title="Waiting">
        <p className="text-sm text-parchment/70">
          Round {state.game.turn.roundNumber + 1} · Turn {state.game.turn.turnNumber + 1}
        </p>
        <p className="mt-1 text-xs text-parchment/50">It is not your turn.</p>
      </Panel>
    );
  }

  // --- Reinforcement sub-phase ---
  if (phase === "reinforcements" || reinforcementsToPlace > 0) {
    const owned = state.countryStates.filter((s) => s.ownerPlayerId === myPlayer.playerId);
    const target = selected && selected.ownerPlayerId === myPlayer.playerId ? selected : null;
    return (
      <Panel title={`Place reinforcements (${reinforcementsToPlace} left)`}>
        <p className="text-xs text-parchment/60">
          Click one of your countries on the map, then drop troops.
        </p>
        {target ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="text-sm">
              Target: <span className="text-amber-300">{target.countryId}</span>
            </div>
            <input
              type="number"
              min={1}
              max={reinforcementsToPlace}
              value={armiesInput}
              onChange={(e) => setArmiesInput(Number(e.target.value))}
              className="rounded bg-ocean-deep px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
            />
            <Button
              disabled={busy || armiesInput < 1 || armiesInput > reinforcementsToPlace}
              onClick={async () => {
                const res = await placeReinf({
                  variables: {
                    gameId,
                    placements: [{ countryId: target.countryId, count: armiesInput }],
                  },
                });
                if (handleResult("place_reinforcements", res.data?.placeReinforcements)) {
                  setArmiesInput(1);
                }
              }}
            >
              Place {armiesInput}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-parchment/50">
            You own {owned.length} {owned.length === 1 ? "country" : "countries"}.
          </p>
        )}
      </Panel>
    );
  }

  // --- Action sub-phase ---
  const myResearcherAt = myPlayer.researcherCountryId;
  const researcherHere = !!selected && selected.hasResearcher === myPlayer.playerId;

  return (
    <Panel
      title={`Your turn — ${actionsRemaining} action${actionsRemaining === 1 ? "" : "s"} left`}
    >
      {selected ? (
        <p className="text-xs text-parchment/60">
          Selected: <span className="text-amber-300">{selected.countryId}</span>
          {selected.ownerPlayerId === myPlayer.playerId ? " (yours)" : ""}
        </p>
      ) : (
        <p className="text-xs text-parchment/60">Select a country on the map.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={busy || !researcherHere}
          onClick={async () => {
            const res = await cure({ variables: { gameId } });
            handleResult("cure", res.data?.cure);
          }}
        >
          Cure
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !researcherHere}
          onClick={async () => {
            const res = await vaccine({ variables: { gameId } });
            handleResult("create_vaccine", res.data?.createVaccine);
          }}
        >
          Vaccine
        </Button>
        <Button
          variant={mode === "move-researcher" ? "primary" : "secondary"}
          disabled={busy || !myResearcherAt}
          onClick={() => {
            setMode(mode === "move-researcher" ? "idle" : "move-researcher");
            setSelectedCountryId(null);
          }}
        >
          Move researcher
        </Button>
        <Button
          variant={mode === "airdrop" ? "primary" : "secondary"}
          disabled={busy || !myResearcherAt}
          onClick={() => {
            setMode(mode === "airdrop" ? "idle" : "airdrop");
            setSelectedCountryId(null);
          }}
        >
          Airdrop (2)
        </Button>
        <Button
          variant={mode === "attack" ? "primary" : "secondary"}
          disabled={busy}
          onClick={() => setMode(mode === "attack" ? "idle" : "attack")}
        >
          Attack
        </Button>
        <Button
          variant={mode === "move-troops" ? "primary" : "secondary"}
          disabled={busy}
          onClick={() => setMode(mode === "move-troops" ? "idle" : "move-troops")}
        >
          Move troops
        </Button>
      </div>

      {(mode === "move-researcher" || mode === "airdrop") && (
        <div className="mt-3 rounded border border-parchment/10 bg-ocean-deep/50 p-2 text-xs">
          {selected ? (
            <Button
              disabled={busy}
              onClick={async () => {
                const variables = { gameId, toCountryId: selected.countryId };
                const res =
                  mode === "airdrop"
                    ? await airdrop({ variables })
                    : await moveResearcher({ variables });
                const r =
                  mode === "airdrop"
                    ? res.data?.airdropResearcher
                    : res.data?.moveResearcher;
                if (handleResult(mode, r)) setMode("idle");
              }}
            >
              Send researcher to {selected.countryId}
            </Button>
          ) : (
            "Pick a destination country."
          )}
        </div>
      )}

      {(mode === "attack" || mode === "move-troops") && (
        <TwoCountryAction
          mode={mode}
          state={state}
          myPlayer={myPlayer}
          busy={busy}
          onCancel={() => setMode("idle")}
          run={async (fromId, toId, armies) => {
            const variables = { gameId, fromCountryId: fromId, toCountryId: toId, armies };
            const res =
              mode === "attack"
                ? await attack({ variables })
                : await moveTroops({ variables });
            const r = mode === "attack" ? res.data?.attack : res.data?.moveTroops;
            if (handleResult(mode, r)) setMode("idle");
          }}
        />
      )}

      <div className="mt-4 border-t border-parchment/10 pt-3">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            const res = await endTurn({ variables: { gameId } });
            handleResult("end_turn", res.data?.endTurn);
          }}
        >
          End turn
        </Button>
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-parchment/10 bg-ocean/40">
      <div className="border-b border-parchment/10 px-3 py-2 text-xs uppercase tracking-wider text-parchment/60">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function TwoCountryAction({
  mode,
  state,
  myPlayer,
  busy,
  onCancel,
  run,
}: {
  mode: "attack" | "move-troops";
  state: GameStateView;
  myPlayer: Player;
  busy: boolean;
  onCancel: () => void;
  run: (fromId: string, toId: string, armies: number) => Promise<void>;
}) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [armies, setArmies] = useState(1);

  const myCountries = state.countryStates.filter((s) => s.ownerPlayerId === myPlayer.playerId);
  const fromState = myCountries.find((c) => c.countryId === from);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded border border-parchment/10 bg-ocean-deep/50 p-2 text-sm">
      <label className="text-xs uppercase tracking-wider text-parchment/60">From (yours)</label>
      <select
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded bg-ocean px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
      >
        <option value="">— select —</option>
        {myCountries.map((c) => (
          <option key={c.countryId} value={c.countryId}>
            {c.countryId} ({c.armies}🛡)
          </option>
        ))}
      </select>
      <label className="text-xs uppercase tracking-wider text-parchment/60">
        To country id
      </label>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="(click on the map or paste)"
        className="rounded bg-ocean px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
      />
      <label className="text-xs uppercase tracking-wider text-parchment/60">Armies</label>
      <input
        type="number"
        min={1}
        max={fromState ? fromState.armies : undefined}
        value={armies}
        onChange={(e) => setArmies(Number(e.target.value))}
        className="rounded bg-ocean px-2 py-1 outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
      />
      <div className="flex gap-2">
        <Button
          disabled={busy || !from || !to || armies < 1}
          onClick={() => run(from, to, armies)}
        >
          {mode === "attack" ? "Attack" : "Move"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
