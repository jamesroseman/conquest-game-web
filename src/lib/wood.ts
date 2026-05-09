import { type IsoMath, diamondCorners } from "@/lib/iso";

interface Vec {
  x: number;
  y: number;
}

// Wooden game-board frame around the iso play area. The two top planks
// (NW, NE) are half the thickness of the two bottom planks (SE, SW) — the
// bottom is the "front edge" of the board and reads heavier.
export function drawWoodFrame(ctx: CanvasRenderingContext2D, iso: IsoMath): void {
  const T_BOTTOM = 64;
  const T_TOP = T_BOTTOM / 2;

  const Nc = diamondCorners(iso, 0, 0, 0).top;
  const Ec = diamondCorners(iso, iso.width - 1, 0, 0).right;
  const Sc = diamondCorners(iso, iso.width - 1, iso.height - 1, 0).bottom;
  const Wc = diamondCorners(iso, 0, iso.height - 1, 0).left;

  const center: Vec = {
    x: (Nc.x + Ec.x + Sc.x + Wc.x) / 4,
    y: (Nc.y + Ec.y + Sc.y + Wc.y) / 4,
  };

  const NE = edge(Nc, Ec, center);
  const SE = edge(Ec, Sc, center);
  const SW = edge(Sc, Wc, center);
  const NW = edge(Wc, Nc, center);

  // Mitre at each apex: line-line intersection of the two adjacent OUTER
  // edges. Pass the per-edge thickness so the asymmetric N/S corners
  // (top-thin meeting bottom-thick) join cleanly.
  const mN = mitre(Nc, NW, NE, T_TOP, T_TOP);
  const mE = mitre(Ec, NE, SE, T_TOP, T_BOTTOM);
  const mS = mitre(Sc, SE, SW, T_BOTTOM, T_BOTTOM);
  const mW = mitre(Wc, SW, NW, T_BOTTOM, T_TOP);

  // Bottom planks rendered last so they lap visually over the thinner top
  // planks at the E and W mitres (matches the reference's "front edge sits
  // proud" feel).
  drawPlank(ctx, Nc, Ec, mN, mE, NE.outward, T_TOP, 1001);
  drawPlank(ctx, Wc, Nc, mW, mN, NW.outward, T_TOP, 1013);
  drawPlank(ctx, Ec, Sc, mE, mS, SE.outward, T_BOTTOM, 1003);
  drawPlank(ctx, Sc, Wc, mS, mW, SW.outward, T_BOTTOM, 1009);
}

interface Edge {
  p1: Vec;
  p2: Vec;
  dir: Vec;
  outward: Vec;
  length: number;
}

function edge(p1: Vec, p2: Vec, center: Vec): Edge {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  const dir: Vec = { x: dx / length, y: dy / length };
  const cand: Vec = { x: -dir.y, y: dir.x };
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const dot = (mid.x - center.x) * cand.x + (mid.y - center.y) * cand.y;
  const outward: Vec = dot > 0 ? cand : { x: -cand.x, y: -cand.y };
  return { p1, p2, dir, outward, length };
}

function mitre(
  apex: Vec,
  incoming: Edge,
  outgoing: Edge,
  thickIn: number,
  thickOut: number
): Vec {
  const A1 = { x: apex.x + incoming.outward.x * thickIn, y: apex.y + incoming.outward.y * thickIn };
  const A2 = { x: apex.x + outgoing.outward.x * thickOut, y: apex.y + outgoing.outward.y * thickOut };
  const d1 = incoming.dir;
  const d2 = outgoing.dir;
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-6) return A1;
  const t = ((A2.x - A1.x) * d2.y - (A2.y - A1.y) * d2.x) / cross;
  return { x: A1.x + t * d1.x, y: A1.y + t * d1.y };
}

function rngFor(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawPlank(
  ctx: CanvasRenderingContext2D,
  innerStart: Vec,
  innerEnd: Vec,
  outerStart: Vec,
  outerEnd: Vec,
  outward: Vec,
  thick: number,
  seed: number
): void {
  const rng = rngFor(seed);

  const g = ctx.createLinearGradient(
    innerStart.x,
    innerStart.y,
    innerStart.x + outward.x * thick,
    innerStart.y + outward.y * thick
  );
  g.addColorStop(0, "#6a4426");
  g.addColorStop(0.35, "#5a3a22");
  g.addColorStop(0.7, "#3a2415");
  g.addColorStop(1, "#1d0f06");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(innerStart.x, innerStart.y);
  ctx.lineTo(innerEnd.x, innerEnd.y);
  ctx.lineTo(outerEnd.x, outerEnd.y);
  ctx.lineTo(outerStart.x, outerStart.y);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(innerStart.x, innerStart.y);
  ctx.lineTo(innerEnd.x, innerEnd.y);
  ctx.lineTo(outerEnd.x, outerEnd.y);
  ctx.lineTo(outerStart.x, outerStart.y);
  ctx.closePath();
  ctx.clip();

  // Wavy grain — fewer lines on the thinner top planks so the texture
  // density matches the visible wood area.
  const grainCount = thick > 48 ? 70 : 36;
  for (let i = 0; i < grainCount; i++) {
    const t = rng();
    const sx = innerStart.x + outward.x * thick * t;
    const sy = innerStart.y + outward.y * thick * t;
    const ex = innerEnd.x + outward.x * thick * t;
    const ey = innerEnd.y + outward.y * thick * t;
    const dark = rng() < 0.55;
    ctx.globalAlpha = 0.10 + rng() * 0.20;
    ctx.strokeStyle = dark ? "#1a0d04" : "#7a5430";
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const steps = 12;
    for (let s = 1; s <= steps; s++) {
      const tt = s / steps;
      const wob = (rng() - 0.5) * 4;
      const cx = sx + (ex - sx) * tt + outward.x * wob;
      const cy = sy + (ey - sy) * tt + outward.y * wob;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const knots = thick > 48 ? 4 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 2);
  for (let k = 0; k < knots; k++) {
    const tt = rng();
    const dd = 0.2 + rng() * 0.6;
    const kx = innerStart.x + (innerEnd.x - innerStart.x) * tt + outward.x * thick * dd;
    const ky = innerStart.y + (innerEnd.y - innerStart.y) * tt + outward.y * thick * dd;
    const kr = 4 + rng() * 7;
    ctx.globalAlpha = 0.6;
    const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    kg.addColorStop(0, "#1a0d04");
    kg.addColorStop(0.6, "#2e1a0a");
    kg.addColorStop(1, "rgba(46,26,10,0)");
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Inner bevel.
  ctx.strokeStyle = "rgba(8,4,1,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(innerStart.x, innerStart.y);
  ctx.lineTo(innerEnd.x, innerEnd.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(180,128,72,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerStart.x + outward.x * 4, innerStart.y + outward.y * 4);
  ctx.lineTo(innerEnd.x + outward.x * 4, innerEnd.y + outward.y * 4);
  ctx.stroke();
  // Outer rim shadow.
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(outerStart.x, outerStart.y);
  ctx.lineTo(outerEnd.x, outerEnd.y);
  ctx.stroke();
}
