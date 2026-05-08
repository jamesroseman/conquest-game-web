import { useMemo } from "react";
import type { GameStateView } from "@/api/types";
import { BIOME_LABEL, PAL } from "@/lib/biomes";

interface Props {
  hoverCountryId: string | null;
  state: GameStateView;
}

// Floating top-right tile inspector — biome breakdown + ownership for the
// hovered country. Always visible (shows a placeholder when nothing is
// hovered) so the chrome doesn't pop in/out as the cursor moves.
export function CountryInspector({ hoverCountryId, state }: Props): JSX.Element {
  const { game, players, countryStates, map } = state;

  const country = useMemo(
    () => (hoverCountryId && map ? map.countries.find((c) => c.countryId === hoverCountryId) : null),
    [hoverCountryId, map]
  );
  const continent = useMemo(
    () => (country && map ? map.continents.find((c) => c.continentId === country.continentId) : null),
    [country, map]
  );
  const ctryState = useMemo(
    () => (hoverCountryId ? countryStates.find((c) => c.countryId === hoverCountryId) : null),
    [hoverCountryId, countryStates]
  );
  const owner = ctryState?.ownerPlayerId
    ? players.find((p) => p.playerId === ctryState.ownerPlayerId)
    : null;

  // Top-3 biome breakdown across this country's tiles.
  const biomes = useMemo(() => {
    if (!country || !map) return [] as { biome: string; pct: number }[];
    const counts: Record<string, number> = {};
    for (const tc of country.tiles) {
      const tile = map.tiles.find((t) => t.x === tc.x && t.y === tc.y);
      if (!tile) continue;
      counts[tile.biome] = (counts[tile.biome] ?? 0) + 1;
    }
    const total = country.tiles.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([biome, n]) => ({ biome, pct: Math.round((n / total) * 100) }));
  }, [country, map]);

  return (
    <div
      className="panel panel-fixed"
      style={{ top: 60, right: 14, minWidth: 260, maxWidth: 320 }}
    >
      <div className="hd">
        country inspector
        <span className="right">
          turn {game.turn.turnNumber} · round {game.turn.roundNumber}
        </span>
      </div>
      <div className="bd">
        {!country ? (
          <div style={{ color: "var(--ink-dim)", fontStyle: "italic", padding: "4px 0" }}>
            Hover a country to inspect.
          </div>
        ) : (
          <>
            <div className="kv">
              <span className="k">country</span>
              <span className="v neon">{country.name}</span>
            </div>
            <div className="kv">
              <span className="k">continent</span>
              <span className="v">{continent?.name ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">climate</span>
              <span className="v">{continent?.climate ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">owner</span>
              <span className="v" style={{ color: owner?.color ?? "var(--ink-dim)" }}>
                {owner ? `seat ${owner.seatOrder + 1}` : "unclaimed"}
              </span>
            </div>
            <div className="kv">
              <span className="k">armies</span>
              <span className="v">{ctryState?.armies ?? 0}</span>
            </div>
            <div className="kv">
              <span className="k">disease</span>
              <span
                className={`v ${
                  (ctryState?.diseaseCubes ?? 0) === 0
                    ? "good"
                    : (ctryState?.diseaseCubes ?? 0) >= 2
                      ? "bad"
                      : "mid"
                }`}
              >
                {ctryState?.diseaseCubes ?? 0} cubes
                {ctryState?.vaccinated ? " · vaccinated" : ""}
              </span>
            </div>
            <div className="kv">
              <span className="k">tiles</span>
              <span className="v">{country.tiles.length}</span>
            </div>
            <div className="kv" style={{ alignItems: "flex-start" }}>
              <span className="k">terrain</span>
              <span className="v" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                {biomes.map((b) => (
                  <span key={b.biome} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        background: PAL[b.biome as keyof typeof PAL].top,
                        border: "1px solid rgba(0,0,0,0.6)",
                      }}
                    />
                    <span style={{ fontSize: 10 }}>
                      {BIOME_LABEL[b.biome as keyof typeof BIOME_LABEL]} {b.pct}%
                    </span>
                  </span>
                ))}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
