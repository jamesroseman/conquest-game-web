import type { GameEvent, GameStateView } from "@/api/types";

interface Props {
  state: GameStateView;
  events: GameEvent[];
}

interface CasualtyRow {
  countryTag: string;
  cubes: number;
  armiesLost: number;
  ownerColor: string | null;
}

interface SpreadRow {
  countryTag: string;
  triggeredOutbreak: boolean;
}

interface OutbreakRow {
  originTag: string;
  chainedTags: string[];
}

// Replaces the action panel during virus phase playback. Lists every
// affected country tag so the player sees what's happening as the
// MapView animates the matching "-N" / "+1" floats above each country.
export function DiseasePanel({ state, events }: Props): JSX.Element {
  const tags = new Map<string, string>();
  if (state.map) for (const c of state.map.countries) tags.set(c.countryId, c.tag);
  const playerColor = new Map<string, string>();
  for (const p of state.players) playerColor.set(p.playerId, p.color);
  const ownerByCountry = new Map<string, string | null>();
  for (const s of state.countryStates) ownerByCountry.set(s.countryId, s.ownerPlayerId);

  const tag = (cid: unknown): string => {
    if (typeof cid !== "string") return "—";
    return tags.get(cid) ?? cid;
  };
  const ownerColorFor = (cid: unknown): string | null => {
    if (typeof cid !== "string") return null;
    const ownerId = ownerByCountry.get(cid) ?? null;
    if (!ownerId) return null;
    return playerColor.get(ownerId) ?? null;
  };

  const casualties: CasualtyRow[] = [];
  const placements: SpreadRow[] = [];
  const outbreaks: OutbreakRow[] = [];
  for (const ev of events) {
    let payload: Record<string, unknown> = {};
    try {
      const v = JSON.parse(ev.payloadJson);
      if (v && typeof v === "object") payload = v as Record<string, unknown>;
    } catch {
      // ignore malformed payloads
    }
    const cas = Array.isArray(payload.casualties) ? payload.casualties : [];
    for (const c of cas) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const lost = typeof obj.armies_lost === "number" ? obj.armies_lost : 0;
      if (lost <= 0) continue;
      casualties.push({
        countryTag: tag(obj.country_id),
        cubes: typeof obj.cubes === "number" ? obj.cubes : 0,
        armiesLost: lost,
        ownerColor: ownerColorFor(obj.country_id),
      });
    }
    const pl = Array.isArray(payload.placements) ? payload.placements : [];
    for (const p of pl) {
      if (!p || typeof p !== "object") continue;
      const obj = p as Record<string, unknown>;
      placements.push({
        countryTag: tag(obj.country_id),
        triggeredOutbreak: obj.triggered_outbreak === true,
      });
    }
    const ob = Array.isArray(payload.outbreaks) ? payload.outbreaks : [];
    for (const o of ob) {
      if (!o || typeof o !== "object") continue;
      const obj = o as Record<string, unknown>;
      const chained = Array.isArray(obj.chained_country_ids) ? obj.chained_country_ids : [];
      outbreaks.push({
        originTag: tag(obj.origin_country_id),
        chainedTags: chained.map((c) => tag(c)),
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="kv">
        <span className="k">virus phase</span>
        <span className="v bad" style={{ fontWeight: 700, letterSpacing: "0.18em" }}>
          ACTIVE
        </span>
      </div>

      {casualties.length > 0 && (
        <>
          <div className="section-hd">army casualties</div>
          <ul className="dlist">
            {casualties.map((c, i) => (
              <li key={`cas-${i}`} className="drow">
                <span className="tg" style={{ borderColor: c.ownerColor ?? "var(--ink-dim)" }}>
                  {c.countryTag}
                </span>
                <span className="dnote">
                  <span className="dlost" style={{ color: c.ownerColor ?? "var(--ink)" }}>
                    -{c.armiesLost}
                  </span>{" "}
                  ({c.cubes} cube{c.cubes === 1 ? "" : "s"})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {placements.length > 0 && (
        <>
          <div className="section-hd">cube spread</div>
          <ul className="dlist">
            {placements.map((p, i) => (
              <li key={`pl-${i}`} className="drow">
                <span className="tg">{p.countryTag}</span>
                <span className="dnote">
                  <span className="dgain">+1</span>
                  {p.triggeredOutbreak ? (
                    <span className="dlost" style={{ marginLeft: 6 }}>outbreak!</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {outbreaks.length > 0 && (
        <>
          <div className="section-hd">outbreak chains</div>
          <ul className="dlist">
            {outbreaks.map((o, i) => (
              <li key={`ob-${i}`} className="drow">
                <span className="tg">{o.originTag}</span>
                <span className="dnote" style={{ color: "var(--bad)" }}>
                  → {o.chainedTags.join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ fontSize: 10, color: "var(--ink-dim)", fontStyle: "italic" }}>
        Watch the map — spread plays out one country at a time.
      </div>
    </div>
  );
}
