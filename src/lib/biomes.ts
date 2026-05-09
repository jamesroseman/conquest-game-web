import type { Biome } from "@/api/types";
import { TH, TW, type IsoMath, isoPos } from "@/lib/iso";

export interface BiomePalette {
  top: string;
  face1: string;
  face2: string;
  hi: string;
  lo: string;
}

// Iso PAL — top is the diamond fill, hi/lo are the deterministic noise
// sprinkles, face1/face2 are reserved for tiles that draw raised features
// (mountain peaks, snowcaps).
export const PAL: Record<Biome, BiomePalette> = {
  ocean:    { top: "#0a1a30", face1: "#06122a", face2: "#040a1c", hi: "#162a4a", lo: "#04081a" },
  coast:    { top: "#143058", face1: "#0e2240", face2: "#091830", hi: "#234a78", lo: "#0a1a36" },
  beach:    { top: "#7a6840", face1: "#544628", face2: "#3a2f1c", hi: "#9a8456", lo: "#3e3520" },
  grassland:{ top: "#3e6024", face1: "#2a401a", face2: "#1a2810", hi: "#588232", lo: "#243818" },
  forest:   { top: "#214a22", face1: "#163018", face2: "#0e1e10", hi: "#2e6230", lo: "#10220f" },
  jungle:   { top: "#1c5435", face1: "#143824", face2: "#0c2017", hi: "#286b48", lo: "#0e2618" },
  swamp:    { top: "#2e3e26", face1: "#1f2a18", face2: "#141a10", hi: "#42583a", lo: "#1a2412" },
  wetland:  { top: "#34503e", face1: "#22362a", face2: "#152018", hi: "#4a6c58", lo: "#1c2c22" },
  desert:   { top: "#9a8442", face1: "#6e5a2c", face2: "#473820", hi: "#bfa15a", lo: "#594a22" },
  savanna:  { top: "#806c2c", face1: "#564822", face2: "#352c18", hi: "#a48838", lo: "#4e431e" },
  boreal:   { top: "#234d40", face1: "#173228", face2: "#0e1f18", hi: "#306756", lo: "#102218" },
  tundra:   { top: "#5b6262", face1: "#3a4042", face2: "#23272a", hi: "#7a8284", lo: "#34373a" },
  mountain: { top: "#5a5246", face1: "#3a3530", face2: "#23201d", hi: "#7a6e5b", lo: "#252220" },
  snow:     { top: "#c4d4dd", face1: "#8298a4", face2: "#5b6e7a", hi: "#e5edf2", lo: "#6c8090" },
};

export const BIOME_LABEL: Record<Biome, string> = {
  ocean: "open ocean",
  coast: "coastal water",
  beach: "beach",
  grassland: "grassland",
  forest: "temperate forest",
  jungle: "jungle",
  swamp: "swamp",
  wetland: "wetland",
  desert: "desert",
  savanna: "savanna",
  boreal: "boreal forest",
  tundra: "tundra",
  mountain: "mountain",
  snow: "snow peak",
};

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawDiamond(c: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + TW / 2, cy + TH / 2);
  c.lineTo(cx, cy + TH);
  c.lineTo(cx - TW / 2, cy + TH / 2);
  c.closePath();
  c.fill();
}

