import type { ConquestMap, CountryState, Player } from "@/api/types";
import { NEUTRAL_COUNTRY_FILL, OCEAN_FILL, ownerColor } from "@/lib/colors";

interface Props {
  map: ConquestMap;
  tileSize: number;
  stateByCountry: Map<string, CountryState>;
  players: Player[];
  selectedCountryId: string | null;
  onCountryClick?: (countryId: string) => void;
}

export function TileLayer({
  map,
  tileSize,
  stateByCountry,
  players,
  selectedCountryId,
  onCountryClick,
}: Props): JSX.Element {
  return (
    <g>
      {map.tiles.map((tile) => {
        if (tile.terrain === "ocean" || !tile.countryId) {
          return (
            <rect
              key={`${tile.x}-${tile.y}`}
              x={tile.x * tileSize}
              y={tile.y * tileSize}
              width={tileSize}
              height={tileSize}
              fill={OCEAN_FILL}
            />
          );
        }
        const state = stateByCountry.get(tile.countryId);
        const fill =
          (state ? ownerColor(state.ownerPlayerId, players) : null) ?? NEUTRAL_COUNTRY_FILL;
        const selected = tile.countryId === selectedCountryId;
        return (
          <rect
            key={`${tile.x}-${tile.y}`}
            x={tile.x * tileSize}
            y={tile.y * tileSize}
            width={tileSize}
            height={tileSize}
            fill={fill}
            stroke={selected ? "#fbbf24" : "rgba(15,23,42,0.4)"}
            strokeWidth={selected ? 1.5 : 0.5}
            className="cursor-pointer"
            onClick={() => onCountryClick?.(tile.countryId!)}
          >
            <title>{tile.countryId}</title>
          </rect>
        );
      })}
    </g>
  );
}
