import { type IsoMath, diamondCorners } from "@/lib/iso";

// Renders a wooden game-board frame around the iso play area. The four
// planks meet at mitred corners; outside the wood, the canvas is transparent
// so the parent's CSS starfield reads as space. Drawn into the same canvas
// as the world so it pans/zooms in lockstep.
export function drawWoodFrame(ctx: CanvasRenderingContext2D, iso: IsoMath): void {
  const T = 84; // bottom plank thickness
  const T2 = 44; // top plank thickness (thinner)
  const Nc = diamondCorners(iso, 0, 0, 0).top; // north apex
  const Ec = diamondCorners(iso, iso.width - 1, 0, 0).right; // east apex
  const Sc = diamondCorners(iso, iso.width - 1, iso.height - 1, 0).bottom; // south apex
  const Wc = diamondCorners(iso, 0, iso.height - 1, 0).left; // west apex

  // Outward normals along each diamond edge.
  const seDx = Sc.x - Ec.x;
  const seDy = Sc.y - Ec.y;
  const seLen = Math.hypot(seDx, seDy);
  const seN = { x: seDy / seLen, y: -seDx / seLen };
  const swDx = Wc.x - Sc.x;
  const swDy = Wc.y - Sc.y;
  const swLen = Math.hypot(swDx, swDy);
  const swN = { x: swDy / swLen, y: -swDx / swLen };
  const neDx = Ec.x - Nc.x;
  const neDy = Ec.y - Nc.y;
  const neLen = Math.hypot(neDx, neDy);
  const neN = { x: -neDy / neLen, y: neDx / neLen };
  const nwDx = Nc.x - Wc.x;
  const nwDy = Nc.y - Wc.y;
  const nwLen = Math.hypot(nwDx, nwDy);
  const nwN = { x: -nwDy / nwLen, y: nwDx / nwLen };

  function mitre(
    apex: { x: number; y: number },
    n1: { x: number; y: number },
    d1: { x: number; y: number },
    n2: { x: number; y: number },
    d2: { x: number; y: number },
    thick: number
  ): { x: number; y: number } {
    const A1 = { x: apex.x + n1.x * thick, y: apex.y + n1.y * thick };
    const A2 = { x: apex.x + n2.x * thick, y: apex.y + n2.y * thick };
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-6) return A1;
    const t = ((A2.x - A1.x) * d2.y - (A2.y - A1.y) * d2.x) / cross;
    return { x: A1.x + t * d1.x, y: A1.y + t * d1.y };
  }

  const Mc = mitre(
    Sc,
    seN,
    { x: seDx / seLen, y: seDy / seLen },
    swN,
    { x: swDx / swLen, y: swDy / swLen },
    T
  );
  const McTopFix = mitre(
    Nc,
    nwN,
    { x: nwDx / nwLen, y: nwDy / nwLen },
    neN,
    { x: neDx / neLen, y: neDy / neLen },
    T2
  );

  // Deterministic grain — same seed every frame so the wood doesn't shimmer.
  function rngFor(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function drawPlank(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    n: { x: number; y: number },
    outerEnd: { x: number; y: number },
    thick: number,
    seed: number
  ): void {
    const rng = rngFor(seed);
    const nx = n.x;
    const ny = n.y;
    const o1x = p1.x + nx * thick;
    const o1y = p1.y + ny * thick;
    const o2x = outerEnd.x;
    const o2y = outerEnd.y;

    // Base plank — gradient perpendicular to the edge so the play-area side
    // is bright and the outer rim falls into shadow.
    const g = ctx.createLinearGradient(p1.x, p1.y, p1.x + nx * thick, p1.y + ny * thick);
    g.addColorStop(0, "#6a4426");
    g.addColorStop(0.35, "#5a3a22");
    g.addColorStop(0.7, "#3a2415");
    g.addColorStop(1, "#1d0f06");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(o2x, o2y);
    ctx.lineTo(o1x, o1y);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(o2x, o2y);
    ctx.lineTo(o1x, o1y);
    ctx.closePath();
    ctx.clip();

    // Wavy grain along the plank's long axis.
    for (let i = 0; i < 80; i++) {
      const t = rng();
      const sx = p1.x + nx * thick * t;
      const sy = p1.y + ny * thick * t;
      const ex = p2.x + nx * thick * t;
      const ey = p2.y + ny * thick * t;
      const dark = rng() < 0.55;
      ctx.globalAlpha = 0.10 + rng() * 0.20;
      ctx.strokeStyle = dark ? "#1a0d04" : "#7a5430";
      ctx.lineWidth = 0.6 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const steps = 12;
      for (let s = 1; s <= steps; s++) {
        const tt = s / steps;
        const wob = (rng() - 0.5) * 5;
        const cx = sx + (ex - sx) * tt + nx * wob;
        const cy = sy + (ey - sy) * tt + ny * wob;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Knots.
    const knots = 5 + Math.floor(rng() * 4);
    for (let k = 0; k < knots; k++) {
      const tt = rng();
      const dd = 0.15 + rng() * 0.7;
      const kx = p1.x + (p2.x - p1.x) * tt + nx * thick * dd;
      const ky = p1.y + (p2.y - p1.y) * tt + ny * thick * dd;
      const kr = 4 + rng() * 8;
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
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    // Faint warm highlight just inside.
    ctx.strokeStyle = "rgba(180,128,72,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p1.x + nx * 4, p1.y + ny * 4);
    ctx.lineTo(p2.x + nx * 4, p2.y + ny * 4);
    ctx.stroke();
    // Outer rim shadow.
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o1x, o1y);
    ctx.lineTo(o2x, o2y);
    ctx.stroke();
    // End caps.
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(o1x, o1y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(o2x, o2y);
    ctx.stroke();
  }

  // Top thin planks first, then bottom thick planks so the bottom laps over
  // the top at the E and W corners.
  drawPlank(Wc, Nc, nwN, McTopFix, T2, 13371);
  drawPlank(
    Nc,
    Ec,
    neN,
    { x: Ec.x + neN.x * T2, y: Ec.y + neN.y * T2 },
    T2,
    13373
  );
  const overlap = T2 + 8;
  const seDir = { x: seDx / seLen, y: seDy / seLen };
  const swDir = { x: swDx / swLen, y: swDy / swLen };
  const Ec_ext = { x: Ec.x - seDir.x * overlap, y: Ec.y - seDir.y * overlap };
  const Wc_ext = { x: Wc.x + swDir.x * overlap, y: Wc.y + swDir.y * overlap };
  drawPlank(Ec_ext, Sc, seN, Mc, T, 13379);
  drawPlank(
    Sc,
    Wc_ext,
    swN,
    { x: Wc_ext.x + swN.x * T, y: Wc_ext.y + swN.y * T },
    T,
    13381
  );

  // Brass plate at the south mitre.
  const px = Mc.x;
  const py = Mc.y;
  const sz = 14;
  ctx.save();
  const ang = Math.atan2(Mc.y - Sc.y, Mc.x - Sc.x);
  ctx.translate(px, py);
  ctx.rotate(ang + Math.PI / 4);
  const bg = ctx.createLinearGradient(-sz, -sz, sz, sz);
  bg.addColorStop(0, "#e7c188");
  bg.addColorStop(0.5, "#a07832");
  bg.addColorStop(1, "#5e421c");
  ctx.fillStyle = bg;
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
