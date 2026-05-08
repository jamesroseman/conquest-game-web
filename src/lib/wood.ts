import { type IsoMath, diamondCorners } from "@/lib/iso";

interface Vec {
  x: number;
  y: number;
}

// Wooden game-board frame around the iso play area. Four planks of equal
// thickness, mitred at all four diamond apexes (N, E, S, W). Outside the
// wood the canvas is transparent so the page's CSS starfield reads as space.
export function drawWoodFrame(ctx: CanvasRenderingContext2D, iso: IsoMath): void {
  const T = 64; // plank thickness

  const Nc = diamondCorners(iso, 0, 0, 0).top;
  const Ec = diamondCorners(iso, iso.width - 1, 0, 0).right;
  const Sc = diamondCorners(iso, iso.width - 1, iso.height - 1, 0).bottom;
  const Wc = diamondCorners(iso, 0, iso.height - 1, 0).left;

  // Diamond centroid — used to choose which perpendicular is "outward".
  const center: Vec = {
    x: (Nc.x + Ec.x + Sc.x + Wc.x) / 4,
    y: (Nc.y + Ec.y + Sc.y + Wc.y) / 4,
  };

  const NE = edge(Nc, Ec, center);
  const SE = edge(Ec, Sc, center);
  const SW = edge(Sc, Wc, center);
  const NW = edge(Wc, Nc, center);

  // Mitre point at each apex = intersection of the two adjacent OUTER lines.
  const mN = mitre(Nc, NW, NE, T);
  const mE = mitre(Ec, NE, SE, T);
  const mS = mitre(Sc, SE, SW, T);
  const mW = mitre(Wc, SW, NW, T);

  // Draw planks. Each plank quad goes (innerStart → innerEnd → outerEnd → outerStart).
  drawPlank(ctx, Nc, Ec, mN, mE, NE.outward, T, 1001);
  drawPlank(ctx, Ec, Sc, mE, mS, SE.outward, T, 1003);
  drawPlank(ctx, Sc, Wc, mS, mW, SW.outward, T, 1009);
  drawPlank(ctx, Wc, Nc, mW, mN, NW.outward, T, 1013);

  // Brass corner plates at all four mitres — small flourish that "anchors"
  // the planks to the apex.
  drawBrassPlate(ctx, mN, NE.dir);
  drawBrassPlate(ctx, mE, SE.dir);
  drawBrassPlate(ctx, mS, SW.dir);
  drawBrassPlate(ctx, mW, NW.dir);
}

interface Edge {
  p1: Vec;
  p2: Vec;
  dir: Vec; // unit vector from p1 to p2
  outward: Vec; // unit vector perpendicular to dir, pointing away from center
  length: number;
}

function edge(p1: Vec, p2: Vec, center: Vec): Edge {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  const dir: Vec = { x: dx / length, y: dy / length };
  // Two perpendicular candidates; pick the one whose dot with (midpoint - center)
  // is positive (i.e. points away from the diamond interior).
  const cand: Vec = { x: -dir.y, y: dir.x };
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const dot = (mid.x - center.x) * cand.x + (mid.y - center.y) * cand.y;
  const outward: Vec = dot > 0 ? cand : { x: -cand.x, y: -cand.y };
  return { p1, p2, dir, outward, length };
}

// Intersect the two outer edge lines that meet at `apex`.
function mitre(apex: Vec, incoming: Edge, outgoing: Edge, thick: number): Vec {
  const A1 = { x: apex.x + incoming.outward.x * thick, y: apex.y + incoming.outward.y * thick };
  const A2 = { x: apex.x + outgoing.outward.x * thick, y: apex.y + outgoing.outward.y * thick };
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

  // Base wood gradient runs from inner edge → outer edge.
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

  // Grain + knots clipped to the plank quad.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(innerStart.x, innerStart.y);
  ctx.lineTo(innerEnd.x, innerEnd.y);
  ctx.lineTo(outerEnd.x, outerEnd.y);
  ctx.lineTo(outerStart.x, outerStart.y);
  ctx.closePath();
  ctx.clip();

  // Wavy grain lines parallel to the long axis. Sample t across the
  // thickness and walk from inner-start side to inner-end side with wobble.
  for (let i = 0; i < 70; i++) {
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

  // Knots — sparse dark blobs.
  const knots = 4 + Math.floor(rng() * 4);
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

  // Inner bevel — dark line right against the play area.
  ctx.strokeStyle = "rgba(8,4,1,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(innerStart.x, innerStart.y);
  ctx.lineTo(innerEnd.x, innerEnd.y);
  ctx.stroke();
  // Faint warm highlight just inside the plank.
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

function drawBrassPlate(ctx: CanvasRenderingContext2D, center: Vec, edgeDir: Vec): void {
  const sz = 12;
  const ang = Math.atan2(edgeDir.y, edgeDir.x);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(ang + Math.PI / 4);
  const g = ctx.createLinearGradient(-sz, -sz, sz, sz);
  g.addColorStop(0, "#e7c188");
  g.addColorStop(0.5, "#a07832");
  g.addColorStop(1, "#5e421c");
  ctx.fillStyle = g;
  ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
  ctx.fillStyle = "rgba(20,12,4,0.8)";
  for (const [rx, ry] of [
    [-sz * 0.55, -sz * 0.55],
    [sz * 0.55, -sz * 0.55],
    [-sz * 0.55, sz * 0.55],
    [sz * 0.55, sz * 0.55],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
