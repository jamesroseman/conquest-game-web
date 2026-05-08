import { useMemo } from "react";
import type { ConquestMap, CountryState, Player } from "@/api/types";
import { TileLayer } from "@/components/MapView/TileLayer";
import { PathLayer } from "@/components/MapView/PathLayer";
import { CountryOverlay } from "@/components/MapView/CountryOverlay";

const TILE_SIZE = 12;

interface Props {
  map: ConquestMap;
  countryStates: CountryState[];
  players: Player[];
  selectedCountryId?: string | null;
  onCountryClick?: (countryId: string) => void;
}

export function MapView({
  map,
  countryStates,
  players,
  selectedCountryId,
  onCountryClick,
}: Props): JSX.Element {
  const stateByCountry = useMemo(() => {
    const m = new Map<string, CountryState>();
    for (const s of countryStates) m.set(s.countryId, s);
    return m;
  }, [countryStates]);

  const width = map.width * TILE_SIZE;
  const height = map.height * TILE_SIZE;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none bg-slate-950"
      role="img"
      aria-label="Game map"
    >
      <TileLayer
        map={map}
        tileSize={TILE_SIZE}
        stateByCountry={stateByCountry}
        players={players}
        selectedCountryId={selectedCountryId ?? null}
        onCountryClick={onCountryClick}
      />
      <PathLayer map={map} tileSize={TILE_SIZE} />
      <CountryOverlay
        map={map}
        tileSize={TILE_SIZE}
        stateByCountry={stateByCountry}
        players={players}
      />
    </svg>
  );
}
