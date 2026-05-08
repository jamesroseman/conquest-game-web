import { useEffect, useMemo, useRef, useState } from "react";
import type { ConquestMap, CountryState, Player } from "@/api/types";
import { PAL } from "@/lib/biomes";
import { makeIso } from "@/lib/iso";
import { clampView, type View } from "@/lib/view";

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  view: View;
  setView: (next: View | ((prev: View) => View)) => void;
  viewportSize: { w: number; h: number };
}

const MINI_SIZE = 220;

// Top-down minimap. Square 220×220 canvas. Internal zoom (the +/- in the
// header) zooms the MINIMAP itself, not the main map — useful for inspecting
// country borders on big maps. The amber rectangle still shows the visible
// portion of the main canvas; clicking the minimap recenters the main map.
export function Minimap({
  map,
  countryStates,
  players,
  view,
  setView,
  viewportSize,
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ moved: boolean; isPan: boolean; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const [miniZoom, setMiniZoom] = useState(1);
  const [miniCenter, setMiniCenter] = useState<{ x: number; y: number } | null>(null);

  // Snap the mini-pan back to centre when the user zooms back out.
  useEffect(() => {
    if (miniZoom <= 1.0001) setMiniCenter(null);
  }, [miniZoom]);

  const iso = useMemo(() => makeIso(map.width, map.height), [map.width, map.height]);

  const playerColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.playerId, p.color);
    return m;
  }, [players]);

  const ownerByCountry = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of countryStates) m.set(s.countryId, s.ownerPlayerId);
    return m;
  }, [countryStates]);

  // 2D grid for fast neighbour lookups.
  const tileGrid = useMemo(() => {
    const g: { biome: string; countryId: string | null; terrain: string }[][] = [];
    for (let x = 0; x < map.width; x++)
      g.push(
        new Array(map.height)
          .fill(null)
          .map(() => ({ biome: "ocean", countryId: null, terrain: "ocean" }))
      );
    for (const t of map.tiles) g[t.x][t.y] = { biome: t.biome, countryId: t.countryId, terrain: t.terrain };
    return g;
  }, [map]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, MINI_SIZE, MINI_SIZE);

    // Compute the visible window in tile coords given miniZoom + miniCenter.
    const span = Math.max(map.width, map.height) / miniZoom;
    const cx = miniCenter ? miniCenter.x : map.width / 2;
    const cy = miniCenter ? miniCenter.y : map.height / 2;
    const tlX = cx - span / 2;
    const tlY = cy - span / 2;
    const tile = MINI_SIZE / span;

    const xToPx = (x: number): number => Math.floor((x - tlX) * tile);
    const yToPx = (y: number): number => Math.floor((y - tlY) * tile);
    const pw = Math.max(1, Math.ceil(tile));
    const ph = pw;

    const x0 = Math.max(0, Math.floor(tlX));
    const y0 = Math.max(0, Math.floor(tlY));
    const x1 = Math.min(map.width, Math.ceil(tlX + span));
    const y1 = Math.min(map.height, Math.ceil(tlY + span));

    // Tiles.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = tileGrid[x][y];
        const pal = PAL[t.biome as keyof typeof PAL] ?? PAL.ocean;
        ctx.fillStyle = pal.top;
        ctx.fillRect(xToPx(x), yToPx(y), pw, ph);
      }
    }

    // Country borders coloured by owner.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = tileGrid[x][y];
        const cid = t.countryId;
        if (!cid) continue;
        const owner = ownerByCountry.get(cid) ?? null;
        const col = owner ? playerColorById.get(owner) ?? "rgba(255,210,140,0.7)" : "rgba(216,230,242,0.35)";
        ctx.fillStyle = col;
        const px = xToPx(x);
        const py = yToPx(y);
        if (x === 0 || tileGrid[x - 1][y].countryId !== cid) ctx.fillRect(px, py, 1, ph);
        if (x === map.width - 1 || tileGrid[x + 1][y].countryId !== cid)
          ctx.fillRect(px + pw - 1, py, 1, ph);
        if (y === 0 || tileGrid[x][y - 1].countryId !== cid) ctx.fillRect(px, py, pw, 1);
        if (y === map.height - 1 || tileGrid[x][y + 1].countryId !== cid)
          ctx.fillRect(px, py + ph - 1, pw, 1);
      }
    }

    // Coastlines.
    ctx.fillStyle = "rgba(91,227,255,0.65)";
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = tileGrid[x][y];
        if (t.terrain === "ocean") continue;
        const px = xToPx(x);
        const py = yToPx(y);
        if (x === 0 || tileGrid[x - 1][y].terrain === "ocean") ctx.fillRect(px, py, 1, ph);
        if (x === map.width - 1 || tileGrid[x + 1][y].terrain === "ocean")
          ctx.fillRect(px + pw - 1, py, 1, ph);
        if (y === 0 || tileGrid[x][y - 1].terrain === "ocean") ctx.fillRect(px, py, pw, 1);
        if (y === map.height - 1 || tileGrid[x][y + 1].terrain === "ocean")
          ctx.fillRect(px, py + ph - 1, pw, 1);
      }
    }

    // Visible-viewport rectangle overlay. Translate the main view's
    // canvas-pixel rect into minimap-pixel coords. The main view is iso, so
    // we approximate by mapping the visible canvas area's bounding box to
    // tile-space proportionally.
    if (viewportSize.w > 0 && viewportSize.h > 0 && view.zoom > 0) {
      const wxStart = -view.panX / view.zoom;
      const wyStart = -view.panY / view.zoom;
      const wxEnd = wxStart + viewportSize.w / view.zoom;
      const wyEnd = wyStart + viewportSize.h / view.zoom;
      const fxStart = wxStart / iso.canvasW;
      const fxEnd = wxEnd / iso.canvasW;
      const fyStart = wyStart / iso.canvasH;
      const fyEnd = wyEnd / iso.canvasH;
      // Map fractional canvas coords → tile-space (whole map: 0..width).
      const tileXStart = fxStart * map.width;
      const tileXEnd = fxEnd * map.width;
      const tileYStart = fyStart * map.height;
      const tileYEnd = fyEnd * map.height;
      const rx = xToPx(tileXStart);
      const ry = yToPx(tileYStart);
      const rw = xToPx(tileXEnd) - rx;
      const rh = yToPx(tileYEnd) - ry;
      const cx2 = Math.max(0, Math.min(MINI_SIZE - 2, rx));
      const cy2 = Math.max(0, Math.min(MINI_SIZE - 2, ry));
      const cw = Math.max(2, Math.min(MINI_SIZE - cx2, rw));
      const ch = Math.max(2, Math.min(MINI_SIZE - cy2, rh));
      ctx.save();
      ctx.strokeStyle = "rgba(255,180,84,0.95)";
      ctx.shadowColor = "rgba(255,180,84,0.6)";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(cx2, cy2, cw, ch);
      ctx.restore();
    }
  }, [
    map,
    tileGrid,
    ownerByCountry,
    playerColorById,
    view,
    viewportSize,
    iso.canvasW,
    iso.canvasH,
    miniZoom,
    miniCenter,
  ]);

  // Click recenters the main map on the clicked tile-coord.
  function jumpMain(clientX: number, clientY: number): void {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    const fy = (clientY - r.top) / r.height;
    const span = Math.max(map.width, map.height) / miniZoom;
    const cx = miniCenter ? miniCenter.x : map.width / 2;
    const cy = miniCenter ? miniCenter.y : map.height / 2;
    const tileX = cx - span / 2 + fx * span;
    const tileY = cy - span / 2 + fy * span;
    const fracX = tileX / map.width;
    const fracY = tileY / map.height;
    const targetCanvasX = fracX * iso.canvasW;
    const targetCanvasY = fracY * iso.canvasH;
    setView((v) => {
      const next = {
        panX: viewportSize.w / 2 - targetCanvasX * v.zoom,
        panY: viewportSize.h / 2 - targetCanvasY * v.zoom,
        zoom: v.zoom,
      };
      return clampView(next, viewportSize.w, viewportSize.h, iso.canvasW, iso.canvasH);
    });
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    const isPan = miniZoom > 1.0001;
    dragRef.current = {
      moved: false,
      isPan,
      sx: e.clientX,
      sy: e.clientY,
      cx: miniCenter?.x ?? map.width / 2,
      cy: miniCenter?.y ?? map.height / 2,
    };
    if (!isPan) jumpMain(e.clientX, e.clientY);
  }
  function onMouseMove(e: React.MouseEvent): void {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (drag.isPan) {
      // When zoomed in, mouse-drag pans the minimap viewport in tile-space.
      const span = Math.max(map.width, map.height) / miniZoom;
      const tilePerPx = span / MINI_SIZE;
      const halfSpan = span / 2;
      let nx = drag.cx - dx * tilePerPx;
      let ny = drag.cy - dy * tilePerPx;
      nx = Math.max(halfSpan, Math.min(map.width - halfSpan, nx));
      ny = Math.max(halfSpan, Math.min(map.height - halfSpan, ny));
      setMiniCenter({ x: nx, y: ny });
    } else {
      // Click-and-drag at base zoom continuously recenters the main view.
      jumpMain(e.clientX, e.clientY);
    }
  }
  function onMouseUp(): void {
    dragRef.current = null;
  }

  function bumpMiniZoom(direction: 1 | -1): void {
    const factor = direction === 1 ? 1.4 : 1 / 1.4;
    setMiniZoom((z) => Math.max(1, Math.min(4, +(z * factor).toFixed(2))));
  }

  return (
    <div className="panel panel-fixed minimap-panel" style={{ bottom: 14, right: 14 }}>
      <div className="hd">
        world overview
        <span className="right">
          <button type="button" className="mzb" onClick={() => bumpMiniZoom(-1)}>−</button>
          <span className="mzl">{Math.round(miniZoom * 100)}%</span>
          <button type="button" className="mzb" onClick={() => bumpMiniZoom(1)}>+</button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_SIZE}
        height={MINI_SIZE}
        className="mini-canvas"
        style={{ cursor: miniZoom > 1.0001 ? "grab" : "crosshair" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}
