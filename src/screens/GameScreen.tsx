import { useState } from "react";
import type { GameStateView } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { PlayerList } from "@/components/PlayerList";
import { ActionPanel } from "@/components/ActionPanel/ActionPanel";
import { CountryInspector } from "@/components/CountryInspector";
import { useMyPlayer } from "@/hooks/useMyPlayer";
import { useAuth } from "@/auth/useAuth";

interface Props {
  state: GameStateView;
}

export function GameScreen({ state }: Props): JSX.Element {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const myPlayer = useMyPlayer(state);
  const { game, players, countryStates, map } = state;

  return (
    <div className="page-game">
      <div style={{ position: "absolute", inset: 0 }}>
        {map ? (
          <MapView
            map={map}
            countryStates={countryStates}
            players={players}
            selectedCountryId={selected}
            onCountryClick={(id) => setSelected((prev) => (prev === id ? null : id))}
            onCountryHover={setHover}
          />
        ) : (
          <div className="bd dim" style={{ padding: 80, textAlign: "center" }}>
            Map not ready yet…
          </div>
        )}
      </div>

      {/* Top-left: phase + action panel */}
      <div className="panel panel-fixed" style={{ top: 60, left: 14, width: 280 }}>
        <div className="hd">
          actions
          <span className="right">
            R{game.turn.roundNumber} · T{game.turn.turnNumber} · {game.turn.phase}
          </span>
        </div>
        <div className="bd">
          <ActionPanel
            state={state}
            myPlayer={myPlayer}
            selectedCountryId={selected}
            setSelectedCountryId={setSelected}
          />
        </div>
      </div>

      {/* Top-right: country inspector */}
      <CountryInspector hoverCountryId={hover ?? selected} state={state} />

      {/* Bottom-left: outbreak counter + players */}
      <div className="panel panel-fixed" style={{ bottom: 14, left: 14, width: 280 }}>
        <div className="hd">
          outbreak watch
          <span className="right">
            {game.outbreakCount}/{game.config.outbreakLossThreshold}
          </span>
        </div>
        <div className="bd">
          <div className="meter" style={{ marginBottom: 8 }}>
            <i
              style={{
                width: `${Math.min(
                  100,
                  (game.outbreakCount / game.config.outbreakLossThreshold) * 100
                )}%`,
                background:
                  game.outbreakCount >= game.config.outbreakLossThreshold * 0.66
                    ? "var(--bad)"
                    : game.outbreakCount >= game.config.outbreakLossThreshold * 0.33
                      ? "var(--mid)"
                      : "var(--good)",
                boxShadow: "none",
              }}
            />
          </div>
          <div className="section-hd">players</div>
          <PlayerList
            players={players}
            activePlayerId={game.turn.activePlayerId ?? null}
            ownerUserId={game.ownerUserId}
            myUserId={user?.userId ?? null}
          />
        </div>
      </div>
    </div>
  );
}
