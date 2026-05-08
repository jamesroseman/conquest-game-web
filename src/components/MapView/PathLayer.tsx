import { useMemo } from "react";
import type { ConquestMap } from "@/api/types";

interface Props {
  map: ConquestMap;
  tileSize: number;
}

export function PathLayer({ map, tileSize }: Props): JSX.Element {
  const centroidById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const c of map.countries) {
      m.set(c.countryId, {
        x: (c.centroidX + 0.5) * tileSize,
        y: (c.centroidY + 0.5) * tileSize,
      });
    }
    return m;
  }, [map.countries, tileSize]);

  return (
    <g pointerEvents="none">
      {map.paths.map((p) => {
        const a = centroidById.get(p.countryAId);
        const b = centroidById.get(p.countryBId);
        if (!a || !b) return null;
        const dashed = p.kind === "sea";
        return (
          <line
            key={p.pathId}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgba(248,250,252,0.4)"
            strokeWidth={1.2}
            strokeDasharray={dashed ? "4 3" : undefined}
          />
        );
      })}
    </g>
  );
}
