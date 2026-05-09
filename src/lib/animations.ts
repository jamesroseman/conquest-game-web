// Floating-number animation queue. The GameScreen feeds it event records
// from `recentEvents`; MapView pulls active animations each frame and
// draws "-X" / "+X" sprites above the country centroid.

import type { GameEvent } from "@/api/types";

export interface FloatingNumber {
  id: string; // unique per spawn — `${eventId}:${index}`
  countryId: string;
  amount: number; // signed: + green, - in `color`
  color: string;
  label: string; // "-6", "+1", "outbreak!"
  startAt: number; // performance.now() at which to begin
  duration: number; // ms
}

export interface AnimationDirective {
  spawns: FloatingNumber[];
  // True for events that block the action panel — currently any virus
  // event still in flight swaps the action panel for a DiseasePanel.
  diseasePlayback: { until: number; events: GameEvent[] } | null;
}

// ms between attacker/defender damage floats per combat round. Slow enough
// that each pair of "-X / -Y" sprites can be read individually.
const ATTACK_ROUND_INTERVAL_MS = 1100;
const VIRUS_STEP_INTERVAL_MS = 1000; // 1s between countries during virus
const FLOAT_DURATION_MS = 1100;

interface ParseContext {
  playerColor: (id: string | null | undefined) => string;
  // The wire-format payload is JSON-encoded; we decode once per event.
}

