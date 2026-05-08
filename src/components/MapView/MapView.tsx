import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConquestMap,
  CountryState,
  Player,
  Tile,
} from "@/api/types";
import { TILE_PX, drawTile } from "@/lib/biomes";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.5;

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  selectedCountryId?: string | null;
  onCountryClick?: (countryId: string) => void;
  onCountryHover?: (countryId: string | null) => void;
}

interface View {
  panX: number;
  panY: number;
  zoom: number;
}

function clampView(v: View, viewW: number, viewH: number, canvasW: number, canvasH: number): View {
  const cw = canvasW * v.zoom;
  const ch = canvasH * v.zoom;
  const panX =
    cw <= viewW ? (viewW - cw) / 2 : Math.max(viewW - cw, Math.min(0, v.panX));
  const panY =
    ch <= viewH ? (viewH - ch) / 2 : Math.max(viewH - ch, Math.min(0, v.panY));
  return { ...v, panX, panY };
}

function buildOutlinePaths(
  tilesByXY: (Tile | null)[][],
  width: number,
  height: number
): {
  coast: Path2D;
  byCountry: Map<string, Path2D>;
} {
  // For each land tile, emit each of its four edges that face an ocean tile
  // (coast) or a tile owned by a different country (border). Coast and per-
  // country borders go into separate Path2Ds so we can stroke coastlines in
  // neon cyan and country outlines in the owner's color.
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
      } else {
        // shared edge with same country — no outline needed
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
  selectedCountryId,
  onCountryClick,
  onCountryHover,
}: Props): JSX.Element {
  const canvasW = map.width * TILE_PX;
  const canvasH = map.height * TILE_PX;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseLayerRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(
    null
  );
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [hover, setHover] = useState<string | null>(null);

  // 2D tile lookup for outline building + click hit-testing.
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

  // (Re)build the static base layer when the map itself changes. Cheap because
  // it only needs to redraw on map regeneration, not on every game tick.
  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = canvasW;
    base.height = canvasH;
    const bctx = base.getContext("2d")!;
    bctx.imageSmoothingEnabled = false;
    for (const t of map.tiles) drawTile(bctx, t.x, t.y, t.biome);
    baseLayerRef.current = base;
  }, [map, canvasW, canvasH]);

  // Center the world the first time we know the viewport size.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const fit = Math.min(r.width / canvasW, r.height / canvasH);
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit * 0.95));
    setView({
      panX: (r.width - canvasW * z) / 2,
      panY: (r.height - canvasH * z) / 2,
      zoom: z,
    });
  }, [canvasW, canvasH, map.mapId]);

  // Animation loop — composites the static base, owner-colored country borders,
  // neon coastlines, hover/selected pulse, and the floating disease counters.
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

      // Country borders coloured by owner, with a soft glow underneath.
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

      // Coastlines — neon cyan glow then sharp white-cyan inner line.
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

      // Hover / selected pulse — owner colour, pulses with sin wave.
      const targets: { id: string; kind: "hover" | "selected" }[] = [];
      if (selectedCountryId) targets.push({ id: selectedCountryId, kind: "selected" });
      if (hover && hover !== selectedCountryId) targets.push({ id: hover, kind: "hover" });
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

      // Disease counters — floating box anchored at country centroid.
      // Renders armies on the left and a biohazard glyph + cube count on the
      // right. Severity-coded: green / yellow / red as cubes climb.
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
    hover,
  ]);

  // Hit-testing in canvas coordinates.
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
    if (cid !== hover) {
      setHover(cid);
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
    if (hover) {
      setHover(null);
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
    const armies = state?.armies ?? 0;
    const cubes = state?.diseaseCubes ?? 0;
    const cap = !!state?.isCapitalOf;
    const researcherPid = state?.hasResearcher ?? null;
    const vacc = state?.vaccinated;
    if (armies === 0 && cubes === 0 && !cap && !researcherPid) continue;

    const cx = (c.centroidX + 0.5) * TILE_PX;
    const cy = (c.centroidY + 0.5) * TILE_PX;
    const armyText = armies > 0 ? String(armies) : "·";
    const cubeText = String(cubes);
    const wide = armies >= 100 || cubes >= 10;
    const w = wide ? 70 : 56;
    const h = 22;
    const x0 = cx - w / 2;
    const y0 = cy - h - 6;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#0d0f0a";
    roundRect(ctx, x0, y0, w, h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const inset = 1.5;
    ctx.fillStyle = "#1a1d12";
    roundRect(ctx, x0 + inset, y0 + inset, w - inset * 2, h - inset * 2, 4);
    ctx.fill();

    // Severity accent on the right based on cube count (0-3).
    const sev = Math.min(1, cubes / 3);
    const accent = sev < 0.34 ? "#9be15d" : sev < 0.67 ? "#e8c547" : "#e85b3a";
    let pulse = 1;
    if (cubes >= 2) pulse = 1 + 0.18 * Math.sin(now / 160);
    ctx.strokeStyle = cubes > 0 ? accent : "rgba(91,227,255,0.55)";
    ctx.lineWidth = 1.2 * pulse;
    roundRect(ctx, x0 + 0.6, y0 + 0.6, w - 1.2, h - 1.2, 4);
    ctx.stroke();

    // Divider between armies and cubes.
    ctx.fillStyle = "rgba(91,227,255,0.18)";
    ctx.fillRect(x0 + w / 2, y0 + 4, 1, h - 8);

    // Armies (left half).
    ctx.fillStyle = "#f4f7e8";
    ctx.font = "bold 11px ui-monospace, JetBrains Mono, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(armyText, x0 + w / 4, y0 + h / 2 + 0.5);

    // Cubes (right half).
    ctx.fillStyle = cubes > 0 ? accent : "#3d4030";
    ctx.fillText(cubeText, x0 + (3 * w) / 4, y0 + h / 2 + 0.5);

    ctx.restore();

    // Capital marker — small star on the centroid.
    if (cap) {
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 6;
      drawStar(ctx, cx, cy + 4, 3.5);
      ctx.fill();
      ctx.restore();
    }

    // Researcher dot — coloured by owning player.
    if (researcherPid) {
      const col = playerColorById.get(researcherPid) ?? "#ffffff";
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx + 8, cy + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Vaccinated halo.
    if (vacc) {
      ctx.save();
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r / 2.2;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
