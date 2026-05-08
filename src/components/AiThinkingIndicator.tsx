import type { Player } from "@/api/types";

interface Props {
  activePlayer: Player | null;
  className?: string;
}

// Pulsing "AI THINKING" chip — shown anywhere we're handing the screen over to
// the bot for a turn. The 3-bar wave is a CSS animation defined in
// styles/index.css.
export function AiThinkingIndicator({ activePlayer, className }: Props): JSX.Element | null {
  if (!activePlayer || activePlayer.kind !== "ai") return null;
  return (
    <div className={`ai-thinking${className ? " " + className : ""}`}>
      <span
        className="ai-dot"
        style={{ background: activePlayer.color, boxShadow: `0 0 6px ${activePlayer.color}` }}
      />
      <span className="ai-label">
        AI thinking
        <span className="ai-bars">
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="ai-meta">
        seat {activePlayer.seatOrder + 1} · {activePlayer.archetype} / {activePlayer.difficulty}
      </span>
    </div>
  );
}
