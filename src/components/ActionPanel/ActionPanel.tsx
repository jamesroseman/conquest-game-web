import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  AIRDROP_RESEARCHER_MUTATION,
  ATTACK_MUTATION,
  CREATE_VACCINE_MUTATION,
  CURE_MUTATION,
  END_TURN_MUTATION,
  MOVE_RESEARCHER_MUTATION,
  MOVE_TROOPS_MUTATION,
  PLACE_REINFORCEMENTS_MUTATION,
} from "@/api/operations";
import type {
  CountryState,
  GameStateView,
  Player,
  StateMutationResult,
  TilePlacementInput,
} from "@/api/types";

interface Props {
  state: GameStateView;
  myPlayer: Player | null;
  selectedCountryId: string | null;
  setSelectedCountryId: (id: string | null) => void;
}

function neighborIds(state: GameStateView, countryId: string): Set<string> {
  if (!state.map) return new Set();
  const result = new Set<string>();
  for (const p of state.map.paths) {
    if (p.countryAId === countryId) result.add(p.countryBId);
    else if (p.countryBId === countryId) result.add(p.countryAId);
  }
  return result;
}

export function ActionPanel({
  state,
  myPlayer,
  selectedCountryId,
  setSelectedCountryId,
}: Props): JSX.Element {
  const { game, countryStates } = state;
  const stateById = new Map(countryStates.map((s) => [s.countryId, s] as const));
  const selected = selectedCountryId ? stateById.get(selectedCountryId) ?? null : null;

  const isMyTurn = !!myPlayer && game.turn.activePlayerId === myPlayer.playerId;
  const [error, setError] = useState<string | null>(null);
  const [reinforceCount, setReinforceCount] = useState<number>(1);
  const [armiesInput, setArmiesInput] = useState<number>(1);

  function handle(result: StateMutationResult | undefined): void {
    if (!result) return;
    if (result.__typename === "GameError") setError(result.message);
    else setError(null);
  }

  const [placeReinforcements] = useMutation<
    { placeReinforcements: StateMutationResult },
    { gameId: string; placements: TilePlacementInput[] }
  >(PLACE_REINFORCEMENTS_MUTATION);
  const [moveResearcher] = useMutation<
    { moveResearcher: StateMutationResult },
    { gameId: string; toCountryId: string }
  >(MOVE_RESEARCHER_MUTATION);
  const [airdropResearcher] = useMutation<
    { airdropResearcher: StateMutationResult },
    { gameId: string; toCountryId: string }
  >(AIRDROP_RESEARCHER_MUTATION);
  const [cure] = useMutation<{ cure: StateMutationResult }, { gameId: string }>(CURE_MUTATION);
  const [createVaccine] = useMutation<
    { createVaccine: StateMutationResult },
    { gameId: string }
  >(CREATE_VACCINE_MUTATION);
  const [attack] = useMutation<
    { attack: StateMutationResult },
    { gameId: string; fromCountryId: string; toCountryId: string; armies: number }
  >(ATTACK_MUTATION);
  const [moveTroops] = useMutation<
    { moveTroops: StateMutationResult },
    { gameId: string; fromCountryId: string; toCountryId: string; armies: number }
  >(MOVE_TROOPS_MUTATION);
  const [endTurn] = useMutation<{ endTurn: StateMutationResult }, { gameId: string }>(
    END_TURN_MUTATION
  );

  if (!isMyTurn || !myPlayer) {
    const active = state.players.find((p) => p.playerId === game.turn.activePlayerId);
    return (
      <div className="space-y-2 text-sm text-slate-300">
        <p>Waiting for {active?.kind === "ai" ? `AI (${active.archetype})` : "the other player"} to act.</p>
        <p className="text-xs text-slate-500">
          Round {game.turn.roundNumber} · turn {game.turn.turnNumber} · {game.turn.phase}
        </p>
      </div>
    );
  }

  const isMine = (s: CountryState | null): boolean =>
    !!s && s.ownerPlayerId === myPlayer.playerId;
  const researcherHere =
    !!selected && myPlayer.researcherCountryId === selected.countryId;

  if (game.turn.phase === "reinforcements") {
    const remaining = game.turn.reinforcementsToPlace;
    const canPlace = !!selected && isMine(selected) && reinforceCount >= 1 && reinforceCount <= remaining;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-slate-200">
          Place reinforcements: <span className="font-semibold">{remaining}</span> remaining.
        </p>
        <p className="text-xs text-slate-400">Select one of your countries on the map.</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Count</label>
          <input
            type="number"
            min={1}
            max={remaining}
            value={reinforceCount}
            onChange={(e) => setReinforceCount(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={!canPlace}
            className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-900"
            onClick={async () => {
              if (!selected) return;
              const r = await placeReinforcements({
                variables: {
                  gameId: game.gameId,
                  placements: [{ countryId: selected.countryId, count: reinforceCount }],
                },
              });
              handle(r.data?.placeReinforcements);
            }}
          >
            Place
          </button>
        </div>
        {selected && (
          <p className="text-xs text-slate-400">
            Selected: <span className="font-mono">{selected.countryId}</span> ({selected.armies} armies)
          </p>
        )}
        {error && <p className="text-rose-400">{error}</p>}
      </div>
    );
  }

  // Action phase
  const myResearcherState = stateById.get(myPlayer.researcherCountryId ?? "") ?? null;
  const adjacentToMyResearcher = myPlayer.researcherCountryId
    ? neighborIds(state, myPlayer.researcherCountryId)
    : new Set<string>();
  const adjacentToSelected = selected ? neighborIds(state, selected.countryId) : new Set<string>();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-200">
        Actions remaining: <span className="font-semibold">{game.turn.actionsRemaining}</span>
      </p>
      {selected ? (
        <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
          <p className="text-slate-100">{selected.countryId}</p>
          <p className="text-xs text-slate-400">
            armies {selected.armies} · cubes {selected.diseaseCubes}
            {selected.vaccinated && " · vaccinated"}
            {selected.isCapitalOf && " · capital"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Click a country on the map to target an action.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!selected || !myPlayer.researcherCountryId || !adjacentToMyResearcher.has(selected.countryId)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          onClick={async () => {
            if (!selected) return;
            const r = await moveResearcher({ variables: { gameId: game.gameId, toCountryId: selected.countryId } });
            handle(r.data?.moveResearcher);
          }}
        >
          Move researcher (1)
        </button>
        <button
          type="button"
          disabled={!selected || !myPlayer.researcherCountryId || game.turn.actionsRemaining < 2}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          onClick={async () => {
            if (!selected) return;
            const r = await airdropResearcher({ variables: { gameId: game.gameId, toCountryId: selected.countryId } });
            handle(r.data?.airdropResearcher);
          }}
        >
          Airdrop researcher (2)
        </button>
        <button
          type="button"
          disabled={!researcherHere || (myResearcherState?.diseaseCubes ?? 0) === 0}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          onClick={async () => {
            const r = await cure({ variables: { gameId: game.gameId } });
            handle(r.data?.cure);
          }}
        >
          Cure (1)
        </button>
        <button
          type="button"
          disabled={!researcherHere}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          onClick={async () => {
            const r = await createVaccine({ variables: { gameId: game.gameId } });
            handle(r.data?.createVaccine);
          }}
        >
          Create vaccine (1)
        </button>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Attack / move troops</p>
        <p className="mb-2 text-xs text-slate-400">
          Click your country to set the source (selected = source). Then enter target by clicking
          an adjacent country with shift-click below.
        </p>
        <SourceTargetForm
          state={state}
          armies={armiesInput}
          onArmiesChange={setArmiesInput}
          adjacentToSelected={adjacentToSelected}
          isMine={isMine}
          stateById={stateById}
          onAttack={async (fromId, toId, armies) => {
            const r = await attack({
              variables: { gameId: game.gameId, fromCountryId: fromId, toCountryId: toId, armies },
            });
            handle(r.data?.attack);
          }}
          onMove={async (fromId, toId, armies) => {
            const r = await moveTroops({
              variables: { gameId: game.gameId, fromCountryId: fromId, toCountryId: toId, armies },
            });
            handle(r.data?.moveTroops);
          }}
          selectedCountryId={selectedCountryId}
        />
      </div>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          onClick={() => setSelectedCountryId(null)}
        >
          Clear selection
        </button>
        <button
          type="button"
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
          onClick={async () => {
            const r = await endTurn({ variables: { gameId: game.gameId } });
            handle(r.data?.endTurn);
          }}
        >
          End turn
        </button>
      </div>

      {error && <p className="text-rose-400">{error}</p>}
    </div>
  );
}

interface SourceTargetFormProps {
  state: GameStateView;
  armies: number;
  onArmiesChange: (n: number) => void;
  adjacentToSelected: Set<string>;
  isMine: (s: CountryState | null) => boolean;
  stateById: Map<string, CountryState>;
  onAttack: (fromId: string, toId: string, armies: number) => void;
  onMove: (fromId: string, toId: string, armies: number) => void;
  selectedCountryId: string | null;
}

function SourceTargetForm({
  state,
  armies,
  onArmiesChange,
  adjacentToSelected,
  isMine,
  stateById,
  onAttack,
  onMove,
  selectedCountryId,
}: SourceTargetFormProps): JSX.Element {
  const [target, setTarget] = useState<string>("");
  const sourceState = selectedCountryId ? stateById.get(selectedCountryId) ?? null : null;
  const targets = state.map
    ? state.map.countries
        .filter((c) => adjacentToSelected.has(c.countryId))
        .map((c) => c.countryId)
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Source</label>
        <span className="font-mono text-xs text-slate-200">{selectedCountryId ?? "—"}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Target</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
        >
          <option value="">— select adjacent —</option>
          {targets.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Armies</label>
        <input
          type="number"
          min={1}
          value={armies}
          onChange={(e) => onArmiesChange(Number(e.target.value))}
          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!sourceState || !target || !isMine(sourceState)}
          className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:bg-rose-900"
          onClick={() => sourceState && target && onAttack(sourceState.countryId, target, armies)}
        >
          Attack (1)
        </button>
        <button
          type="button"
          disabled={!sourceState || !target || !isMine(sourceState) || !isMine(stateById.get(target) ?? null)}
          className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:bg-sky-900"
          onClick={() => sourceState && target && onMove(sourceState.countryId, target, armies)}
        >
          Move (1)
        </button>
      </div>
    </div>
  );
}
