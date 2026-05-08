import type { Player } from "@/api/types";

interface Props {
  players: Player[];
  activePlayerId?: string | null;
  ownerUserId?: string;
  myUserId?: string | null;
}

export function PlayerList({ players, activePlayerId, ownerUserId, myUserId }: Props): JSX.Element {
  const ordered = [...players].sort((a, b) => a.seatOrder - b.seatOrder);
  return (
    <div>
      {ordered.map((p) => {
        const isActive = p.playerId === activePlayerId;
        const isOwner = ownerUserId && p.userId === ownerUserId;
        const isMe = myUserId && p.userId === myUserId;
        return (
          <div key={p.playerId} className={`prow${isActive ? " active" : ""}`}>
            <span className="who">
              <span
                className="dot"
                style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
              />
              <span className="nm">
                Seat {p.seatOrder + 1}
                {p.kind === "ai" ? (
                  <span className="ai" style={{ marginLeft: 6 }}>
                    AI · {p.archetype}/{p.difficulty}
                  </span>
                ) : null}
                {isOwner ? <span className="ai" style={{ marginLeft: 6 }}>owner</span> : null}
              </span>
              {isMe ? <span className="me">you</span> : null}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
              <span className="cn">{p.countriesOwned}c</span>
              <span className="cn">{p.totalArmies}a</span>
              {p.eliminated && <span className="elim">x</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
