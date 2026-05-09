import type { ConquestMap } from "@/api/types";

// Isometric math. The reference uses TW=72/TH=36; I'm slightly smaller so
// realistic Conquest maps (60–80 tiles wide) fit on a typical monitor at the
// auto-fit zoom without blowing out the GPU buffer.
export const TW = 64;
export const TH = 32;

// Margin around the iso diamond inside the canvas — leaves room for the
// wooden frame planks and a sliver of starscape on each side.
const FRAME_MARGIN = 96;

export interface IsoMath {
  width: number;
  height: number;
  canvasW: number;
  canvasH: number;
  originX: number;
  originY: number;
}

export function makeIso(width: number, height: number): IsoMath {
  // Square canvas: take the diamond's natural width and pad vertically so
  // the iso world centres top-to-bottom inside it. Square canvases simplify
  // the wooden-frame mitre math and keep zoom math symmetric.
  const canvasW = (width + height) * (TW / 2) + FRAME_MARGIN;
  const canvasH = canvasW;
  const originX = (height - 1) * (TW / 2) + FRAME_MARGIN / 2;
  const originY = (canvasH - (width + height) * (TH / 2)) / 2;
  return { width, height, canvasW, canvasH, originX, originY };
}

export function isoPos(iso: IsoMath, x: number, y: number, elev = 0): { cx: number; cy: number } {
  return {
    cx: iso.originX + (x - y) * (TW / 2),
    cy: iso.originY + (x + y) * (TH / 2) - elev,
  };
}

export interface DiamondCorners {
  top: { x: number; y: number };
  right: { x: number; y: number };
  bottom: { x: number; y: number };
  left: { x: number; y: number };
}

export function diamondCorners(iso: IsoMath, x: number, y: number, elev = 0): DiamondCorners {
  const { cx, cy } = isoPos(iso, x, y, elev);
  return {
    top: { x: cx, y: cy },
    right: { x: cx + TW / 2, y: cy + TH / 2 },
    bottom: { x: cx, y: cy + TH },
    left: { x: cx - TW / 2, y: cy + TH / 2 },
  };
}

// Iterate tiles back-to-front (rising x+y diagonal) — required for the
// painter's algorithm so taller tiles draw over their north neighbours.
export function forEachIsoTile(
  iso: IsoMath,
  fn: (x: number, y: number) => void
): void {
  const { width: W, height: H } = iso;
  for (let d = 0; d < W + H - 1; d++) {
    const xMin = Math.max(0, d - H + 1);
    const xMax = Math.min(W - 1, d);
    for (let x = xMin; x <= xMax; x++) {
      fn(x, d - x);
    }
  }
}

// Inverse iso: (canvas-pixel) → (tile coord) — front-to-back so the highest
// tile that contains the cursor wins.
export function pickTile(
  _map: ConquestMap,
  iso: IsoMath,
  px: number,
  py: number
): { x: number; y: number } | null {
  const { width: W, height: H } = iso;
  for (let d = W + H - 2; d >= 0; d--) {
    const xMin = Math.max(0, d - H + 1);
    const xMax = Math.min(W - 1, d);
    for (let tx = xMax; tx >= xMin; tx--) {
      const ty = d - tx;
      const { cx, cy } = isoPos(iso, tx, ty, 0);
      const dx = px - cx;
      const dy = py - cy - TH / 2;
      if (Math.abs(dx) / (TW / 2) + Math.abs(dy) / (TH / 2) <= 1) {
        return { x: tx, y: ty };
      }
    }
  }
  return null;
}
