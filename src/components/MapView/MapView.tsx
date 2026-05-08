import { useEffect, useMemo, useRef } from "react";
import type {
  ConquestMap,
  CountryState,
  Player,
  Tile,
} from "@/api/types";
import { TILE_PX, drawTile } from "@/lib/biomes";
import { drawBiohazard, drawCapitalStar, drawResearcher, drawSoldier } from "@/lib/sprites";
import { clampView, type View, ZOOM_MIN, ZOOM_MAX } from "@/lib/view";

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  view: View;
  setView: (next: View | ((prev: View) => View)) => void;
  selectedCountryId?: string | null;
  onCountryClick?: (countryId: string) => void;
  onCountryHover?: (countryId: string | null) => void;
  onViewportSize?: (w: number, h: number) => void;
}

function buildOutlinePaths(
  tilesByXY: (Tile | null)[][],
  width: number,
  height: number
): {
  coast: Path2D;
  byCountry: Map<string, Path2D>;
} {
  const coast = new Path2D();
  const byCountry = new Map<string, Path2D>();
  function ensure(cid: string): Path2D {
    let p = byCountry.get(cid);
    if (!p) {
      p = new Path2D();
      byCountry.set(cid, p);
    }
    return p;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tilesByXY[x][y];
      if (!t || t.terrain !== "land" || !t.countryId) continue;
      const px = x * TILE_PX;
      const py = y * TILE_PX;
      const cid = t.countryId;
      const cp = ensure(cid);
      const top = y === 0 ? null : tilesByXY[x][y - 1];
      const bot = y === height - 1 ? null : tilesByXY[x][y + 1];
      const left = x === 0 ? null : tilesByXY[x - 1][y];
      const right = x === width - 1 ? null : tilesByXY[x + 1][y];

      if (!top || top.terrain === "ocean") {
        coast.moveTo(px, py + 0.5);
        coast.lineTo(px + TILE_PX, py + 0.5);
      } else if (top.countryId !== cid) {
        cp.moveTo(px, py + 0.5);
        cp.lineTo(px + TILE_PX, py + 0.5);
      }
      if (!bot || bot.terrain === "ocean") {
        coast.moveTo(px, py + TILE_PX - 0.5);
        coast.lineTo(px + TILE_PX, py + TILE_PX - 0.5);
      } else if (bot.countryId !== cid) {
        cp.moveTo(px, py + TILE_PX - 0.5);
        cp.lineTo(px + TILE_PX, py + TILE_PX - 0.5);
      }
      if (!left || left.terrain === "ocean") {
        coast.moveTo(px + 0.5, py);
        coast.lineTo(px + 0.5, py + TILE_PX);
      } else if (left.countryId !== cid) {
        cp.moveTo(px + 0.5, py);
        cp.lineTo(px + 0.5, py + TILE_PX);
      }
      if (!right || right.terrain === "ocean") {
        coast.moveTo(px + TILE_PX - 0.5, py);
        coast.lineTo(px + TILE_PX - 0.5, py + TILE_PX);
      } else if (right.countryId !== cid) {
        cp.moveTo(px + TILE_PX - 0.5, py);
        cp.lineTo(px + TILE_PX - 0.5, py + TILE_PX);
      }
    }
  }
  return { coast, byCountry };
}

