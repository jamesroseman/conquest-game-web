import type { CountryState, Player } from "@/api/types";

interface Props {
  players: Player[];
  activePlayerId?: string | null;
  ownerUserId?: string;
  myUserId?: string | null;
  // Used to compute per-player active disease cubes (sum across owned countries).
  // Optional so the component still renders in lobby contexts where country
  // state isn't available yet.
  countryStates?: CountryState[];
}

// Player roster. AI archetype/difficulty is intentionally hidden — the bot's
// playstyle is a server-side surprise that's supposed to feel fresh per game.
export function PlayerList({
  players,
  activePlayerId,
  ownerUserId,
  myUserId,
  countryStates,
}: Props): JSX.Element {
  const ordered = [...players].sort((a, b) => a.seatOrder - b.seatOrder);

  // Sum active cubes per player from country states. We tally this once
  // per render and look up by player id below.
  const cubesByPlayer = new Map<string, number>();
  if (countryStates) {
    for (const s of countryStates) {
      if (!s.ownerPlayerId) continue;
      cubesByPlayer.set(s.ownerPlayerId, (cubesByPlayer.get(s.ownerPlayerId) ?? 0) + s.diseaseCubes);
    }
  }

  return (
    <div>
      {ordered.map((p) => {
        const isActive = p.playerId === activePlayerId && !p.eliminated;
        const isOwner = ownerUserId && p.userId === ownerUserId;
        const isMe = myUserId && p.userId === myUserId;
        const cubes = cubesByPlayer.get(p.playerId) ?? 0;
        const elim = p.eliminated;
        return (
          <div
            key={p.playerId}
            className={`prow${isActive ? " active" : ""}${elim ? " elim-row" : ""}`}
            style={
              elim
                ? { opacity: 0.45, filter: "grayscale(0.85)" }
                : undefined
            }
          >
            <span className="who">
              {elim && (
                <span
                  aria-label="eliminated"
                  title="eliminated"
                  style={{ marginRight: 4, fontSize: 12 }}
                >
                  ☠
                </span>
              )}
              <span
                className="dot"
                style={{
                  background: p.color,
                  boxShadow: elim ? "none" : `0 0 6px ${p.color}`,
                }}
              />
              <span
                className="nm"
                style={elim ? { textDecoration: "line-through" } : undefined}
              >
                Seat {p.seatOrder + 1}
                {p.kind === "ai" ? <span className="ai" style={{ marginLeft: 6 }}>AI</span> : null}
                {isOwner ? <span className="ai" style={{ marginLeft: 6 }}>owner</span> : null}
              </span>
              {isMe ? <span className="me">you</span> : null}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontVariantNumeric: "tabular-nums",
              }}
              title={`troops · active disease cubes · cubes cured`}
            >
              <span className="cn" title="troops on the board">
                {p.totalArmies}a
              </span>
              <span
                className="cn"
                style={{ color: cubes > 0 ? "var(--bad)" : undefined }}
                title="active disease cubes on countries you own"
              >
                {cubes}d
              </span>
              <span
                className="cn"
                style={{ color: p.cubesCured > 0 ? "var(--good)" : undefined }}
                title="disease cubes you've cured this game"
              >
                {p.cubesCured}✚
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
