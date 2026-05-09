import type { ConquestMap, Tile } from "@/api/types";
import { TH, TW, type IsoMath, forEachIsoTile, isoPos } from "@/lib/iso";

// Animated overlays drawn each frame on top of the static base layer:
// drifting wave dashes on ocean, fish circling on coast, sparse crabs
// scuttling on beach, sheep walking on grassland, seagulls flying over
// any coast/beach tile. All motion is deterministic per-tile so the
// critters don't shimmer randomly between frames.

function tileSeed(x: number, y: number): number {
  return ((x * 73 + y * 311) ^ 0xa5f0a5f0) >>> 0;
}
function tileRand(x: number, y: number): number {
  const s = tileSeed(x, y);
  return ((s * 9301 + 49297) % 233280) / 233280;
}

export function drawAnimatedMotifs(
  ctx: CanvasRenderingContext2D,
  _map: ConquestMap,
  iso: IsoMath,
  tilesByXY: (Tile | null)[][],
  now: number
): void {
  // Painter order keeps closer critters drawn over more distant ones.
  forEachIsoTile(iso, (x, y) => {
    const t = tilesByXY[x][y];
    if (!t) return;
    const b = t.biome;
    if (
      b !== "ocean" &&
      b !== "coast" &&
      b !== "beach" &&
      b !== "grassland"
    )
      return;
    const { cx, cy } = isoPos(iso, x, y, 0);
    const x0 = cx;
    const y0 = cy + TH / 2;
    const r = tileRand(x, y);

    if (b === "ocean") {
      // Drifting wave dashes.
      const ph = ((now / 2400 + r) % 1);
      const wx = (ph - 0.5) * TW * 0.7;
      ctx.fillStyle = "rgba(90,140,180,0.32)";
      ctx.fillRect(Math.round(x0 + wx) - 2, Math.round(y0) - 1, 4, 1);
      ctx.fillStyle = "rgba(140,180,210,0.30)";
      ctx.fillRect(Math.round(x0 + wx) - 1, Math.round(y0) - 2, 2, 1);
    } else if (b === "coast") {
      // Tiny fish circling — only ~15% of coastal tiles, so motion is
      // incidental rather than blanketing the shore.
      if (r >= 0.85) {
        const f = ((now / 2600 + r * 6.28) % 1);
        const ang = f * Math.PI * 2;
        const fx = Math.cos(ang) * TW * 0.22;
        const fy = Math.sin(ang) * TH * 0.18;
        ctx.fillStyle = "#a8d8ec";
        ctx.fillRect(Math.round(x0 + fx) - 1, Math.round(y0 + fy), 2, 1);
        ctx.fillStyle = "rgba(40,70,100,0.85)";
        ctx.fillRect(Math.round(x0 + fx) + 1, Math.round(y0 + fy), 1, 1);
      }
      // Sparse seagull above the surf.
      if (r > 0.92) drawSeagull(ctx, x0, y0, r, now);
    } else if (b === "beach") {
      // Crabs scuttle in a tight oval pattern.
      if (r >= 0.55) {
        const f = ((now / 4500 + r * 4.0) % 1);
        const cxx = Math.round(x0 + Math.sin(f * Math.PI * 2) * 7);
        const cyy = Math.round(y0 + Math.cos(f * Math.PI * 4) * 1);
        ctx.fillStyle = "#c25a30";
        ctx.fillRect(cxx, cyy, 2, 1);
        ctx.fillStyle = "#7a2d18";
        ctx.fillRect(cxx - 1, cyy + 1, 1, 1);
        ctx.fillRect(cxx + 2, cyy + 1, 1, 1);
      }
      // Seagulls hang out over beaches more than over open water.
      if (r > 0.7) drawSeagull(ctx, x0, y0, r, now);
    } else if (b === "grassland") {
      // 1–2 sheep on a slow random walk.
      if (r >= 0.4) {
        const count = 1 + (Math.floor(r * 10000) % 2);
        for (let i = 0; i < count; i++) {
          const ph = ((now / 7000 + r * 5.7 + i * 0.41) % 1);
          const ang = ph * Math.PI * 2;
          const sx = Math.round(x0 + Math.cos(ang) * 6 + (i - 0.5) * 5);
          const sy = Math.round(y0 + Math.sin(ang * 1.3) * 2 + 1);
          const bob = Math.round(Math.sin(ph * Math.PI * 8 + i) * 0.5);
          ctx.fillStyle = "#f1ece0";
          ctx.fillRect(sx, sy - bob, 3, 2);
          ctx.fillStyle = "#2c2520";
          ctx.fillRect(sx + (Math.cos(ang) > 0 ? 3 : -1), sy - bob, 1, 1);
        }
      }
    }
  });
}

// Tiny seagull — three-pixel "M" silhouette that drifts laterally above
// the tile, with a slow vertical bob.
function drawSeagull(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  r: number,
  now: number
): void {
  const ph = ((now / 4200 + r * 3.7) % 1);
  const drift = (ph - 0.5) * TW * 0.6;
  const bob = Math.sin(ph * Math.PI * 4) * 1.2;
  const sx = Math.round(x0 + drift);
  const sy = Math.round(y0 - 14 + bob);
  ctx.fillStyle = "rgba(248,250,252,0.92)";
  // Wings: M shape (small).
  ctx.fillRect(sx - 2, sy + 1, 1, 1);
  ctx.fillRect(sx - 1, sy, 1, 1);
  ctx.fillRect(sx, sy + 1, 1, 1);
  ctx.fillRect(sx + 1, sy, 1, 1);
  ctx.fillRect(sx + 2, sy + 1, 1, 1);
}