function parsePayload(p: string): Record<string, unknown> {
  try {
    const v = JSON.parse(p);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const NUM = (v: unknown): number | null => (typeof v === "number" ? v : null);
const STR = (v: unknown): string | null => (typeof v === "string" ? v : null);
const BOOL = (v: unknown): boolean => v === true;

// Build a directive from the events that haven't been animated yet. Caller
// passes `lastSeenSequence`; we return spawns plus an updated cursor.
export function buildAnimationDirective(
  events: GameEvent[],
  lastSeenSequence: number,
  now: number,
  ctx: ParseContext
): { directive: AnimationDirective; nextSeq: number } {
  const spawns: FloatingNumber[] = [];
  let virusUntil = 0;
  const virusEvents: GameEvent[] = [];

  let nextSeq = lastSeenSequence;
  // Stagger sequential events from the same poll batch so animations don't
  // pile up on the same frame.
  let cursor = now;

  for (const e of events) {
    if (e.sequence <= lastSeenSequence) continue;
    nextSeq = Math.max(nextSeq, e.sequence);
    const p = parsePayload(e.payloadJson);

    if (e.type === "place_troop") {
      // Setup-phase placement. The action payload only carries
      // `country_id`; the count is fixed at 2 (TROOPS_PER_PLACEMENT)
      // server-side. Floats "+2" in the actor's player colour over the
      // claimed/reinforced country.
      const cid = STR(p.country_id);
      const actor = STR(e.actorPlayerId);
      if (cid && actor) {
        spawns.push({
          id: `${e.eventId}:troop`,
          countryId: cid,
          amount: 2,
          color: ctx.playerColor(actor),
          label: "+2",
          startAt: cursor,
          duration: FLOAT_DURATION_MS,
        });
        cursor += 250;
      }
    } else if (e.type === "place_reinforcements") {
      // Each placement entry carries either [countryId, count] tuples or
      // {country_id, count} dicts. Every placement gets its own +N float
      // staggered by 250ms so a multi-country deploy reads as a sequence.
      const placements = Array.isArray(p.placements) ? p.placements : [];
      const actor = STR(e.actorPlayerId);
      const color = ctx.playerColor(actor);
      let t = cursor;
      placements.forEach((placement: unknown, i: number) => {
        let cid: string | null = null;
        let count: number | null = null;
        if (Array.isArray(placement) && placement.length >= 2) {
          cid = typeof placement[0] === "string" ? placement[0] : null;
          count = typeof placement[1] === "number" ? placement[1] : null;
        } else if (placement && typeof placement === "object") {
          const obj = placement as Record<string, unknown>;
          cid = STR(obj.country_id ?? obj.countryId);
          count = NUM(obj.count);
        }
        if (cid && count != null && count > 0) {
          spawns.push({
            id: `${e.eventId}:rein:${i}`,
            countryId: cid,
            amount: count,
            color,
            label: `+${count}`,
            startAt: t,
            duration: FLOAT_DURATION_MS,
          });
          t += 250;
        }
      });
      cursor = t;
    } else if (e.type === "attack") {
      const fromId = STR(p.from_country_id);
      const toId = STR(p.to_country_id);
      const attackerOwner = STR(p.attacker_owner_id);
      const defenderOwner = STR(p.defender_owner_id);
      const rounds = Array.isArray(p.rounds) ? p.rounds : [];
      let t = cursor;
      rounds.forEach((r: unknown, i: number) => {
        if (!r || typeof r !== "object") return;
        const obj = r as Record<string, unknown>;
        const aLoss = NUM(obj.attacker_losses) ?? 0;
        const dLoss = NUM(obj.defender_losses) ?? 0;
        if (aLoss > 0 && fromId) {
          spawns.push({
            id: `${e.eventId}:a:${i}`,
            countryId: fromId,
            amount: -aLoss,
            color: ctx.playerColor(attackerOwner),
            label: `-${aLoss}`,
            startAt: t,
            duration: FLOAT_DURATION_MS,
          });
        }
        if (dLoss > 0 && toId) {
          spawns.push({
            id: `${e.eventId}:d:${i}`,
            countryId: toId,
            amount: -dLoss,
            color: ctx.playerColor(defenderOwner),
            label: `-${dLoss}`,
            startAt: t,
            duration: FLOAT_DURATION_MS,
          });
        }
        t += ATTACK_ROUND_INTERVAL_MS;
      });
      // If captured, finish with a flag-flip note over the target.
      if (BOOL(p.captured) && toId) {
        spawns.push({
          id: `${e.eventId}:cap`,
          countryId: toId,
          amount: 0,
          color: ctx.playerColor(attackerOwner),
          label: "captured",
          startAt: t,
          duration: FLOAT_DURATION_MS + 400,
        });
        t += ATTACK_ROUND_INTERVAL_MS;
      }
      cursor = t;
    } else if (e.type === "round_end_virus") {
      // Country-by-country playback at 1s intervals. Casualties first
      // (troops dying from disease), then cube spread, then outbreaks
      // (each outbreak amplifies the cube colour to red).
      virusEvents.push(e);
      const casualties = Array.isArray(p.casualties) ? p.casualties : [];
      const placements = Array.isArray(p.placements) ? p.placements : [];
      const outbreaks = Array.isArray(p.outbreaks) ? p.outbreaks : [];
      let t = cursor;
      casualties.forEach((c: unknown, i: number) => {
        if (!c || typeof c !== "object") return;
        const obj = c as Record<string, unknown>;
        const cid = STR(obj.country_id);
        const lost = NUM(obj.armies_lost) ?? 0;
        if (cid && lost > 0) {
          spawns.push({
            id: `${e.eventId}:cas:${i}`,
            countryId: cid,
            amount: -lost,
            // Casualties from disease are army losses; colour them in the
            // country owner's player colour so the player sees their own
            // forces dying. The owner we look up by lookup at render time
            // (the caller resolves it).
            color: "owner",
            label: `-${lost}`,
            startAt: t,
            duration: FLOAT_DURATION_MS,
          });
          t += VIRUS_STEP_INTERVAL_MS;
        }
      });
      placements.forEach((pl: unknown, i: number) => {
        if (!pl || typeof pl !== "object") return;
        const obj = pl as Record<string, unknown>;
        const cid = STR(obj.country_id);
        const triggered = BOOL(obj.triggered_outbreak);
        if (cid) {
          spawns.push({
            id: `${e.eventId}:cube:${i}`,
            countryId: cid,
            amount: 1,
            color: "#9be15d",
            label: triggered ? "outbreak!" : "+1",
            startAt: t,
            duration: triggered ? FLOAT_DURATION_MS + 400 : FLOAT_DURATION_MS,
          });
          t += VIRUS_STEP_INTERVAL_MS;
        }
      });
      outbreaks.forEach((o: unknown, i: number) => {
        if (!o || typeof o !== "object") return;
        const obj = o as Record<string, unknown>;
        const origin = STR(obj.origin_country_id);
        const chained = Array.isArray(obj.chained_country_ids) ? obj.chained_country_ids : [];
        if (origin) {
          spawns.push({
            id: `${e.eventId}:outb:${i}`,
            countryId: origin,
            amount: 0,
            color: "#e85b3a",
            label: "outbreak!",
            startAt: t,
            duration: FLOAT_DURATION_MS + 400,
          });
          t += VIRUS_STEP_INTERVAL_MS;
        }
        chained.forEach((cid: unknown, j: number) => {
          const id = STR(cid);
          if (!id) return;
          spawns.push({
            id: `${e.eventId}:outb:${i}:c:${j}`,
            countryId: id,
            amount: 1,
            color: "#e85b3a",
            label: "+1",
            startAt: t,
            duration: FLOAT_DURATION_MS,
          });
          t += VIRUS_STEP_INTERVAL_MS;
        });
      });
      virusUntil = Math.max(virusUntil, t);
      cursor = t;
    }
  }

  return {
    directive: {
      spawns,
      diseasePlayback:
        virusEvents.length > 0 ? { until: virusUntil, events: virusEvents } : null,
    },
    nextSeq,
  };
}
