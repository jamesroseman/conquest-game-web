import { useMutation } from "@apollo/client";
import {
  PLACE_CAPITAL,
  PLACE_RESEARCHER,
  PLACE_SETUP_TROOP,
} from "@/api/operations";
import type { GameStateView, Player, StateMutationResult } from "@/api/types";
import { MapView } from "@/components/MapView/MapView";
import { PlayerList } from "@/components/PlayerList";
import { useToast } from "@/components/ui/Toast";

interface Props {
  state: GameStateView;
  myPlayer: Player | null;
}

export function SetupScreen({ state, myPlayer }: Props) {
  const toast = useToast();
  const map = state.map;

  const [placeTroop, { loading: lTroop }] = useMutation<{
    placeSetupTroop: StateMutationResult;
  }>(PLACE_SETUP_TROOP);
  const [placeResearcher, { loading: lRes }] = useMutation<{
    placeResearcher: StateMutationResult;
  }>(PLACE_RESEARCHER);
  const [placeCapital, { loading: lCap }] = useMutation<{
    placeCapital: StateMutationResult;
  }>(PLACE_CAPITAL);
  const busy = lTroop || lRes || lCap;

  const phase = state.game.setup.phase;
  const activeSeat = state.game.setup.activeSeatOrder;
  const activePlayer = state.players.find((p) => p.seatOrder === activeSeat);
  const isMyTurn = !!myPlayer && activePlayer?.playerId === myPlayer.playerId;

  function handle(name: string, r?: StateMutationResult): boolean {
    if (!r) return false;
    if (r.__typename === "GameError") {
      toast.push(`${name}: ${r.code} — ${r.message}`, "error");
      return false;
    }
    return true;
  }

  async function onCountryClick(countryId: string) {
    if (!isMyTurn) return;
    if (phase === "troops") {
      const res = await placeTroop({ variables: { gameId: state.game.gameId, countryId } });
      handle("place_setup_troop", res.data?.placeSetupTroop);
    } else if (phase === "researchers") {
      const res = await placeResearcher({
        variables: { gameId: state.game.gameId, countryId },
      });
      handle("place_researcher", res.data?.placeResearcher);
    } else if (phase === "capitals") {
      const res = await placeCapital({
        variables: { gameId: state.game.gameId, countryId },
      });
      handle("place_capital", res.data?.placeCapital);
    }
  }

  if (!map) {
    return <p className="p-8 text-parchment/60">Generating map…</p>;
  }

  const phaseLabel: Record<typeof phase, string> = {
    troops: "Setup · Place troops",
    disease_seed: "Setup · Disease seeding",
    researchers: "Setup · Place researchers",
    capitals: "Setup · Place capitals",
    done: "Setup complete",
  };

  return (
    <div className="grid h-screen grid-cols-[1fr_320px]">
      <div className="relative">
        <MapView
          map={map}
          countryStates={state.countryStates}
          players={state.players}
          onCountryClick={isMyTurn && !busy ? onCountryClick : undefined}
        />
      </div>
      <aside className="flex flex-col gap-3 overflow-y-auto bg-ocean-deep/80 p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-parchment/60">
            {phaseLabel[phase]}
          </div>
          <div className="mt-1 text-sm">
            {isMyTurn ? (
              phase === "troops" ? (
                <>
                  Place a troop on any{" "}
                  <span className="text-amber-300">unclaimed country</span>, or one you own.
                  {myPlayer && (
                    <span className="ml-1 text-parchment/60">
                      ({myPlayer.troopsRemainingToPlace} left)
                    </span>
                  )}
                </>
              ) : phase === "researchers" ? (
                "Click a country you own to deploy your researcher."
              ) : phase === "capitals" ? (
                "Click a country you own to set your capital."
              ) : (
                "Server is processing."
              )
            ) : (
              <>Waiting for {activePlayer?.kind === "ai" ? "AI" : "another player"}…</>
            )}
          </div>
        </div>
        <PlayerList game={state.game} players={state.players} myPlayerId={myPlayer?.playerId} />
      </aside>
    </div>
  );
}
