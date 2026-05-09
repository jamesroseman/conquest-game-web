import { useEffect, useMemo, useState } from "react";
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
  Country,
  CountryState,
  GameStateView,
  Player,
  StateMutationResult,
  TilePlacementInput,
} from "@/api/types";

export type TargetMode = "attack" | "move" | null;

interface Props {
  state: GameStateView;
  myPlayer: Player | null;
  selectedCountryId: string | null;
  setSelectedCountryId: (id: string | null) => void;
  // The parent owns target-mode state so it can also pass the highlighted
  // ids down to MapView and route map clicks through MapView →
  // setTargetMode/onResolveTarget.
  targetMode: TargetMode;
  setTargetMode: (m: TargetMode) => void;
  // Imperative handle the parent fills in once mutations exist; ActionPanel
  // calls back with the chosen target so the parent can dispatch.
  onResolveTarget?: (targetCountryId: string, armies: number) => void;
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

interface ActionTileProps {
  glyph: string;
  label: string;
  cost: number;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  variant?: "default" | "good" | "bad";
  hint?: string;
  active?: boolean;
}

function ActionTile({
  glyph,
  label,
  cost,
  disabled,
  onClick,
  variant = "default",
  hint,
  active,
}: ActionTileProps): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick?.()}
      title={hint}
      className={`action-tile action-tile-${variant}${disabled ? " is-disabled" : ""}${active ? " is-active" : ""}`}
    >
      <span className="ag" aria-hidden>
        {glyph}
      </span>
      <span className="al">
        <span className="al-name">{label}</span>
        <span className="al-cost">{cost === 0 ? "free" : `${cost} ⚡`}</span>
      </span>
    </button>
  );
}