// Paint a single tile at (x, y). Top diamond + 8 deterministic pixel-art
// sprinkles + a biome-specific motif (peaks for mountains, tufts for
// forests, wave dashes for ocean/coast, etc.).
export function drawIsoTile(
  ctx: CanvasRenderingContext2D,
  iso: IsoMath,
  x: number,
  y: number,
  biome: Biome
): void {
  const p = PAL[biome] ?? PAL.ocean;
  const { cx, cy } = isoPos(iso, x, y, 0);
  drawDiamond(ctx, cx, cy, p.top);

  // Pixel-art noise sprinkles, kept inside the diamond via Manhattan check.
  const r = mulberry32(((x * 73 + y * 1213) ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < 8; i++) {
    const u = r();
    const v = r();
    if (Math.abs(u - 0.5) + Math.abs(v - 0.5) > 0.42) continue;
    const dx = (u - 0.5) * TW;
    const dy = (v - 0.5) * TH;
    ctx.fillStyle = i % 3 === 0 ? p.lo : p.hi;
    ctx.fillRect(Math.round(cx + dx), Math.round(cy + TH / 2 + dy), 2, 2);
  }

  drawBiomeMotif(ctx, cx, cy, biome, p);
}

function drawBiomeMotif(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  biome: Biome,
  p: BiomePalette
): void {
  const x0 = cx;
  const y0 = cy + TH / 2;

  if (biome === "mountain" || biome === "snow") {
    const seed = ((((cx | 0) * 131 + (cy | 0) * 257) ^ 0xb5297a4d) >>> 0);
    const r = mulberry32(seed);
    const twoPeaks = r() < 0.55;
    const peaks: { ox: number; oy: number; scale: number }[] = [];
    if (twoPeaks) {
      peaks.push({ ox: -5 + Math.round(r() * 2), oy: 1, scale: 0.85 + r() * 0.15 });
      peaks.push({ ox: 4 - Math.round(r() * 2), oy: -1, scale: 1.0 + r() * 0.1 });
    } else {
      peaks.push({ ox: Math.round((r() - 0.5) * 3), oy: 0, scale: 1.0 + r() * 0.15 });
    }
    peaks.sort((a, b) => a.oy - b.oy);
    for (const pk of peaks) {
      const baseY = cy + TH / 2 + 1 + pk.oy;
      const peakX = x0 + pk.ox;
      const peakH = Math.round((biome === "snow" ? 14 : 11) * pk.scale);
      const halfW = Math.round(peakH * 0.55);
      const peakY = baseY - peakH;
      // Left dark face.
      ctx.fillStyle = p.face1;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - halfW, baseY);
      ctx.lineTo(peakX, baseY);
      ctx.closePath();
      ctx.fill();
      // Right lit face.
      ctx.fillStyle = p.hi;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX, baseY);
      ctx.lineTo(peakX + halfW, baseY);
      ctx.closePath();
      ctx.fill();
      // Centre seam.
      ctx.fillStyle = p.lo;
      ctx.fillRect(peakX, peakY, 1, peakH);
      // Snow cap (always for snow tiles, smaller for mountains).
      const capRatio = biome === "snow" ? 0.55 : 0.22;
      const capH = Math.max(2, Math.round(peakH * capRatio));
      for (let k = 0; k < capH; k++) {
        const wHalf = Math.max(1, Math.ceil(((k + 1) * halfW) / peakH));
        ctx.fillStyle = "#f3f7fa";
        ctx.fillRect(peakX, peakY + k, wHalf + 1, 1);
        ctx.fillStyle = "#c9d3dc";
        ctx.fillRect(peakX - wHalf, peakY + k, wHalf, 1);
      }
    }
  } else if (biome === "forest" || biome === "jungle" || biome === "boreal") {
    ctx.fillStyle = p.lo;
    ctx.fillRect(x0 - 8, y0 - 3, 2, 4);
    ctx.fillRect(x0 + 4, y0 - 2, 2, 4);
    ctx.fillRect(x0 - 2, y0 + 1, 2, 4);
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 8, y0 - 4, 2, 1);
    ctx.fillRect(x0 + 4, y0 - 3, 2, 1);
    ctx.fillRect(x0 - 2, y0, 2, 1);
    if (biome === "jungle") {
      ctx.fillStyle = p.hi;
      ctx.fillRect(x0 - 12, y0 + 1, 2, 1);
      ctx.fillRect(x0 + 8, y0 + 2, 2, 1);
    }
  } else if (biome === "desert" || biome === "savanna") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 9, y0 + 1, 6, 1);
    ctx.fillRect(x0 + 1, y0 + 4, 7, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(x0 - 3, y0 - 2, 1, 1);
  } else if (biome === "ocean" || biome === "coast") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 9, y0 - 1, 4, 1);
    ctx.fillRect(x0 + 3, y0 + 3, 4, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(x0 - 1, y0 + 1, 3, 1);
  } else if (biome === "swamp" || biome === "wetland") {
    ctx.fillStyle = p.lo;
    ctx.fillRect(x0 - 7, y0, 5, 2);
    ctx.fillRect(x0 + 3, y0 + 3, 5, 2);
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 6, y0, 2, 1);
    ctx.fillRect(x0 + 4, y0 + 3, 2, 1);
  } else if (biome === "grassland") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 8, y0 - 2, 1, 2);
    ctx.fillRect(x0 - 3, y0 + 2, 1, 2);
    ctx.fillRect(x0 + 5, y0 - 1, 1, 2);
    ctx.fillRect(x0 + 9, y0 + 3, 1, 2);
  } else if (biome === "tundra") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 6, y0 - 2, 2, 1);
    ctx.fillRect(x0 + 4, y0 + 2, 2, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(x0, y0 + 1, 1, 1);
  } else if (biome === "beach") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(x0 - 7, y0 - 2, 2, 1);
    ctx.fillRect(x0 + 1, y0 + 2, 2, 1);
    ctx.fillRect(x0 + 6, y0 - 1, 2, 1);
  }
}
