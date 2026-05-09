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
    () => recentEvents.map((e) => formatEvent(e, playerLookup, countryTagById)),
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
                  key={row.event.eventId}
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
): FormattedEvent {
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

  switch (e.type) {
    case "game_started":
      return {
        event: e,
        text: "Game started — map forged, setup begins.",
        actorLabel: null,
        color: null,
        kind: "system",
      };
    case "turn_started": {
      const round = num(payload.round);
      return {
        event: e,
        text: round != null ? `Started turn (round ${round}).` : "Started turn.",
        actorLabel,
        color,
        kind: "neutral",
      };
    }
    case "turn_ended":
      return {
        event: e,
        text: "Ended turn.",
        actorLabel,
        color,
        kind: "neutral",
      };
    case "place_troop":
      return {
        event: e,
        text: `Placed a troop on ${tag(payload.country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "place_researcher":
      return {
        event: e,
        text: `Placed researcher on ${tag(payload.country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "place_capital":
      return {
        event: e,
        text: `Placed capital on ${tag(payload.country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "seed_disease": {
      const n = Array.isArray(payload.countries) ? payload.countries.length : 0;
      return {
        event: e,
        text: `Disease seeded across ${n} countries.`,
        actorLabel: null,
        color: null,
        kind: "bad",
      };
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
      return { event: e, text: summary, actorLabel, color, kind: "good" };
    }
    case "move_researcher_adjacent":
      return {
        event: e,
        text: `Moved researcher to ${tag(payload.to_country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "airdrop_researcher":
      return {
        event: e,
        text: `Airdropped researcher to ${tag(payload.to_country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "cure":
      return {
        event: e,
        text: "Cured the researcher's country.",
        actorLabel,
        color,
        kind: "good",
      };
    case "create_vaccine":
      return {
        event: e,
        text: "Manufactured a vaccine.",
        actorLabel,
        color,
        kind: "good",
      };
    case "attack": {
      const from = tag(payload.from_country_id);
      const to = tag(payload.to_country_id);
      const armies = num(payload.armies);
      const captured = !!payload.captured;
      const note = captured ? " — captured!" : "";
      return {
        event: e,
        text: `Attacked ${to} from ${from} with ${armies ?? "?"} armies${note}`,
        actorLabel,
        color,
        kind: captured ? "good" : "bad",
      };
    }
    case "move_troops":
      return {
        event: e,
        text: `Moved ${num(payload.armies) ?? "?"} armies from ${tag(payload.from_country_id)} to ${tag(payload.to_country_id)}.`,
        actorLabel,
        color,
        kind: "neutral",
      };
    case "round_end_virus": {
      const cubes = num(payload.cubes_placed) ?? num(payload.spread) ?? null;
      const outbreaks = num(payload.outbreaks) ?? 0;
      const cubesText = cubes != null ? `${cubes}` : "?";
      return {
        event: e,
        text:
          outbreaks > 0
            ? `End of round — virus phase: ${cubesText} cubes spread, ${outbreaks} outbreak${outbreaks === 1 ? "" : "s"}.`
            : `End of round — virus phase: ${cubesText} cubes spread.`,
        actorLabel: null,
        color: null,
        kind: "bad",
      };
    }
    case "outbreak":
      return {
        event: e,
        text: `Outbreak in ${tag(payload.country_id)}!`,
        actorLabel: null,
        color: null,
        kind: "bad",
      };
    case "player_eliminated": {
      const target = e.actorPlayerId ? players.get(e.actorPlayerId) : null;
      const byId = str(payload.by_player_id);
      const eliminator = byId ? players.get(byId) : null;
      return {
        event: e,
        text: `Seat ${target?.seat ?? "?"} eliminated${eliminator ? ` by seat ${eliminator.seat}` : ""}.`,
        actorLabel: null,
        color: null,
        kind: "bad",
      };
    }
    case "capital_conquered":
      return {
        event: e,
        text: `Capital ${tag(payload.country_id)} conquered!`,
        actorLabel,
        color,
        kind: "bad",
      };
    case "game_ended": {
      const winnerId = str(payload.winner);
      const winner = winnerId ? players.get(winnerId) : null;
      const reason = str(payload.reason) ?? "unknown";
      return {
        event: e,
        text: winner ? `Game ended — seat ${winner.seat} wins.` : `Game ended (${reason}).`,
        actorLabel: null,
        color: null,
        kind: "system",
      };
    }
    default:
      return {
        event: e,
        text: e.type,
        actorLabel,
        color,
        kind: "neutral",
      };
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
