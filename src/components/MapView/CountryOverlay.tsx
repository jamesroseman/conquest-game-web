import type { ConquestMap, CountryState, Player } from "@/api/types";

interface Props {
  map: ConquestMap;
  tileSize: number;
  stateByCountry: Map<string, CountryState>;
  players: Player[];
}

export function CountryOverlay({
  map,
  tileSize,
  stateByCountry,
  players,
}: Props): JSX.Element {
  const colorByPlayer = new Map(players.map((p) => [p.playerId, p.color]));

  return (
    <g pointerEvents="none">
      {map.countries.map((c) => {
        const cx = (c.centroidX + 0.5) * tileSize;
        const cy = (c.centroidY + 0.5) * tileSize;
        const state = stateByCountry.get(c.countryId);
        const isCapital = state?.isCapitalOf != null;
        const researcherColor = state?.hasResearcher
          ? colorByPlayer.get(state.hasResearcher) ?? "#f8fafc"
          : null;
        const armies = state?.armies ?? 0;
        const cubes = state?.diseaseCubes ?? 0;
        const vaccinated = state?.vaccinated;

        return (
          <g key={c.countryId} transform={`translate(${cx}, ${cy})`}>
            {/* Centroid armies badge */}
            {armies > 0 && (
              <>
                <circle r={9} fill="rgba(15,23,42,0.85)" stroke="#f8fafc" strokeWidth={0.6} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fill="#f8fafc"
                  fontWeight={600}
                >
                  {armies}
                </text>
              </>
            )}

            {/* Capital marker */}
            {isCapital && (
              <polygon
                points="0,-14 2.4,-7 9.5,-7 3.6,-2.5 5.6,4.5 0,0 -5.6,4.5 -3.6,-2.5 -9.5,-7 -2.4,-7"
                fill="#facc15"
                stroke="#0f172a"
                strokeWidth={0.5}
                transform="translate(11, -10) scale(0.55)"
              />
            )}

            {/* Researcher dot */}
            {researcherColor && (
              <circle cx={-12} cy={-10} r={3.5} fill={researcherColor} stroke="#0f172a" strokeWidth={0.6} />
            )}

            {/* Disease cubes */}
            {cubes > 0 && (
              <g transform="translate(-10, 8)">
                {Array.from({ length: cubes }).map((_, i) => (
                  <rect
                    key={i}
                    x={i * 5}
                    y={0}
                    width={4}
                    height={4}
                    fill="#dc2626"
                    stroke="#0f172a"
                    strokeWidth={0.4}
                  />
                ))}
              </g>
            )}

            {/* Vaccinated marker */}
            {vaccinated && (
              <circle r={6} cy={6} fill="none" stroke="#34d399" strokeWidth={1} />
            )}

            <text
              y={armies > 0 ? 18 : 4}
              textAnchor="middle"
              fontSize={7}
              fill="rgba(248,250,252,0.85)"
              stroke="rgba(15,23,42,0.85)"
              strokeWidth={2}
              paintOrder="stroke"
            >
              {c.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
