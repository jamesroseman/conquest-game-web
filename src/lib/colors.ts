export const NEUTRAL_COUNTRY_FILL = "#1f2937";
export const OCEAN_FILL = "#0b3552";

export function ownerColor(
  ownerPlayerId: string | null,
  players: { playerId: string; color: string }[]
): string | null {
  if (!ownerPlayerId) return null;
  return players.find((p) => p.playerId === ownerPlayerId)?.color ?? null;
}

const CUBE_FILL = "#dc2626";

export function cubeFill(_count: number): string {
  return CUBE_FILL;
}
