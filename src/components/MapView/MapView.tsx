import { useMemo } from "react";
import type { CountryState, GameMap, Player } from "@/api/types";

const TILE = 16;
const OCEAN = "#1e3a5f";
const OCEAN_DEEP = "#0f1f33";
const UNCLAIMED = "#3a3a3a";

interface Props {
  map: GameMap;
  countryStates: CountryState[];
  players: Player[];
  selectedCountryId?: string | null;
  highlightCountryIds?: ReadonlySet<string>;
  onCountryClick?: (countryId: string) => void;
}

export function MapView({
  map,
  countryStates,
  players,
  selectedCountryId,
  highlightCountryIds,
  onCountryClick,
}: Props) {
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.playerId, p])),
    [players],
  );
  const stateByCountry = useMemo(
    () => new Map(countryStates.map((s) => [s.countryId, s])),
    [countryStates],
  );
  const countryById = useMemo(
    () => new Map(map.countries.map((c) => [c.countryId, c])),
    [map.countries],
  );

  const w = map.width * TILE;
  const h = map.height * TILE;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="block h-full w-full bg-ocean-deep"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Ocean background */}
      <rect x={0} y={0} width={w} height={h} fill={OCEAN_DEEP} />

      {/* Tile layer */}
      <g>
        {map.tiles.map((t) => {
          if (t.terrain === "ocean") {
            return (
              <rect
                key={`${t.x}.${t.y}`}
                x={t.x * TILE}
                y={t.y * TILE}
                width={TILE}
                height={TILE}
                fill={OCEAN}
              />
            );
          }
          const cs = t.countryId ? stateByCountry.get(t.countryId) : undefined;
          const owner = cs?.ownerPlayerId ? playerById.get(cs.ownerPlayerId) : undefined;
          const fill = owner?.color ?? UNCLAIMED;
          const dim = highlightCountryIds && t.countryId && !highlightCountryIds.has(t.countryId);
          return (
            <rect
              key={`${t.x}.${t.y}`}
              x={t.x * TILE}
              y={t.y * TILE}
              width={TILE}
              height={TILE}
              fill={fill}
              opacity={dim ? 0.35 : 1}
              onClick={t.countryId && onCountryClick ? () => onCountryClick(t.countryId!) : undefined}
              className={t.countryId && onCountryClick ? "cursor-pointer" : undefined}
            />
          );
        })}
      </g>

      {/* Path layer — lines between country centroids */}
      <g stroke="#f5e9c8" strokeOpacity={0.35} strokeWidth={1.2}>
        {map.paths.map((p) => {
          const a = countryById.get(p.countryAId);
          const b = countryById.get(p.countryBId);
          if (!a || !b) return null;
          return (
            <line
              key={p.pathId}
              x1={a.centroidX * TILE + TILE / 2}
              y1={a.centroidY * TILE + TILE / 2}
              x2={b.centroidX * TILE + TILE / 2}
              y2={b.centroidY * TILE + TILE / 2}
              strokeDasharray={p.kind === "sea" ? "3 4" : undefined}
            />
          );
        })}
      </g>

      {/* Selection outline */}
      {selectedCountryId &&
        (() => {
          const country = countryById.get(selectedCountryId);
          if (!country) return null;
          return (
            <g pointerEvents="none">
              {country.tiles.map(({ x, y }) => (
                <rect
                  key={`sel-${x}.${y}`}
                  x={x * TILE}
                  y={y * TILE}
                  width={TILE}
                  height={TILE}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })()}

      {/* Country labels + armies + cubes */}
      <g pointerEvents="none">
        {map.countries.map((c) => {
          const cs = stateByCountry.get(c.countryId);
          const cx = c.centroidX * TILE + TILE / 2;
          const cy = c.centroidY * TILE + TILE / 2;
          const armies = cs?.armies ?? 0;
          const cubes = cs?.diseaseCubes ?? 0;
          const isCapital = !!cs?.isCapitalOf;
          const hasResearcher = !!cs?.hasResearcher;
          const vaccinated = cs?.vaccinated;
          return (
            <g key={c.countryId} transform={`translate(${cx}, ${cy})`}>
              <text
                x={0}
                y={-10}
                textAnchor="middle"
                fontSize={9}
                fill="#f5e9c8"
                stroke="#0f1f33"
                strokeWidth={2}
                paintOrder="stroke"
              >
                {c.name}
              </text>
              {armies > 0 && (
                <g>
                  <circle r={8} fill="#0f1f33" stroke="#f5e9c8" strokeWidth={1} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fill="#f5e9c8"
                    fontWeight={700}
                  >
                    {armies}
                  </text>
                </g>
              )}
              {cubes > 0 && (
                <g transform="translate(12, -2)">
                  {Array.from({ length: cubes }).map((_, i) => (
                    <rect
                      key={i}
                      x={i * 4}
                      y={0}
                      width={3}
                      height={3}
                      fill={vaccinated ? "#a3e635" : "#dc2626"}
                    />
                  ))}
                </g>
              )}
              {isCapital && (
                <text x={-12} y={-2} fontSize={10} fill="#fbbf24">
                  ★
                </text>
              )}
              {hasResearcher && (
                <text x={0} y={14} fontSize={9} fill="#a78bfa" textAnchor="middle">
                  ⚕
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
