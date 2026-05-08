// Shared canvas view (pan + zoom). Lifted to the parent screen so MapView,
// Minimap, and ZoomControls can read & write the same state.

export interface View {
  panX: number;
  panY: number;
  zoom: number;
}

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 3.5;

export function clampView(
  v: View,
  viewW: number,
  viewH: number,
  canvasW: number,
  canvasH: number
): View {
  const cw = canvasW * v.zoom;
  const ch = canvasH * v.zoom;
  const panX =
    cw <= viewW ? (viewW - cw) / 2 : Math.max(viewW - cw, Math.min(0, v.panX));
  const panY =
    ch <= viewH ? (viewH - ch) / 2 : Math.max(viewH - ch, Math.min(0, v.panY));
  return { ...v, panX, panY };
}

export function fitView(
  viewW: number,
  viewH: number,
  canvasW: number,
  canvasH: number,
  scale = 0.95
): View {
  const fit = Math.min(viewW / canvasW, viewH / canvasH);
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit * scale));
  return {
    panX: (viewW - canvasW * z) / 2,
    panY: (viewH - canvasH * z) / 2,
    zoom: z,
  };
}
