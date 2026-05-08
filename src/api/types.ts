/**
 * Hand-typed mirrors of the Strawberry types in conquest-game/src/conquest/api/types.py.
 *
 * Once the API is running locally, prefer regenerating these via `pnpm codegen`
 * (config in codegen.ts → outputs to src/api/__generated__/). Until then, treat
 * this file as the canonical wire shape.
 */

export type GameStatus =
  | "lobby"
  | "placing_troops"
  | "seeding_disease"
  | "placing_researchers"
  | "placing_capitals"
  | "in_progress"
  | "ended";

export type SetupPhase = "troops" | "disease_seed" | "researchers" | "capitals" | "done";
export type TurnPhase = "reinforcements" | "actions" | "virus";
export type Terrain = "land" | "ocean";
export type PathKind = "land" | "sea";
export type PlayerKind = "human" | "ai";
export type Difficulty = "easy" | "medium" | "hard" | "brutal";

export interface User {
  userId: string;
  email: string | null;
  displayName: string;
}

export interface GameConfig {
  actionsPerTurn: number;
  startingTroopsPerPlayer: number;
  outbreakLossThreshold: number;
  maxCubesPerCountry: number;
  reinforcementBase: number;
  reinforcementPerCountry: number;
  reinforcementCapitalBonus: number;
  continentBonusPool: number;
  winCondition: string;
}

export interface SetupState {
  phase: SetupPhase;
  activeSeatOrder: number;
}

export interface TurnState {
  activePlayerId: string | null;
  actionsRemaining: number;
  reinforcementsToPlace: number;
  turnNumber: number;
  roundNumber: number;
  phase: TurnPhase;
}

export interface Game {
  gameId: string;
  name: string;
  status: GameStatus;
  isJoinable: boolean;
  ownerUserId: string;
  minPlayers: number;
  maxPlayers: number;
  isPublic: boolean;
  inviteCode: string | null;
  playerCount: number;
  mapId: string | null;
  config: GameConfig;
  setup: SetupState;
  turn: TurnState;
  outbreakCount: number;
  winnerPlayerId: string | null;
  endedReason: string | null;
}

export interface Player {
  playerId: string;
  seatOrder: number;
  color: string;
  kind: PlayerKind;
  userId: string | null;
  archetype: string | null;
  difficulty: Difficulty | null;
  troopsRemainingToPlace: number;
  researcherCountryId: string | null;
  capitalCountryId: string | null;
  eliminated: boolean;
  countriesOwned: number;
  totalArmies: number;
}

export interface CountryState {
  countryId: string;
  ownerPlayerId: string | null;
  armies: number;
  diseaseCubes: number;
  vaccinated: boolean;
  isCapitalOf: string | null;
  hasResearcher: string | null;
}

export interface TileCoord {
  x: number;
  y: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  countryId: string | null;
}

export interface Path {
  pathId: string;
  countryAId: string;
  countryBId: string;
  kind: PathKind;
}

export interface Country {
  countryId: string;
  name: string;
  continentId: string;
  centroidX: number;
  centroidY: number;
  pathIds: string[];
  tiles: TileCoord[];
}

export interface Continent {
  continentId: string;
  name: string;
  isIsland: boolean;
  countryIds: string[];
  tileCount: number;
  bonusArmies: number;
}

export interface GameMap {
  mapId: string;
  width: number;
  height: number;
  countries: Country[];
  continents: Continent[];
  paths: Path[];
  tiles: Tile[];
}

export interface GameStateView {
  game: Game;
  players: Player[];
  countryStates: CountryState[];
  map: GameMap | null;
}

export interface GameError {
  __typename: "GameError";
  code: string;
  message: string;
}

export interface GameResult {
  __typename: "GameResult";
  game: Game;
}

export interface GameStateResult {
  __typename: "GameStateResult";
  state: GameStateView;
}

export type CreateGameResult = GameResult | GameError;
export type GameMutationResult = GameResult | GameError;
export type StateMutationResult = GameStateResult | GameError;

export const ARCHETYPES = [
  "aggressor",
  "turtle",
  "medic",
  "opportunist",
  "expansionist",
  "consolidator",
  "saboteur",
  "kingmaker",
  "doomsayer",
  "isolationist",
  "bandwagon",
  "chaos",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "brutal"];
