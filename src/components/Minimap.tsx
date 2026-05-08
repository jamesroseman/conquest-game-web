import { useEffect, useMemo, useRef } from "react";
import type { ConquestMap, CountryState, Player } from "@/api/types";
import { PAL, TILE_PX } from "@/lib/biomes";
import { clampView, type View, ZOOM_MAX, ZOOM_MIN } from "@/lib/view";

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  view: View;
  setView: (next: View | ((prev: View) => View)) => void;
  viewportSize: { w: number; h: number };
}

const MINI_W = 220;
const MINI_H = 220;

// Top-down minimap. Renders one pixel per world tile, biome-colored, with
// owner-tinted country borders and neon coastlines. The amber rectangle is
// the visible portion of the main canvas — click anywhere to recenter.
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
  const canvasW = map.width * TILE_PX;
  const canvasH = map.height * TILE_PX;

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

  // Pre-compute a 2D grid for speed.
  const tileGrid = useMemo(() => {
    const g: { biome: string; countryId: string | null; terrain: string }[][] = [];
    for (let x = 0; x < map.width; x++)
      g.push(new Array(map.height).fill(null).map(() => ({ biome: "ocean", countryId: null, terrain: "ocean" })));
    for (const t of map.tiles) g[t.x][t.y] = { biome: t.biome, countryId: t.countryId, terrain: t.terrain };
    return g;
  }, [map]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const tw = MINI_W / map.width;
    const th = MINI_H / map.height;

    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, MINI_W, MINI_H);

    // Tiles.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileGrid[x][y];
        const pal = PAL[t.biome as keyof typeof PAL] ?? PAL.ocean;
        ctx.fillStyle = pal.base;
        ctx.fillRect(Math.floor(x * tw), Math.floor(y * th), Math.ceil(tw), Math.ceil(th));
      }
    }

    // Country borders coloured by owner.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileGrid[x][y];
        const cid = t.countryId;
        if (!cid) continue;
        const owner = ownerByCountry.get(cid) ?? null;
        const col = owner ? playerColorById.get(owner) ?? "rgba(255,210,140,0.7)" : "rgba(216,230,242,0.35)";
        ctx.fillStyle = col;
        const px = Math.floor(x * tw);
        const py = Math.floor(y * th);
        const pw = Math.ceil(tw);
        const ph = Math.ceil(th);
        if (x === 0 || tileGrid[x - 1][y].countryId !== cid) ctx.fillRect(px, py, 1, ph);
        if (x === map.width - 1 || tileGrid[x + 1][y].countryId !== cid)
          ctx.fillRect(px + pw - 1, py, 1, ph);
        if (y === 0 || tileGrid[x][y - 1].countryId !== cid) ctx.fillRect(px, py, pw, 1);
        if (y === map.height - 1 || tileGrid[x][y + 1].countryId !== cid)
          ctx.fillRect(px, py + ph - 1, pw, 1);
      }
    }

    // Coastlines on top.
    ctx.fillStyle = "rgba(91,227,255,0.65)";
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileGrid[x][y];
        if (t.terrain === "ocean") continue;
        const px = Math.floor(x * tw);
        const py = Math.floor(y * th);
        const pw = Math.ceil(tw);
        const ph = Math.ceil(th);
        if (x === 0 || tileGrid[x - 1][y].terrain === "ocean") ctx.fillRect(px, py, 1, ph);
        if (x === map.width - 1 || tileGrid[x + 1][y].terrain === "ocean")
          ctx.fillRect(px + pw - 1, py, 1, ph);
        if (y === 0 || tileGrid[x][y - 1].terrain === "ocean") ctx.fillRect(px, py, pw, 1);
        if (y === map.height - 1 || tileGrid[x][y + 1].terrain === "ocean")
          ctx.fillRect(px, py + ph - 1, pw, 1);
      }
    }

    // Viewport rectangle.
    if (viewportSize.w > 0 && viewportSize.h > 0 && view.zoom > 0) {
      const wxStart = -view.panX / view.zoom;
      const wyStart = -view.panY / view.zoom;
      const wxEnd = wxStart + viewportSize.w / view.zoom;
      const wyEnd = wyStart + viewportSize.h / view.zoom;
      const rxStart = Math.max(0, (wxStart / canvasW) * MINI_W);
      const ryStart = Math.max(0, (wyStart / canvasH) * MINI_H);
      const rxEnd = Math.min(MINI_W, (wxEnd / canvasW) * MINI_W);
      const ryEnd = Math.min(MINI_H, (wyEnd / canvasH) * MINI_H);
      ctx.save();
      ctx.strokeStyle = "rgba(255,180,84,0.95)";
      ctx.shadowColor = "rgba(255,180,84,0.6)";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(rxStart, ryStart, rxEnd - rxStart, ryEnd - ryStart);
      ctx.restore();
    }
  }, [map, tileGrid, ownerByCountry, playerColorById, view, viewportSize, canvasW, canvasH]);

  function jumpTo(clientX: number, clientY: number): void {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    const fy = (clientY - r.top) / r.height;
    const wx = fx * canvasW;
    const wy = fy * canvasH;
    setView((v) => {
      const next = {
        panX: viewportSize.w / 2 - wx * v.zoom,
        panY: viewportSize.h / 2 - wy * v.zoom,
        zoom: v.zoom,
      };
      return clampView(next, viewportSize.w, viewportSize.h, canvasW, canvasH);
    });
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    dragRef.current = { moved: false };
    jumpTo(e.clientX, e.clientY);
  }
  function onMouseMove(e: React.MouseEvent): void {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    jumpTo(e.clientX, e.clientY);
  }
  function onMouseUp(): void {
    dragRef.current = null;
  }

  function bumpZoom(direction: 1 | -1): void {
    setView((v) => {
      const factor = direction === 1 ? 1.25 : 1 / 1.25;
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
      // Zoom around the current viewport center.
      const cx = viewportSize.w / 2;
      const cy = viewportSize.h / 2;
      const wx = (cx - v.panX) / v.zoom;
      const wy = (cy - v.panY) / v.zoom;
      return clampView(
        { panX: cx - wx * z, panY: cy - wy * z, zoom: z },
        viewportSize.w,
        viewportSize.h,
        canvasW,
        canvasH
      );
    });
  }

  return (
    <div className="panel panel-fixed minimap-panel" style={{ bottom: 14, right: 14 }}>
      <div className="hd">
        world overview
        <span className="right">
          <button type="button" className="mzb" onClick={() => bumpZoom(-1)}>−</button>
          <span className="mzl">{Math.round(view.zoom * 100)}%</span>
          <button type="button" className="mzb" onClick={() => bumpZoom(1)}>+</button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_W}
        height={MINI_H}
        className="mini-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}
