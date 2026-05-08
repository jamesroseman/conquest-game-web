import type { Biome } from "@/api/types";

export const TILE_PX = 14;
const PSIZE = 2;

export interface BiomePalette {
  base: string;
  hi: string;
  lo: string;
  tex: string;
  edge: string;
}

// Palette ported verbatim from the Pandemrisk reference: each biome has a
// base fill plus two pixel-art accents and a coast/edge tint. Keep these in
// lockstep with the API biome literal — every biome the server can emit must
// have an entry here or the renderer falls back to ocean.
export const PAL: Record<Biome, BiomePalette> = {
  ocean: { base: "#06101e", hi: "#0d1d36", lo: "#040810", tex: "#103056", edge: "#1a4980" },
  coast: { base: "#0f2742", hi: "#1c3d62", lo: "#0a1a2c", tex: "#22507f", edge: "#2c6394" },
  beach: { base: "#5a4d2e", hi: "#7a6840", lo: "#3e3520", tex: "#6e5e36", edge: "#8a7748" },
  grassland: { base: "#324f1d", hi: "#496d2c", lo: "#223615", tex: "#3e6024", edge: "#5a8236" },
  forest: { base: "#1a3819", hi: "#274c25", lo: "#0f240f", tex: "#1f4220", edge: "#2e5a2c" },
  jungle: { base: "#15402a", hi: "#1f5836", lo: "#0c2a1a", tex: "#1a4b32", edge: "#236a40" },
  swamp: { base: "#2a3622", hi: "#3a4a30", lo: "#1a2415", tex: "#314028", edge: "#445534" },
  wetland: { base: "#2c4034", hi: "#3a5444", lo: "#1d2c22", tex: "#33493b", edge: "#4a6356" },
  desert: { base: "#7a6730", hi: "#9a8542", lo: "#594a22", tex: "#897538", edge: "#b09850" },
  savanna: { base: "#6e5e2c", hi: "#8a763b", lo: "#4e431e", tex: "#7d6a32", edge: "#9d8740" },
  boreal: { base: "#1d3b35", hi: "#2a514a", lo: "#13261f", tex: "#214139", edge: "#2f5b50" },
  tundra: { base: "#4a4f50", hi: "#65696b", lo: "#34373a", tex: "#525658", edge: "#737880" },
  mountain: { base: "#3a352c", hi: "#5e564a", lo: "#252220", tex: "#473f33", edge: "#6e6453" },
  snow: { base: "#9ab1c0", hi: "#c9d8e2", lo: "#6c8090", tex: "#aec2cf", edge: "#dde7ef" },
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

// Cheap deterministic per-tile RNG so a tile's pixel sprinkles never change
// across renders. Two tiles at the same coordinate will always look identical.
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  biome: Biome,
  tile: number = TILE_PX
): void {
  const p = PAL[biome] ?? PAL.ocean;
  const px = x * tile;
  const py = y * tile;
  ctx.fillStyle = p.base;
  ctx.fillRect(px, py, tile, tile);

  const seed = ((x * 1973 + y * 9277) | 0) >>> 0;
  const r = mulberry32(seed);
  const cells = tile / PSIZE;

  for (let i = 0; i < 4; i++) {
    const dx = Math.floor(r() * cells) * PSIZE;
    const dy = Math.floor(r() * cells) * PSIZE;
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + dx, py + dy, PSIZE, PSIZE);
  }
  for (let i = 0; i < 3; i++) {
    const dx = Math.floor(r() * cells) * PSIZE;
    const dy = Math.floor(r() * cells) * PSIZE;
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + dx, py + dy, PSIZE, PSIZE);
  }

  drawMotif(ctx, px, py, biome, p, tile);
}

function drawMotif(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  biome: Biome,
  p: BiomePalette,
  tile: number
): void {
  if (biome === "mountain" || biome === "snow") {
    ctx.fillStyle = biome === "snow" ? "#ffffff" : p.hi;
    const cx = px + 7;
    const top = py + 2;
    ctx.fillRect(cx, top, 2, 2);
    ctx.fillRect(cx - 2, top + 2, 6, 2);
    ctx.fillRect(cx - 3, top + 4, 8, 2);
    ctx.fillStyle = p.lo;
    ctx.fillRect(cx - 3, top + 6, 8, 1);
  } else if (biome === "forest" || biome === "jungle" || biome === "boreal") {
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + 2, py + 3, 2, 4);
    ctx.fillRect(px + 8, py + 7, 2, 4);
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 2, py + 2, 2, 1);
    ctx.fillRect(px + 8, py + 6, 2, 1);
    if (biome === "jungle") {
      ctx.fillStyle = p.lo;
      ctx.fillRect(px + 5, py + 9, 2, 3);
      ctx.fillStyle = p.hi;
      ctx.fillRect(px + 5, py + 8, 2, 1);
    }
  } else if (biome === "desert" || biome === "savanna") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 1, py + tile / 2, 4, 1);
    ctx.fillRect(px + tile / 2 + 1, py + tile / 2 + 3, 5, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + tile / 2 - 2, py + tile / 2 - 2, 1, 1);
  } else if (biome === "ocean" || biome === "coast") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 2, py + 5, 3, 1);
    ctx.fillRect(px + 8, py + 9, 3, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + 5, py + 2, 2, 1);
  } else if (biome === "swamp" || biome === "wetland") {
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + 2, py + 3, 4, 2);
    ctx.fillRect(px + 7, py + 8, 4, 2);
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 3, py + 3, 2, 1);
    ctx.fillRect(px + 8, py + 8, 2, 1);
  } else if (biome === "grassland") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 2, py + 9, 1, 2);
    ctx.fillRect(px + 5, py + 5, 1, 2);
    ctx.fillRect(px + 9, py + 10, 1, 2);
    ctx.fillRect(px + 11, py + 6, 1, 2);
  } else if (biome === "tundra") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 3, py + 3, 2, 1);
    ctx.fillRect(px + 9, py + 9, 2, 1);
    ctx.fillStyle = p.lo;
    ctx.fillRect(px + 7, py + 4, 1, 1);
  } else if (biome === "beach") {
    ctx.fillStyle = p.hi;
    ctx.fillRect(px + 1, py + 1, 2, 1);
    ctx.fillRect(px + 5, py + 8, 2, 1);
    ctx.fillRect(px + 10, py + 3, 2, 1);
  }
}