export function MapView({
  map,
  countryStates,
  players,
  view,
  setView,
  selectedCountryId,
  onCountryClick,
  onCountryHover,
  onViewportSize,
}: Props): JSX.Element {
  const canvasW = map.width * TILE_PX;
  const canvasH = map.height * TILE_PX;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseLayerRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(
    null
  );
  const hoverRef = useRef<string | null>(null);

  const tilesByXY = useMemo(() => {
    const grid: (Tile | null)[][] = [];
    for (let x = 0; x < map.width; x++) grid.push(new Array(map.height).fill(null));
    for (const t of map.tiles) grid[t.x][t.y] = t;
    return grid;
  }, [map]);

  const outlines = useMemo(
    () => buildOutlinePaths(tilesByXY, map.width, map.height),
    [tilesByXY, map.width, map.height]
  );

  const playerColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.playerId, p.color);
    return m;
  }, [players]);

  const stateByCountry = useMemo(() => {
    const m = new Map<string, CountryState>();
    for (const s of countryStates) m.set(s.countryId, s);
    return m;
  }, [countryStates]);

  // Static base layer — recomputed only when the map itself changes.
  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = canvasW;
    base.height = canvasH;
    const bctx = base.getContext("2d")!;
    bctx.imageSmoothingEnabled = false;
    for (const t of map.tiles) drawTile(bctx, t.x, t.y, t.biome);
    baseLayerRef.current = base;
  }, [map, canvasW, canvasH]);

  // Report viewport size to parent (for the minimap viewport rectangle).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !onViewportSize) return;
    const update = (): void => {
      const r = wrap.getBoundingClientRect();
      onViewportSize(r.width, r.height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [onViewportSize]);

  // Animation loop — overlays + sprites + hover/select pulse.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;

    const render = (now: number): void => {
      ctx.clearRect(0, 0, canvasW, canvasH);
      const base = baseLayerRef.current;
      if (base) ctx.drawImage(base, 0, 0);

      // Country borders coloured by owner with a soft glow.
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [cid, path] of outlines.byCountry.entries()) {
        const state = stateByCountry.get(cid);
        const color = state?.ownerPlayerId
          ? playerColorById.get(state.ownerPlayerId) ?? "#7a8a9a"
          : "rgba(216, 230, 242, 0.35)";
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.7;
        ctx.stroke(path);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 1;
        ctx.stroke(path);
      }
      ctx.restore();

      // Coastlines.
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(91,227,255,0.55)";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(91,227,255,0.75)";
      ctx.lineWidth = 1.4;
      ctx.stroke(outlines.coast);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(200,245,255,1)";
      ctx.lineWidth = 1;
      ctx.stroke(outlines.coast);
      ctx.restore();

      // Hover / selected pulses.
      const targets: { id: string; kind: "hover" | "selected" }[] = [];
      if (selectedCountryId) targets.push({ id: selectedCountryId, kind: "selected" });
      if (hoverRef.current && hoverRef.current !== selectedCountryId)
        targets.push({ id: hoverRef.current, kind: "hover" });
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
      for (const tgt of targets) {
        const path = outlines.byCountry.get(tgt.id);
        if (!path) continue;
        const state = stateByCountry.get(tgt.id);
        const color = state?.ownerPlayerId
          ? playerColorById.get(state.ownerPlayerId) ?? "#5be3ff"
          : "#5be3ff";
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = color;
        if (tgt.kind === "selected") {
          ctx.shadowBlur = 12 + pulse * 10;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.stroke(path);
          ctx.shadowBlur = 22 + pulse * 12;
          ctx.globalAlpha = 0.45 + pulse * 0.3;
          ctx.stroke(path);
        } else {
          ctx.shadowBlur = 8 + pulse * 8;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.65 + pulse * 0.25;
          ctx.stroke(path);
        }
        ctx.restore();
      }

      // Floating country badges with animated army + disease sprites.
      drawCountryBadges(ctx, map, stateByCountry, playerColorById, now);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [
    canvasW,
    canvasH,
    map,
    outlines,
    stateByCountry,
    playerColorById,
    selectedCountryId,
  ]);

  // Hit-test point → tile.
  function pointToTile(clientX: number, clientY: number): Tile | null {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const lx = (clientX - rect.left - view.panX) / view.zoom;
    const ly = (clientY - rect.top - view.panY) / view.zoom;
    const tx = Math.floor(lx / TILE_PX);
    const ty = Math.floor(ly / TILE_PX);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    return tilesByXY[tx][ty];
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      px: view.panX,
      py: view.panY,
      moved: false,
    };
    wrapRef.current?.classList.add("dragging");
  }
  function onMouseMove(e: React.MouseEvent): void {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      const r = wrap.getBoundingClientRect();
      setView((v) =>
        clampView(
          { ...v, panX: dragRef.current!.px + dx, panY: dragRef.current!.py + dy },
          r.width,
          r.height,
          canvasW,
          canvasH
        )
      );
      return;
    }
    const tile = pointToTile(e.clientX, e.clientY);
    const cid = tile?.countryId ?? null;
    if (cid !== hoverRef.current) {
      hoverRef.current = cid;
      onCountryHover?.(cid);
    }
  }
  function onMouseUp(e: React.MouseEvent): void {
    const wasMoved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    wrapRef.current?.classList.remove("dragging");
    if (wasMoved) return;
    const tile = pointToTile(e.clientX, e.clientY);
    if (tile?.countryId) onCountryClick?.(tile.countryId);
  }
  function onMouseLeave(): void {
    dragRef.current = null;
    wrapRef.current?.classList.remove("dragging");
    if (hoverRef.current) {
      hoverRef.current = null;
      onCountryHover?.(null);
    }
  }
  function onWheel(e: React.WheelEvent): void {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
      const wx = (cx - v.panX) / v.zoom;
      const wy = (cy - v.panY) / v.zoom;
      return clampView(
        { panX: cx - wx * z, panY: cy - wy * z, zoom: z },
        r.width,
        r.height,
        canvasW,
        canvasH
      );
    });
  }

  return (
    <div
      ref={wrapRef}
      className="map-viewport starfield"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="map-canvas"
        style={{
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
        }}
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function drawCountryBadges(
  ctx: CanvasRenderingContext2D,
  map: ConquestMap,
  stateByCountry: Map<string, CountryState>,
  playerColorById: Map<string, string>,
  now: number
): void {
  for (const c of map.countries) {
    const state = stateByCountry.get(c.countryId);
    if (!state) continue;
    const armies = state.armies ?? 0;
    const cubes = state.diseaseCubes ?? 0;
    const cap = !!state.isCapitalOf;
    const researcherPid = state.hasResearcher ?? null;
    const vacc = state.vaccinated;
    if (armies === 0 && cubes === 0 && !cap && !researcherPid) continue;

    const ownerColor = state.ownerPlayerId
      ? playerColorById.get(state.ownerPlayerId) ?? "#aab8c4"
      : "#aab8c4";

    const cx = (c.centroidX + 0.5) * TILE_PX;
    const cy = (c.centroidY + 0.5) * TILE_PX;

    // Badge geometry — wider when counts grow into 2 digits.
    const w = armies >= 100 || cubes >= 10 ? 60 : 48;
    const h = 18;
    const x0 = cx - w / 2;
    const y0 = cy - h - 8;

    ctx.save();

    // Drop shadow.
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#0d0f0a";
    roundRect(ctx, x0, y0, w, h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = "#1a1d12";
    roundRect(ctx, x0 + 1, y0 + 1, w - 2, h - 2, 3.2);
    ctx.fill();

    // Severity-coded right-half border, pulsing at high cube counts.
    const sev = Math.min(1, cubes / 3);
    const accent = cubes === 0
      ? "rgba(91,227,255,0.4)"
      : sev < 0.4
        ? "#9be15d"
        : sev < 0.7
          ? "#e8c547"
          : "#e85b3a";
    let pulse = 1;
    if (cubes >= 2) pulse = 1 + 0.15 * Math.sin(now / 160);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1 * pulse;
    roundRect(ctx, x0 + 0.5, y0 + 0.5, w - 1, h - 1, 3.6);
    ctx.stroke();

    // Divider.
    ctx.fillStyle = "rgba(91,227,255,0.2)";
    ctx.fillRect(x0 + w / 2, y0 + 3, 1, h - 6);

    // --- Left half: animated soldier sprite + count -------------
    if (armies > 0) {
      const phaseSeed = ((c.countryId.charCodeAt(0) ?? 0) + (c.countryId.charCodeAt(c.countryId.length - 1) ?? 0)) | 0;
      drawSoldier(ctx, x0 + 4, y0 + 5, ownerColor, now, phaseSeed);
      ctx.fillStyle = "#f4f7e8";
      ctx.font = "bold 10px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(armies), x0 + 12, y0 + h / 2 + 0.5);
    } else {
      ctx.fillStyle = "rgba(216,230,242,0.18)";
      ctx.font = "10px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("·", x0 + w / 4, y0 + h / 2 + 0.5);
    }

    // --- Right half: animated biohazard + count -----------------
    if (cubes > 0) {
      const phaseSeed = c.countryId.length * 13;
      drawBiohazard(ctx, x0 + w / 2 + 3, y0 + 5, accent, now, phaseSeed);
      ctx.fillStyle = accent;
      ctx.font = "bold 10px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cubes), x0 + w / 2 + 13, y0 + h / 2 + 0.5);
    } else {
      ctx.fillStyle = "rgba(216,230,242,0.18)";
      ctx.font = "10px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("·", x0 + (3 * w) / 4, y0 + h / 2 + 0.5);
    }

    ctx.restore();

    // Capital + researcher + vaccinated overlays sit ON the centroid tile,
    // not in the badge — keeps the badge legible and the country state at-a-glance.
    if (cap) drawCapitalStar(ctx, cx, cy + 6, now);
    if (researcherPid) {
      const col = playerColorById.get(researcherPid) ?? "#ffffff";
      drawResearcher(ctx, cx + 9, cy + 6, col, now);
    }
    if (vacc) {
      ctx.save();
      ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
      ctx.shadowColor = "rgba(52, 211, 153, 0.65)";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy + 6, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