export function ActionPanel({
  state,
  myPlayer,
  selectedCountryId,
  setSelectedCountryId,
  targetMode,
  setTargetMode,
}: Props): JSX.Element {
  const { game, countryStates } = state;
  const stateById = useMemo(
    () => new Map(countryStates.map((s) => [s.countryId, s] as const)),
    [countryStates]
  );
  const countryById = useMemo(() => {
    const m = new Map<string, Country>();
    if (state.map) for (const c of state.map.countries) m.set(c.countryId, c);
    return m;
  }, [state.map]);

  const selected = selectedCountryId ? stateById.get(selectedCountryId) ?? null : null;
  const isMyTurn = !!myPlayer && game.turn.activePlayerId === myPlayer.playerId;

  const [error, setError] = useState<string | null>(null);
  const [reinforceCount, setReinforceCount] = useState<number>(1);
  const [armiesToCommit, setArmiesToCommit] = useState<number>(1);

  // Reset target mode whenever the underlying selection changes — entering
  // attack/move while pointing at a new source from a stale click is a
  // common foot-gun.
  useEffect(() => {
    setTargetMode(null);
  }, [selectedCountryId, setTargetMode]);

  function handle(result: StateMutationResult | undefined): void {
    if (!result) return;
    if (result.__typename === "GameError") setError(result.message);
    else {
      setError(null);
      setTargetMode(null);
    }
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
      <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
        <div>Round {game.turn.roundNumber} · turn {game.turn.turnNumber} · phase {game.turn.phase}</div>
        <div style={{ marginTop: 4 }}>
          {active ? (
            active.kind === "ai" ? (
              <>Watch the map — seat {active.seatOrder + 1} (AI) is making its move.</>
            ) : (
              <>Waiting on seat {active.seatOrder + 1}.</>
            )
          ) : (
            "Waiting…"
          )}
        </div>
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

  // -------- Reinforcement phase --------
  if (game.turn.phase === "reinforcements") {
    const remaining = game.turn.reinforcementsToPlace;
    const canPlace = !!selected && isMine(selected) && reinforceCount >= 1 && reinforceCount <= remaining;
    const selectedCountry = selected ? countryById.get(selected.countryId) : null;

    // Reinforcement breakdown: base + per-country + continent bonuses + capital
    // auto-place. Computed locally for display only — the server is still
    // authoritative for the actual reinforcementsToPlace value, this is just
    // showing the player how the number was derived.
    const cfg = game.config;
    const myCountriesOwned = myPlayer.countriesOwned;
    const perCountryBonus = cfg.reinforcementPerCountry * myCountriesOwned;
    const fullyOwnedContinents: { name: string; bonus: number }[] = [];
    if (state.map) {
      const ownedSet = new Set(
        state.countryStates
          .filter((s) => s.ownerPlayerId === myPlayer.playerId)
          .map((s) => s.countryId)
      );
      for (const cont of state.map.continents) {
        if (cont.bonusArmies > 0 && cont.countryIds.every((id) => ownedSet.has(id))) {
          fullyOwnedContinents.push({ name: cont.name, bonus: cont.bonusArmies });
        }
      }
    }
    const continentBonusTotal = fullyOwnedContinents.reduce((a, b) => a + b.bonus, 0);
    const capitalAuto = cfg.reinforcementCapitalBonus;
    const subTotal = cfg.reinforcementBase + perCountryBonus + continentBonusTotal;
    const placeable = Math.max(0, subTotal - capitalAuto);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="kv">
          <span className="k">reinforcements</span>
          <span className="v neon" style={{ fontWeight: 700, fontSize: 13 }}>{remaining}</span>
        </div>

        {/* How the total was calculated. Always visible during reinforcements
            so the player can sanity-check what the server gave them. */}
        <div className="subform" style={{ marginTop: 0 }}>
          <div className="section-hd" style={{ margin: 0, padding: 0, border: 0 }}>
            calculation
          </div>
          <div className="kv"><span className="k">base</span><span className="v">+{cfg.reinforcementBase}</span></div>
          <div className="kv">
            <span className="k">per country ({myCountriesOwned} × {cfg.reinforcementPerCountry})</span>
            <span className="v">+{perCountryBonus}</span>
          </div>
          {fullyOwnedContinents.length > 0 ? (
            fullyOwnedContinents.map((c) => (
              <div className="kv" key={c.name}>
                <span className="k">continent · {c.name}</span>
                <span className="v good">+{c.bonus}</span>
              </div>
            ))
          ) : (
            <div className="kv">
              <span className="k">continent bonus</span>
              <span className="v" style={{ color: "var(--ink-faint)" }}>none</span>
            </div>
          )}
          <div className="kv" style={{ borderTop: "1px dashed rgba(91,227,255,0.18)", paddingTop: 4, marginTop: 2 }}>
            <span className="k">subtotal</span>
            <span className="v">{subTotal}</span>
          </div>
          <div className="kv">
            <span className="k">capital auto-place</span>
            <span className="v" style={{ color: "var(--mid)" }}>−{capitalAuto}</span>
          </div>
          <div className="kv">
            <span className="k">to place</span>
            <span className="v neon" style={{ fontWeight: 700 }}>{placeable}</span>
          </div>
        </div>

        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
          Click one of your countries on the map, then deploy.
        </div>
        <div className="subform">
          <div className="row">
            <span className="label" style={{ margin: 0 }}>target</span>
            <code style={{ color: "var(--neon)", fontSize: 10 }}>{selectedCountry?.tag ?? "—"}</code>
          </div>
          <div className="row">
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
              style={{ padding: "4px 10px", fontSize: 10, marginLeft: "auto" }}
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
              Deploy ▸
            </button>
          </div>
        </div>
        {error && <div className="alert">{error}</div>}
      </div>
    );
  }

  // -------- Click-to-target view (attack / move troops) --------
  if (targetMode && selected && state.map) {
    const adjacent = neighborIds(state, selected.countryId);
    const candidates: Country[] = [];
    for (const c of state.map.countries) {
      if (!adjacent.has(c.countryId)) continue;
      const s = stateById.get(c.countryId);
      if (!s) continue;
      if (targetMode === "attack" && s.ownerPlayerId === myPlayer.playerId) continue;
      if (targetMode === "move" && s.ownerPlayerId !== myPlayer.playerId) continue;
      candidates.push(c);
    }
    const sourceTag = countryById.get(selected.countryId)?.tag ?? selected.countryId;
    const maxArmies = Math.max(1, selected.armies - 1); // leave at least 1 behind

    const variantClass = targetMode === "attack" ? "btn-bad" : "btn";
    const verb = targetMode === "attack" ? "Attack" : "Move";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="kv">
          <span className="k">{verb.toLowerCase()} from</span>
          <span className="v neon" style={{ fontWeight: 700, letterSpacing: "0.1em" }}>
            {sourceTag}
          </span>
        </div>
        <div className="kv">
          <span className="k">your armies</span>
          <span className="v">{selected.armies}</span>
        </div>
        <div className="row" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="label" style={{ margin: 0 }}>commit</span>
          <input
            type="range"
            min={1}
            max={maxArmies}
            value={Math.min(armiesToCommit, maxArmies)}
            onChange={(e) => setArmiesToCommit(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={1}
            max={maxArmies}
            className="input"
            style={{ width: 60, padding: "4px 6px" }}
            value={Math.min(armiesToCommit, maxArmies)}
            onChange={(e) => setArmiesToCommit(Number(e.target.value))}
          />
        </div>

        <div className="section-hd">choose target</div>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 10, color: "var(--ink-dim)", fontStyle: "italic" }}>
            {targetMode === "attack"
              ? "No adjacent enemy countries."
              : "No adjacent countries you own."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {candidates.map((c) => {
              const cs = stateById.get(c.countryId);
              const owner = cs?.ownerPlayerId
                ? state.players.find((p) => p.playerId === cs.ownerPlayerId)
                : null;
              return (
                <button
                  key={c.countryId}
                  type="button"
                  className={`target-row ${variantClass}`}
                  onClick={async () => {
                    const armies = Math.min(armiesToCommit, maxArmies);
                    if (targetMode === "attack") {
                      const r = await attack({
                        variables: {
                          gameId: game.gameId,
                          fromCountryId: selected.countryId,
                          toCountryId: c.countryId,
                          armies,
                        },
                      });
                      handle(r.data?.attack);
                    } else {
                      const r = await moveTroops({
                        variables: {
                          gameId: game.gameId,
                          fromCountryId: selected.countryId,
                          toCountryId: c.countryId,
                          armies,
                        },
                      });
                      handle(r.data?.moveTroops);
                    }
                  }}
                >
                  <span className="tg" style={{ borderColor: owner?.color ?? "var(--ink-dim)" }}>
                    {c.tag}
                  </span>
                  <span className="al" style={{ flex: 1, textAlign: "left" }}>
                    <span className="al-name">{c.name}</span>
                    <span className="al-cost">
                      {cs?.armies ?? 0}a · {owner ? `seat ${owner.seatOrder + 1}` : "unclaimed"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 6 }}
          onClick={() => setTargetMode(null)}
        >
          Cancel
        </button>

        {error && <div className="alert">{error}</div>}
      </div>
    );
  }

  // -------- Normal action menu --------
  const selectedCountryRecord = selected ? countryById.get(selected.countryId) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="kv">
        <span className="k">actions</span>
        <span className="v neon" style={{ fontWeight: 600 }}>
          {game.turn.actionsRemaining} / {game.config.actionsPerTurn}
        </span>
      </div>

      {selected && selectedCountryRecord ? (
        <div className="subform" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className="tg"
              style={{ borderColor: "var(--neon)" }}
              aria-hidden
            >
              {selectedCountryRecord.tag}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink)" }}>{selectedCountryRecord.name}</span>
          </div>
          <div className="kv">
            <span className="k">troops</span>
            <span
              className="v neon"
              style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}
            >
              {selected.armies}
            </span>
          </div>
          <div className="kv">
            <span className="k">disease</span>
            <span
              className={`v ${
                (selected.diseaseCubes ?? 0) === 0
                  ? "good"
                  : (selected.diseaseCubes ?? 0) >= 2
                    ? "bad"
                    : "mid"
              }`}
            >
              {selected.diseaseCubes} cube{selected.diseaseCubes === 1 ? "" : "s"}
              {selected.vaccinated ? " · vaccinated" : ""}
            </span>
          </div>
          {selected.isCapitalOf && (
            <div className="kv">
              <span className="k">role</span>
              <span className="v warn">capital</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
          Click a country on the map to pick a target.
        </div>
      )}

      <div className="section-hd">researcher</div>
      <div className="action-grid">
        <ActionTile
          glyph="↦"
          label="Move"
          cost={1}
          hint="Move your researcher to an adjacent country"
          disabled={
            !selected ||
            !myPlayer.researcherCountryId ||
            !adjacentToMyResearcher.has(selected.countryId) ||
            game.turn.actionsRemaining < 1
          }
          onClick={async () => {
            if (!selected) return;
            const r = await moveResearcher({
              variables: { gameId: game.gameId, toCountryId: selected.countryId },
            });
            handle(r.data?.moveResearcher);
          }}
        />
        <ActionTile
          glyph="✈"
          label="Airdrop"
          cost={2}
          hint="Move your researcher to any country on the map"
          disabled={!selected || !myPlayer.researcherCountryId || game.turn.actionsRemaining < 2}
          onClick={async () => {
            if (!selected) return;
            const r = await airdropResearcher({
              variables: { gameId: game.gameId, toCountryId: selected.countryId },
            });
            handle(r.data?.airdropResearcher);
          }}
        />
        <ActionTile
          glyph="✚"
          label="Cure"
          cost={1}
          hint="Remove all disease cubes from the researcher's country"
          variant="good"
          disabled={
            !researcherHere ||
            (myResearcherState?.diseaseCubes ?? 0) === 0 ||
            game.turn.actionsRemaining < 1
          }
          onClick={async () => {
            const r = await cure({ variables: { gameId: game.gameId } });
            handle(r.data?.cure);
          }}
        />
        <ActionTile
          glyph="⚕"
          label="Vaccine"
          cost={1}
          hint="Permanently immunize the researcher's country (all researchers must co-locate)"
          variant="good"
          disabled={!researcherHere || game.turn.actionsRemaining < 1}
          onClick={async () => {
            const r = await createVaccine({ variables: { gameId: game.gameId } });
            handle(r.data?.createVaccine);
          }}
        />
      </div>

      <div className="section-hd">military</div>
      <div className="action-grid">
        <ActionTile
          glyph="⚔"
          label="Attack"
          cost={1}
          hint="Pick an adjacent enemy country to attack"
          variant="bad"
          disabled={!selected || !isMine(selected) || selected.armies < 2 || game.turn.actionsRemaining < 1}
          onClick={() => setTargetMode("attack")}
        />
        <ActionTile
          glyph="⇆"
          label="Move troops"
          cost={1}
          hint="Reinforce an adjacent country you already own"
          disabled={!selected || !isMine(selected) || selected.armies < 2 || game.turn.actionsRemaining < 1}
          onClick={() => setTargetMode("move")}
        />
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "5px 10px", fontSize: 10 }}
          onClick={() => setSelectedCountryId(null)}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: "5px 12px", fontSize: 10 }}
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
