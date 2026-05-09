import { useEffect, useMemo, useRef } from "react";
import type { ConquestMap, CountryState, Player, Tile } from "@/api/types";
import { drawIsoTile } from "@/lib/biomes";
import {
  TH,
  TW,
  type IsoMath,
  diamondCorners,
  forEachIsoTile,
  isoPos,
  makeIso,
  pickTile,
} from "@/lib/iso";
import { drawWoodFrame } from "@/lib/wood";
import { drawAnimatedMotifs } from "@/lib/motifs";
import {
  drawArtillery,
  drawBiohazard,
  drawCapitalStar,
  drawResearcher,
  drawSoldier,
  drawTank,
  unitCountsFor,
} from "@/lib/sprites";
import type { FloatingNumber } from "@/lib/animations";
import { ZOOM_MAX, ZOOM_MIN, clampView, type View } from "@/lib/view";

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  view: View;
  setView: (next: View | ((prev: View) => View)) => void;
  selectedCountryId?: string | null;
  // When the user enters a click-to-target mode (attack/move), the parent
  // passes the set of valid target country ids — MapView paints them with
  // an animated amber ring so the player can see at a glance where they
  // can click.
  highlightedIds?: Set<string> | null;
  // Active floating "-N" / "+1" damage numbers spawned by the parent's
  // animation queue. MapView only renders; the queue itself lives in the
  // parent screen so it can also drive UI-side state (e.g. swapping the
  // action panel for a disease panel during virus phase playback).
  floats?: FloatingNumber[];
  onCountryClick?: (countryId: string) => void;
  onCountryHover?: (countryId: string | null) => void;
  onViewportSize?: (w: number, h: number) => void;
}

interface Outlines {
  coast: Path2D;
  byCountry: Map<string, Path2D>;
}

