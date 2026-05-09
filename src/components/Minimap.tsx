import { useEffect, useMemo, useRef } from "react";
import type { ConquestMap, CountryState, Player } from "@/api/types";
import { PAL } from "@/lib/biomes";
import { makeIso } from "@/lib/iso";
import { ZOOM_MAX, ZOOM_MIN, clampView, type View } from "@/lib/view";

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  view: View;
  setView: (next: View | ((prev: View) => View)) => void;
  viewportSize: { w: number; h: number };
}

const MINI_SIZE = 220;

// Top-down minimap. Square 220×220. Click recenters the main map; drag pans
// it continuously; the +/- buttons in the header zoom the MAIN map (the
// minimap itself always shows the whole world). The amber rectangle marks
// the visible portion of the main canvas.
export function Minimap({
  map,
  countryStates,
  players,
  view,
  setView,
  viewportSize,
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ moved: boolean } | null>(null);
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

    const tile = MINI_SIZE / Math.max(map.width, map.height);
    const offX = (MINI_SIZE - map.width * tile) / 2;
    const offY = (MINI_SIZE - map.height * tile) / 2;
    const xToPx = (x: number): number => Math.floor(offX + x * tile);
    const yToPx = (y: number): number => Math.floor(offY + y * tile);
    const pw = Math.max(1, Math.ceil(tile));
    const ph = pw;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileGrid[x][y];
        const pal = PAL[t.biome as keyof typeof PAL] ?? PAL.ocean;
        ctx.fillStyle = pal.top;
        ctx.fillRect(xToPx(x), yToPx(y), pw, ph);
      }
    }

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
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

    ctx.fillStyle = "rgba(91,227,255,0.65)";
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
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

    if (viewportSize.w > 0 && viewportSize.h > 0 && view.zoom > 0) {
      // Approximate the visible canvas-rect → tile-space rectangle.
      const wxStart = -view.panX / view.zoom;
      const wyStart = -view.panY / view.zoom;
      const wxEnd = wxStart + viewportSize.w / view.zoom;
      const wyEnd = wyStart + viewportSize.h / view.zoom;
      const fxStart = wxStart / iso.canvasW;
      const fxEnd = wxEnd / iso.canvasW;
      const fyStart = wyStart / iso.canvasH;
      const fyEnd = wyEnd / iso.canvasH;
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
  }, [map, tileGrid, ownerByCountry, playerColorById, view, viewportSize, iso.canvasW, iso.canvasH]);

  function jumpMain(clientX: number, clientY: number): void {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const tile = MINI_SIZE / Math.max(map.width, map.height);
    const offX = (MINI_SIZE - map.width * tile) / 2;
    const offY = (MINI_SIZE - map.height * tile) / 2;
    const fx = (clientX - r.left) / r.width;
    const fy = (clientY - r.top) / r.height;
    const tileX = ((fx * MINI_SIZE) - offX) / tile;
    const tileY = ((fy * MINI_SIZE) - offY) / tile;
    const fracX = Math.max(0, Math.min(1, tileX / map.width));
    const fracY = Math.max(0, Math.min(1, tileY / map.height));
    const targetCanvasX = fracX * iso.canvasW;
    const targetCanvasY = fracY * iso.canvasH;
    setView((v) =>
      clampView(
        {
          panX: viewportSize.w / 2 - targetCanvasX * v.zoom,
          panY: viewportSize.h / 2 - targetCanvasY * v.zoom,
          zoom: v.zoom,
        },
        viewportSize.w,
        viewportSize.h,
        iso.canvasW,
        iso.canvasH
      )
    );
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    dragRef.current = { moved: false };
    jumpMain(e.clientX, e.clientY);
  }
  function onMouseMove(e: React.MouseEvent): void {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    jumpMain(e.clientX, e.clientY);
  }
  function onMouseUp(): void {
    dragRef.current = null;
  }

  function bumpMainZoom(direction: 1 | -1): void {
    const factor = direction === 1 ? 1.25 : 1 / 1.25;
    setView((v) => {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
      // Zoom around the centre of the visible viewport.
      const cx = viewportSize.w / 2;
      const cy = viewportSize.h / 2;
      const wx = (cx - v.panX) / v.zoom;
      const wy = (cy - v.panY) / v.zoom;
      return clampView(
        { panX: cx - wx * z, panY: cy - wy * z, zoom: z },
        viewportSize.w,
        viewportSize.h,
        iso.canvasW,
        iso.canvasH
      );
    });
  }

  return (
    <div className="panel panel-fixed minimap-panel" style={{ bottom: 14, right: 14 }}>
      <div className="hd">
        world overview
        <span className="right">
          <button type="button" className="mzb" onClick={() => bumpMainZoom(-1)}>−</button>
          <span className="mzl">{Math.round(view.zoom * 100)}%</span>
          <button type="button" className="mzb" onClick={() => bumpMainZoom(1)}>+</button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_SIZE}
        height={MINI_SIZE}
        className="mini-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}
