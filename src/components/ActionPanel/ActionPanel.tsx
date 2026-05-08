import { useMemo, useState } from "react";
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
  const stateById = useMemo(
    () => new Map(countryStates.map((s) => [s.countryId, s] as const)),
    [countryStates]
  );
  const selected = selectedCountryId ? stateById.get(selectedCountryId) ?? null : null;
  const isMyTurn = !!myPlayer && game.turn.activePlayerId === myPlayer.playerId;

  const [error, setError] = useState<string | null>(null);
  const [reinforceCount, setReinforceCount] = useState<number>(1);
  const [armiesInput, setArmiesInput] = useState<number>(1);
  const [attackTarget, setAttackTarget] = useState<string>("");

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
      <div style={{ fontSize: 11, color: "var(--ink-dim)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          Waiting on{" "}
          <span style={{ color: active?.color }}>
            seat {active ? active.seatOrder + 1 : "?"}
          </span>
          {active?.kind === "ai" ? ` · AI ${active.archetype}` : ""}.
        </div>
        <div>Round {game.turn.roundNumber} · turn {game.turn.turnNumber} · {game.turn.phase}</div>
      </div>
    );
  }

  const isMine = (s: CountryState | null): boolean =>
    !!s && s.ownerPlayerId === myPlayer.playerId;
  const researcherHere =
    !!selected && myPlayer.researcherCountryId === selected.countryId;
  const myResearcherState = stateById.get(myPlayer.researcherCountryId ?? "") ?? null;
  const adjacentToMyResearcher = myPlayer.researcherCountryId
    ? neighborIds(state, myPlayer.researcherCountryId)
    : new Set<string>();
  const adjacentToSelected = selected ? neighborIds(state, selected.countryId) : new Set<string>();

  if (game.turn.phase === "reinforcements") {
    const remaining = game.turn.reinforcementsToPlace;
    const canPlace = !!selected && isMine(selected) && reinforceCount >= 1 && reinforceCount <= remaining;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11 }}>
          Reinforcements remaining: <b style={{ color: "var(--neon)" }}>{remaining}</b>
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
          Click one of your countries on the map, set count, place.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="label" style={{ margin: 0 }}>count</span>
          <input
            type="number"
            min={1}
            max={remaining}
            className="input"
            style={{ width: 70, padding: "4px 6px" }}
            value={reinforceCount}
            onChange={(e) => setReinforceCount(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn btn-good"
            style={{ padding: "4px 10px", fontSize: 10 }}
            disabled={!canPlace}
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
          <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
            Target: <code style={{ color: "var(--neon)" }}>{selected.countryId}</code> ({selected.armies}a)
          </div>
        )}
        {error && <div className="alert">{error}</div>}
      </div>
    );
  }

  // Action phase
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11 }}>
        Actions remaining: <b style={{ color: "var(--neon)" }}>{game.turn.actionsRemaining}</b>
      </div>

      {selected ? (
        <div className="subform">
          <div style={{ fontSize: 11, color: "var(--ink)" }}>{selected.countryId}</div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
            {selected.armies}a · {selected.diseaseCubes} cubes
            {selected.vaccinated ? " · vaccinated" : ""}
            {selected.isCapitalOf ? " · capital" : ""}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>Click a country on the map to target.</div>
      )}

      <div className="action-grid">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!selected || !myPlayer.researcherCountryId || !adjacentToMyResearcher.has(selected.countryId)}
          onClick={async () => {
            if (!selected) return;
            const r = await moveResearcher({
              variables: { gameId: game.gameId, toCountryId: selected.countryId },
            });
            handle(r.data?.moveResearcher);
          }}
        >
          Move researcher · 1
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!selected || !myPlayer.researcherCountryId || game.turn.actionsRemaining < 2}
          onClick={async () => {
            if (!selected) return;
            const r = await airdropResearcher({
              variables: { gameId: game.gameId, toCountryId: selected.countryId },
            });
            handle(r.data?.airdropResearcher);
          }}
        >
          Airdrop · 2
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!researcherHere || (myResearcherState?.diseaseCubes ?? 0) === 0}
          onClick={async () => {
            const r = await cure({ variables: { gameId: game.gameId } });
            handle(r.data?.cure);
          }}
        >
          Cure · 1
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!researcherHere}
          onClick={async () => {
            const r = await createVaccine({ variables: { gameId: game.gameId } });
            handle(r.data?.createVaccine);
          }}
        >
          Vaccine · 1
        </button>
      </div>

      <div className="subform">
        <div className="section-hd" style={{ margin: 0, padding: 0, border: 0 }}>
          attack / move
        </div>
        <div className="row">
          <span className="label" style={{ margin: 0 }}>source</span>
          <code style={{ color: "var(--neon)", fontSize: 10 }}>{selectedCountryId ?? "—"}</code>
        </div>
        <div className="row">
          <span className="label" style={{ margin: 0 }}>target</span>
          <select
            className="select"
            value={attackTarget}
            onChange={(e) => setAttackTarget(e.target.value)}
            style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}
          >
            <option value="">— adjacent —</option>
            {[...adjacentToSelected].map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="label" style={{ margin: 0 }}>armies</span>
          <input
            type="number"
            min={1}
            className="input"
            style={{ width: 70, padding: "4px 6px" }}
            value={armiesInput}
            onChange={(e) => setArmiesInput(Number(e.target.value))}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-bad"
            style={{ padding: "4px 10px", fontSize: 10, flex: 1 }}
            disabled={!selected || !attackTarget || !isMine(selected)}
            onClick={async () => {
              if (!selected || !attackTarget) return;
              const r = await attack({
                variables: {
                  gameId: game.gameId,
                  fromCountryId: selected.countryId,
                  toCountryId: attackTarget,
                  armies: armiesInput,
                },
              });
              handle(r.data?.attack);
            }}
          >
            Attack · 1
          </button>
          <button
            type="button"
            className="btn"
            style={{ padding: "4px 10px", fontSize: 10, flex: 1 }}
            disabled={
              !selected ||
              !attackTarget ||
              !isMine(selected) ||
              !isMine(stateById.get(attackTarget) ?? null)
            }
            onClick={async () => {
              if (!selected || !attackTarget) return;
              const r = await moveTroops({
                variables: {
                  gameId: game.gameId,
                  fromCountryId: selected.countryId,
                  toCountryId: attackTarget,
                  armies: armiesInput,
                },
              });
              handle(r.data?.moveTroops);
            }}
          >
            Move · 1
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "4px 10px", fontSize: 10 }}
          onClick={() => setSelectedCountryId(null)}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: "4px 10px", fontSize: 10 }}
          onClick={async () => {
            const r = await endTurn({ variables: { gameId: game.gameId } });
            handle(r.data?.endTurn);
          }}
        >
          End turn ▸
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
    </div>
  );
}