// Build coast + per-country diamond-edge paths in a single sweep. For each
// land tile, every edge facing ocean → coast; every edge facing a different
// country (same landmass) → that country's outline (counted once via id ordering).
function buildOutlines(
  tilesByXY: (Tile | null)[][],
  iso: IsoMath
): Outlines {
  const coast = new Path2D();
  const byCountry = new Map<string, Path2D>();
  const ensure = (cid: string): Path2D => {
    let p = byCountry.get(cid);
    if (!p) {
      p = new Path2D();
      byCountry.set(cid, p);
    }
    return p;
  };
  const addEdge = (path: Path2D, a: { x: number; y: number }, b: { x: number; y: number }): void => {
    path.moveTo(a.x + 0.5, a.y + 0.5);
    path.lineTo(b.x + 0.5, b.y + 0.5);
  };

  for (let y = 0; y < iso.height; y++) {
    for (let x = 0; x < iso.width; x++) {
      const t = tilesByXY[x][y];
      if (!t || t.terrain !== "land" || !t.countryId) continue;
      const corners = diamondCorners(iso, x, y, 0);
      const cid = t.countryId;
      const cp = ensure(cid);
      // In iso, (x+1, y) lies SE of (x, y), (x, y+1) lies SW, (x-1, y) lies
      // NW, (x, y-1) lies NE. Each grid neighbour shares the diamond edge
      // facing its direction:
      //   SE neighbour → right→bottom edge (the south-east face)
      //   SW neighbour → bottom→left
      //   NW neighbour → left→top
      //   NE neighbour → top→right
      const edges: Array<[number, number, { x: number; y: number }, { x: number; y: number }]> = [
        [x + 1, y, corners.right, corners.bottom],
        [x, y + 1, corners.bottom, corners.left],
        [x - 1, y, corners.left, corners.top],
        [x, y - 1, corners.top, corners.right],
      ];
      for (const [nx, ny, a, b] of edges) {
        const inb = nx >= 0 && nx < iso.width && ny >= 0 && ny < iso.height;
        const nt = inb ? tilesByXY[nx][ny] : null;
        if (!nt || nt.terrain !== "land") {
          addEdge(coast, a, b);
          addEdge(cp, a, b);
        } else if (nt.countryId !== cid) {
          // Country border within a landmass — count once per pair.
          if (cid < (nt.countryId ?? "")) {
            addEdge(cp, a, b);
            addEdge(ensure(nt.countryId!), a, b);
          }
        }
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
  highlightedIds,
  floats,
  onCountryClick,
  onCountryHover,
  onViewportSize,
}: Props): JSX.Element {
  const iso = useMemo(() => makeIso(map.width, map.height), [map.width, map.height]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseLayerRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(
    null
  );
  const hoverRef = useRef<string | null>(null);
  // Keep float-list in a ref so the rAF loop reads the latest without
  // re-subscribing every prop change.
  const floatsRef = useRef<FloatingNumber[]>([]);
  useEffect(() => {
    floatsRef.current = floats ?? [];
  }, [floats]);

  const tilesByXY = useMemo(() => {
    const grid: (Tile | null)[][] = [];
    for (let x = 0; x < map.width; x++) grid.push(new Array(map.height).fill(null));
    for (const t of map.tiles) grid[t.x][t.y] = t;
    return grid;
  }, [map]);

  const outlines = useMemo(() => buildOutlines(tilesByXY, iso), [tilesByXY, iso]);

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

  const countryById = useMemo(() => {
    const m = new Map<string, (typeof map.countries)[number]>();
    for (const c of map.countries) m.set(c.countryId, c);
    return m;
  }, [map]);

  // Static base layer — iso tiles painted in painter's order plus the wood
  // frame. Re-rendered only on map change.
  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = iso.canvasW;
    base.height = iso.canvasH;
    const bctx = base.getContext("2d")!;
    bctx.imageSmoothingEnabled = false;
    forEachIsoTile(iso, (x, y) => {
      const t = tilesByXY[x][y];
      if (!t) return;
      drawIsoTile(bctx, iso, x, y, t.biome);
    });
    drawWoodFrame(bctx, iso);
    baseLayerRef.current = base;
  }, [iso, tilesByXY]);

  // Report viewport size to the parent (for the minimap viewport rectangle).
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

  // Animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;

    const render = (now: number): void => {
      ctx.clearRect(0, 0, iso.canvasW, iso.canvasH);
      const base = baseLayerRef.current;
      if (base) ctx.drawImage(base, 0, 0);

      // Critters & water — drifting waves on ocean, fish on coast,
      // crabs on beach, sheep on grassland, seagulls overhead.
      drawAnimatedMotifs(ctx, map, iso, tilesByXY, now);

      // Country borders coloured by owner.
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [cid, path] of outlines.byCountry.entries()) {
        const state = stateByCountry.get(cid);
        const color = state?.ownerPlayerId
          ? playerColorById.get(state.ownerPlayerId) ?? "#7a8a9a"
          : "rgba(216, 230, 242, 0.30)";
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55;
        ctx.stroke(path);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.95;
        ctx.stroke(path);
      }
      ctx.restore();

      // (Coastline glow removed — country borders alone read the geography
      //  cleanly enough; the cyan halo was visually noisy.)

      // Sea paths — dashed neon arcs from one country's centroid to its
      // sea-path neighbour's. Land paths are NOT drawn (adjacent countries
      // are obvious from their shared border), but cross-ocean adjacency
      // would otherwise be invisible.
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(91,227,255,0.6)";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(170,230,255,0.85)";
      const dashPhase = (now / 80) % 11;
      ctx.lineDashOffset = -dashPhase;
      for (const p of map.paths) {
        if (p.kind !== "sea") continue;
        const a = countryById.get(p.countryAId);
        const b = countryById.get(p.countryBId);
        if (!a || !b) continue;
        const A = isoPos(iso, a.centroidX, a.centroidY, 0);
        const B = isoPos(iso, b.centroidX, b.centroidY, 0);
        ctx.beginPath();
        ctx.moveTo(A.cx, A.cy + TH / 2);
        ctx.lineTo(B.cx, B.cy + TH / 2);
        ctx.stroke();
      }
      ctx.restore();

      // Click-to-target highlights — amber dashed ring, walks with time so
      // the eye is drawn to it.
      if (highlightedIds && highlightedIds.size > 0) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -((now / 60) % 9);
        const amberPulse = 0.55 + 0.45 * Math.sin(now * 0.006);
        ctx.shadowColor = "rgba(255,180,84,0.65)";
        ctx.shadowBlur = 10 + amberPulse * 8;
        ctx.strokeStyle = "rgba(255,200,120,0.95)";
        ctx.lineWidth = 1.6;
        for (const id of highlightedIds) {
          const path = outlines.byCountry.get(id);
          if (path) ctx.stroke(path);
        }
        ctx.restore();
      }

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
          : "#fff7d8";
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

      // Per-tile troop sprites — soldiers / tanks / artillery scaled by
      // each country's army count. Painted under the badge so the badge
      // remains readable.
      drawTroopSprites(ctx, map, iso, stateByCountry, playerColorById, now);

      // Country badges + sprites.
      drawCountryBadges(ctx, map, iso, stateByCountry, playerColorById, now);

      // Floating damage / cube numbers above country tags.
      drawFloatingNumbers(
        ctx,
        iso,
        map,
        stateByCountry,
        playerColorById,
        floatsRef.current,
        now
      );

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [iso, map, tilesByXY, outlines, stateByCountry, playerColorById, selectedCountryId, highlightedIds, countryById]);

  // Hit-testing — point in canvas-local pixels → tile.
  function pointToTile(clientX: number, clientY: number): Tile | null {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const lx = (clientX - rect.left - view.panX) / view.zoom;
    const ly = (clientY - rect.top - view.panY) / view.zoom;
    const tile = pickTile(map, iso, lx, ly);
    if (!tile) return null;
    return tilesByXY[tile.x][tile.y];
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
      const drag = dragRef.current; // capture before the state-update closure runs
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      const r = wrap.getBoundingClientRect();
      const startPanX = drag.px;
      const startPanY = drag.py;
      setView((v) =>
        clampView(
          { ...v, panX: startPanX + dx, panY: startPanY + dy },
          r.width,
          r.height,
          iso.canvasW,
          iso.canvasH
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
        iso.canvasW,
        iso.canvasH
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
        width={iso.canvasW}
        height={iso.canvasH}
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

// Floating badges anchored above each populated country's centroid using iso
// projection. Sprite + count on each side, with capital / researcher /
// vaccinated overlays sitting on the tile centroid itself.
function drawCountryBadges(
  ctx: CanvasRenderingContext2D,
  map: ConquestMap,
  iso: IsoMath,
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

    const { cx, cy } = isoPos(iso, c.centroidX, c.centroidY, 0);
    const anchorX = cx;
    const anchorY = cy + TH / 2;

    // Big readable badge. The whole HUD uses image-rendering: pixelated, so
    // small text gets blocky when the user zooms in; bumping pixel sizes
    // here gives the rasteriser more pixels per glyph so the text reads
    // clean from afar AND up close.
    const w = armies >= 100 || cubes >= 10 ? 110 : 90;
    const h = 36;
    const tagH = 18;
    const tagW = Math.min(w - 12, c.tag.length * 11 + 14);
    const x0 = anchorX - w / 2;
    const y0 = anchorY - h - 28 - tagH + 2;

    // Body sits below the tag chip.
    const bodyY = y0 + tagH;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#0d0f0a";
    roundRect(ctx, x0, bodyY, w, h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = "#1a1d12";
    roundRect(ctx, x0 + 1, bodyY + 1, w - 2, h - 2, 3.2);
    ctx.fill();

    // Tag chip — short identifier ("A1", "B3") so a player can refer
    // to a country verbally without reading the procedural name. Sits on
    // top of the body, owner-coloured outline.
    const tagX = anchorX - tagW / 2;
    const tagY = y0;
    ctx.fillStyle = "#0d0f0a";
    roundRect(ctx, tagX, tagY, tagW, tagH, 3);
    ctx.fill();
    ctx.strokeStyle = ownerColor;
    ctx.lineWidth = 1;
    roundRect(ctx, tagX + 0.5, tagY + 0.5, tagW - 1, tagH - 1, 2.6);
    ctx.stroke();
    ctx.fillStyle = "#f4f7e8";
    ctx.font = "bold 13px ui-monospace, JetBrains Mono, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.tag, anchorX, tagY + tagH / 2 + 0.5);

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
    roundRect(ctx, x0 + 0.5, bodyY + 0.5, w - 1, h - 1, 3.6);
    ctx.stroke();

    ctx.fillStyle = "rgba(91,227,255,0.18)";
    ctx.fillRect(x0 + w / 2, bodyY + 4, 1, h - 8);

    // Soldier sprite + army count on the left half.
    if (armies > 0) {
      const phaseSeed =
        ((c.countryId.charCodeAt(0) ?? 0) +
          (c.countryId.charCodeAt(c.countryId.length - 1) ?? 0)) | 0;
      drawSoldier(ctx, x0 + 6, bodyY + 12, ownerColor, now, phaseSeed);
      ctx.fillStyle = "#f4f7e8";
      ctx.font = "bold 16px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(armies), x0 + 18, bodyY + h / 2 + 0.5);
    } else {
      ctx.fillStyle = "rgba(216,230,242,0.18)";
      ctx.font = "14px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("·", x0 + w / 4, bodyY + h / 2 + 0.5);
    }

    // Biohazard sprite + cube count on the right half.
    if (cubes > 0) {
      const phaseSeed = c.countryId.length * 13;
      drawBiohazard(ctx, x0 + w / 2 + 6, bodyY + 12, accent, now, phaseSeed);
      ctx.fillStyle = accent;
      ctx.font = "bold 16px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cubes), x0 + w / 2 + 18, bodyY + h / 2 + 0.5);
    } else {
      ctx.fillStyle = "rgba(216,230,242,0.18)";
      ctx.font = "14px ui-monospace, JetBrains Mono, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("·", x0 + (3 * w) / 4, bodyY + h / 2 + 0.5);
    }

    ctx.restore();

    if (cap) drawCapitalStar(ctx, anchorX, anchorY + 4, now);
    if (researcherPid) {
      const col = playerColorById.get(researcherPid) ?? "#ffffff";
      drawResearcher(ctx, anchorX + 10, anchorY + 4, col, now);
    }
    if (vacc) {
      ctx.save();
      ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
      ctx.shadowColor = "rgba(52, 211, 153, 0.65)";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY + 4, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Per-tile troop sprites. Soldiers/tanks/artillery are placed on country
// tiles around the centroid in a small cluster so they don't overlap. The
// counts scale with army strength (see `unitCountsFor`).
function drawTroopSprites(
  ctx: CanvasRenderingContext2D,
  map: ConquestMap,
  iso: IsoMath,
  stateByCountry: Map<string, CountryState>,
  playerColorById: Map<string, string>,
  now: number
): void {
  for (const c of map.countries) {
    const state = stateByCountry.get(c.countryId);
    if (!state) continue;
    const armies = state.armies ?? 0;
    if (armies <= 0) continue;
    const ownerColor = state.ownerPlayerId
      ? playerColorById.get(state.ownerPlayerId) ?? "#aab8c4"
      : "#aab8c4";
    const counts = unitCountsFor(armies);
    const seed =
      ((c.countryId.charCodeAt(0) ?? 0) +
        (c.countryId.charCodeAt(c.countryId.length - 1) ?? 0)) | 0;

    // Anchor cluster slightly south + east of the centroid so it doesn't
    // collide with capital/researcher overlays sitting on the centroid.
    const { cx, cy } = isoPos(iso, c.centroidX, c.centroidY, 0);
    const baseX = cx - 18;
    const baseY = cy + TH / 2 + 12;
    let i = 0;
    const slot = (offset: number): { sx: number; sy: number } => {
      // Lay units out in a 3-wide grid spaced by ~14px.
      const col = (offset % 3) * 14;
      const row = Math.floor(offset / 3) * 11;
      return { sx: baseX + col, sy: baseY + row };
    };
    for (let k = 0; k < counts.artillery; k++, i++) {
      const { sx, sy } = slot(i);
      drawArtillery(ctx, sx, sy, ownerColor, now, seed + k);
    }
    for (let k = 0; k < counts.tanks; k++, i++) {
      const { sx, sy } = slot(i);
      drawTank(ctx, sx, sy, ownerColor, now, seed + 100 + k);
    }
    for (let k = 0; k < counts.soldiers; k++, i++) {
      const { sx, sy } = slot(i);
      drawSoldier(ctx, sx, sy, ownerColor, now, seed + 200 + k);
    }
  }
}

// Drift-up + fade-out floating numbers anchored above each country
// centroid. `color === "owner"` resolves to the country's current owner
// colour at render time (so disease casualty numbers flash in the player's
// colour even though the parent doesn't know who owns what).
function drawFloatingNumbers(
  ctx: CanvasRenderingContext2D,
  iso: IsoMath,
  map: ConquestMap,
  stateByCountry: Map<string, CountryState>,
  playerColorById: Map<string, string>,
  floats: FloatingNumber[],
  now: number
): void {
  if (floats.length === 0) return;
  const countryById = new Map<string, ConquestMap["countries"][number]>();
  for (const c of map.countries) countryById.set(c.countryId, c);

  ctx.save();
  for (const f of floats) {
    if (now < f.startAt) continue;
    const t = (now - f.startAt) / f.duration;
    if (t < 0 || t > 1) continue;
    const country = countryById.get(f.countryId);
    if (!country) continue;
    const { cx, cy } = isoPos(iso, country.centroidX, country.centroidY, 0);
    const baseY = cy - 20; // sit above the badge tag chip
    const drift = -38 * t;
    const alpha = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.15);

    let color = f.color;
    if (color === "owner") {
      const state = stateByCountry.get(f.countryId);
      color = state?.ownerPlayerId
        ? playerColorById.get(state.ownerPlayerId) ?? "#aab8c4"
        : "#aab8c4";
    }

    ctx.globalAlpha = alpha;
    ctx.font = "bold 16px ui-monospace, JetBrains Mono, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Halo so the number is legible over the wood / starfield / coastlines.
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(f.label, cx, baseY + drift);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(f.label, cx, baseY + drift);
  }
  ctx.restore();
}

// Re-export iso constants so callers (screens) can size things consistently.
export { TW as ISO_TW, TH as ISO_TH };
