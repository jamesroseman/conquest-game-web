import { useEffect, useMemo, useRef, useState } from "react";
import type { GameEvent, GameStateView } from "@/api/types";

interface Props {
  state: GameStateView;
}

// Live append-only event log. Replaces the country inspector on the right
// rail so the human can SEE the bots playing turn by turn.
//
// Behaviour:
//   - Collapsed by default after the first new event lands; click the
//     header to expand/collapse.
//   - When expanded, the most recent ~5 events are visible; older events
//     scroll into view.
//   - Auto-scrolls to the newest event whenever a new sequence comes in.
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 56; // approximate; drives the scroll viewport size

export function EventLog({ state }: Props): JSX.Element {
  const { players, recentEvents } = state;

  const playerLookup = useMemo(() => {
    const m = new Map<string, { seat: number; color: string; kind: string }>();
    for (const p of players) m.set(p.playerId, { seat: p.seatOrder + 1, color: p.color, kind: p.kind });
    return m;
  }, [players]);

  const countryTagById = useMemo(() => {
    const m = new Map<string, string>();
    if (state.map) for (const c of state.map.countries) m.set(c.countryId, c.tag);
    return m;
  }, [state.map]);

  const formatted = useMemo(
    () => recentEvents.flatMap((e) => formatEvent(e, playerLookup, countryTagById)),
    [recentEvents, playerLookup, countryTagById]
  );

  // Auto-scroll to the bottom whenever a new event lands. Without this the
  // human would have to manually drag the scroll bar after every AI turn.
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeqRef = useRef<number>(-1);
  useEffect(() => {
    const last = recentEvents[recentEvents.length - 1];
    if (!last) return;
    if (last.sequence === lastSeqRef.current) return;
    lastSeqRef.current = last.sequence;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [recentEvents]);

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="panel panel-fixed"
      style={{ top: 60, right: 14, width: 280 }}
    >
      <div
        className="hd"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        aria-label="Toggle event log"
      >
        event log
        <span className="right">
          R{state.game.turn.roundNumber} · T{state.game.turn.turnNumber}
          <span style={{ marginLeft: 8, opacity: 0.7 }}>{collapsed ? "▸" : "▾"}</span>
        </span>
      </div>
      {!collapsed && (
        <div
          className="bd"
          ref={scrollRef}
          style={{
            maxHeight: VISIBLE_ROWS * ROW_HEIGHT,
            overflowY: "auto",
            padding: 0,
          }}
        >
          {formatted.length === 0 ? (
            <div className="bd dim" style={{ padding: "12px 10px" }}>
              Game just started — events will appear here as players act.
            </div>
          ) : (
            <ul className="evlog">
              {formatted.map((row) => (
                <li
                  key={row.rowId}
                  className={`evrow evrow-${row.kind}`}
                  style={row.color ? { borderLeftColor: row.color } : undefined}
                >
                  <span className="ev-meta">
                    <span className="ev-seq">#{row.event.sequence}</span>
                    {row.actorLabel && (
                      <span className="ev-actor" style={{ color: row.color ?? "var(--ink-dim)" }}>
                        {row.actorLabel}
                      </span>
                    )}
                  </span>
                  <span className="ev-text">{row.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface FormattedEvent {
  rowId: string;
  event: GameEvent;
  text: string;
  actorLabel: string | null;
  color: string | null;
  kind: "good" | "bad" | "neutral" | "system";
}

function formatEvent(
  e: GameEvent,
  players: Map<string, { seat: number; color: string; kind: string }>,
  tags: Map<string, string>
): FormattedEvent[] {
  const actor = e.actorPlayerId ? players.get(e.actorPlayerId) ?? null : null;
  const actorLabel = actor
    ? `seat ${actor.seat}${actor.kind === "ai" ? " · AI" : ""}`
    : null;
  const color = actor?.color ?? null;
  const payload = safeParse(e.payloadJson);
  const tag = (cid: unknown): string => {
    if (typeof cid !== "string" || !cid) return "—";
    return tags.get(cid) ?? cid;
  };
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

  // Wrap a single-row event so callers always return an array.
  const one = (
    text: string,
    kind: FormattedEvent["kind"],
    opts: { actorLabel?: string | null; color?: string | null; rowId?: string } = {}
  ): FormattedEvent[] => [
    {
      rowId: opts.rowId ?? e.eventId,
      event: e,
      text,
      actorLabel: opts.actorLabel ?? null,
      color: opts.color ?? null,
      kind,
    },
  ];

  switch (e.type) {
    case "game_started":
      return one("Game started — map forged, setup begins.", "system");
    case "turn_started": {
      const round = num(payload.round);
      return one(
        round != null ? `Started turn (round ${round}).` : "Started turn.",
        "neutral",
        { actorLabel, color }
      );
    }
    case "turn_ended":
      return one("Ended turn.", "neutral", { actorLabel, color });
    case "place_troop":
      return one(`Placed a troop on ${tag(payload.country_id)}.`, "neutral", {
        actorLabel,
        color,
      });
    case "place_researcher":
      return one(`Placed researcher on ${tag(payload.country_id)}.`, "neutral", {
        actorLabel,
        color,
      });
    case "place_capital":
      return one(`Placed capital on ${tag(payload.country_id)}.`, "neutral", {
        actorLabel,
        color,
      });
    case "seed_disease": {
      const n = Array.isArray(payload.countries) ? payload.countries.length : 0;
      return one(`Disease seeded across ${n} countries.`, "bad");
    }
    case "place_reinforcements": {
      const placements = payload.placements;
      let summary = "Reinforcements placed.";
      if (Array.isArray(placements)) {
        const parts = placements.slice(0, 3).map((p: unknown) => {
          if (Array.isArray(p) && p.length >= 2) return `${p[1]}→${tag(p[0])}`;
          if (p && typeof p === "object") {
            const obj = p as Record<string, unknown>;
            const count = num(obj.count);
            const cid = obj.country_id ?? obj.countryId;
            return `${count ?? "?"}→${tag(cid)}`;
          }
          return "";
        });
        const more = placements.length - 3;
        summary = `Reinforced: ${parts.filter(Boolean).join(", ")}${more > 0 ? ` +${more} more` : ""}.`;
      }
      return one(summary, "good", { actorLabel, color });
    }
    case "move_researcher_adjacent":
      return one(`Moved researcher to ${tag(payload.to_country_id)}.`, "neutral", {
        actorLabel,
        color,
      });
    case "airdrop_researcher":
      return one(`Airdropped researcher to ${tag(payload.to_country_id)}.`, "neutral", {
        actorLabel,
        color,
      });
    case "cure":
      return one("Cured the researcher's country.", "good", { actorLabel, color });
    case "create_vaccine":
      return one("Manufactured a vaccine.", "good", { actorLabel, color });
    case "attack": {
      const from = tag(payload.from_country_id);
      const to = tag(payload.to_country_id);
      const armies = num(payload.armies);
      const captured = !!payload.captured;
      const note = captured ? " — captured!" : "";
      return one(
        `Attacked ${to} from ${from} with ${armies ?? "?"} armies${note}`,
        captured ? "good" : "bad",
        { actorLabel, color }
      );
    }
    case "move_troops":
      return one(
        `Moved ${num(payload.armies) ?? "?"} armies from ${tag(payload.from_country_id)} to ${tag(payload.to_country_id)}.`,
        "neutral",
        { actorLabel, color }
      );
    case "round_end_virus": {
      // Expand into a header line + one row per disease casualty + one
      // row per placement / outbreak so the player can see exactly what
      // the virus did this round (matching the floating "-X" / "+1"
      // animations on the map).
      const placements = Array.isArray(payload.placements) ? payload.placements : [];
      const casualties = Array.isArray(payload.casualties) ? payload.casualties : [];
      const outbreaks = Array.isArray(payload.outbreaks) ? payload.outbreaks : [];
      const cubes = placements.length;
      const outbreakCount = outbreaks.length;

      const rows: FormattedEvent[] = [];
      rows.push({
        rowId: `${e.eventId}:hd`,
        event: e,
        text:
          outbreakCount > 0
            ? `End of round — virus phase: ${cubes} cube${cubes === 1 ? "" : "s"} spread, ${outbreakCount} outbreak${outbreakCount === 1 ? "" : "s"}.`
            : `End of round — virus phase: ${cubes} cube${cubes === 1 ? "" : "s"} spread.`,
        actorLabel: null,
        color: null,
        kind: "bad",
      });
      casualties.forEach((c: unknown, i: number) => {
        if (!c || typeof c !== "object") return;
        const obj = c as Record<string, unknown>;
        const cid = typeof obj.country_id === "string" ? obj.country_id : null;
        const lost = num(obj.armies_lost) ?? 0;
        if (!cid || lost <= 0) return;
        rows.push({
          rowId: `${e.eventId}:cas:${i}`,
          event: e,
          text: `${tag(cid)} lost ${lost} troop${lost === 1 ? "" : "s"} to disease.`,
          actorLabel: null,
          color: null,
          kind: "bad",
        });
      });
      outbreaks.forEach((o: unknown, i: number) => {
        if (!o || typeof o !== "object") return;
        const obj = o as Record<string, unknown>;
        const origin = typeof obj.origin_country_id === "string" ? obj.origin_country_id : null;
        const chained = Array.isArray(obj.chained_country_ids) ? obj.chained_country_ids : [];
        if (origin) {
          rows.push({
            rowId: `${e.eventId}:obo:${i}`,
            event: e,
            text:
              chained.length > 0
                ? `Outbreak in ${tag(origin)} (chained to ${chained.length} neighbour${chained.length === 1 ? "" : "s"}).`
                : `Outbreak in ${tag(origin)}.`,
            actorLabel: null,
            color: null,
            kind: "bad",
          });
        }
      });
      return rows;
    }
    case "outbreak":
      return one(`Outbreak in ${tag(payload.country_id)}!`, "bad");
    case "player_eliminated": {
      const target = e.actorPlayerId ? players.get(e.actorPlayerId) : null;
      const byId = str(payload.by_player_id);
      const eliminator = byId ? players.get(byId) : null;
      return one(
        `Seat ${target?.seat ?? "?"} eliminated${eliminator ? ` by seat ${eliminator.seat}` : ""}.`,
        "bad"
      );
    }
    case "capital_conquered":
      return one(`Capital ${tag(payload.country_id)} conquered!`, "bad", {
        actorLabel,
        color,
      });
    case "game_ended": {
      const winnerId = str(payload.winner);
      const winner = winnerId ? players.get(winnerId) : null;
      const reason = str(payload.reason) ?? "unknown";
      return one(
        winner ? `Game ended — seat ${winner.seat} wins.` : `Game ended (${reason}).`,
        "system"
      );
    }
    default:
      return one(e.type, "neutral", { actorLabel, color });
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
