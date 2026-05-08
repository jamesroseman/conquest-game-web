// Pixel-art sprites painted directly to canvas with deterministic-per-tile
// animation phases so identical countries don't wobble in lockstep. Designed
// to read at ~5–7 px and stack inside the floating disease/army badge.

export function drawSoldier(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  now: number,
  phaseSeed = 0
): void {
  // Soft up/down bob; phaseSeed = unique per badge so neighbouring soldiers
  // don't move in unison.
  const bob = Math.round(Math.sin((now + phaseSeed * 311) / 360) * 0.6);
  const px = Math.round(x);
  const py = Math.round(y + bob);

  // Drop shadow under the boots — subtle and dark.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(px - 1, py + 7, 7, 1);

  ctx.fillStyle = color;
  // Helmet.
  ctx.fillRect(px + 1, py, 3, 1);
  ctx.fillRect(px, py + 1, 5, 1);
  // Visor band — darker.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(px + 1, py + 2, 3, 1);
  // Body.
  ctx.fillStyle = color;
  ctx.fillRect(px, py + 3, 5, 2);
  // Belt — accent darker.
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(px, py + 5, 5, 1);
  // Legs.
  ctx.fillStyle = color;
  ctx.fillRect(px, py + 6, 2, 1);
  ctx.fillRect(px + 3, py + 6, 2, 1);
}

export function drawBiohazard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accent: string,
  now: number,
  phaseSeed = 0
): void {
  // Severity-coded pulse. The brighter the colour, the faster the throb so a
  // 3-cube country reads as "imminent outbreak" at a glance.
  const pulse = 0.5 + 0.5 * Math.sin((now + phaseSeed * 90) / 220);
  const px = Math.round(x);
  const py = Math.round(y);

  ctx.save();
  ctx.globalAlpha = 0.85 + 0.15 * pulse;

  // Background plate.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(px - 1, py - 1, 9, 9);

  ctx.fillStyle = accent;
  // Top dot.
  ctx.fillRect(px + 3, py, 1, 1);
  ctx.fillRect(px + 2, py + 1, 3, 1);
  ctx.fillRect(px + 3, py + 2, 1, 1);
  // Bottom-left dot.
  ctx.fillRect(px, py + 5, 1, 1);
  ctx.fillRect(px, py + 6, 2, 1);
  ctx.fillRect(px + 1, py + 7, 1, 1);
  // Bottom-right dot.
  ctx.fillRect(px + 6, py + 5, 1, 1);
  ctx.fillRect(px + 5, py + 6, 2, 1);
  ctx.fillRect(px + 5, py + 7, 1, 1);
  // Center triangle.
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(px + 3, py + 4, 1, 1);
  ctx.fillStyle = accent;
  ctx.fillRect(px + 3, py + 3, 1, 1);

  ctx.restore();
}

// Small pixel-art star, used for capital flag.
export function drawCapitalStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  now: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / 380);
  const cx = Math.round(x);
  const cy = Math.round(y);
  ctx.save();
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 4 + pulse * 4;
  ctx.fillStyle = "#facc15";
  // 5-point star, stepped.
  ctx.fillRect(cx - 1, cy - 3, 3, 1);
  ctx.fillRect(cx - 4, cy - 1, 9, 1);
  ctx.fillRect(cx - 3, cy, 7, 1);
  ctx.fillRect(cx - 2, cy + 1, 5, 1);
  ctx.fillRect(cx - 3, cy + 2, 2, 1);
  ctx.fillRect(cx + 2, cy + 2, 2, 1);
  ctx.restore();
}

// Tiny researcher icon — pulsing circle in the owner's colour.
export function drawResearcher(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  now: number
): void {
  const pulse = 0.55 + 0.45 * Math.sin(now / 280);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 + pulse * 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // White cross inside — reads as a medical icon at this scale.
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
  ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
  ctx.restore();
}
