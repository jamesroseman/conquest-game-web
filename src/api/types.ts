// Hand-written GraphQL response types mirroring the conquest-game Strawberry schema.
// CLAUDE.md prescribes graphql-codegen, but codegen requires a running API to introspect.
// Until the toolchain wires that up, these types are the single source of truth on the
// client and must be kept in sync with src/conquest/api/types.py in the API repo.

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

export type Climate = "arctic" | "temperate" | "subtropical" | "tropical";

export type Biome =
  | "ocean"
  | "coast"
  | "beach"
  | "grassland"
  | "forest"
  | "jungle"
  | "swamp"
  | "wetland"
  | "desert"
  | "savanna"
  | "boreal"
  | "tundra"
  | "mountain"
  | "snow";

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

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  countryId: string | null;
  biome: Biome;
}

export interface TileCoord {
  x: number;
  y: number;
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
  climate: Climate;
}

export interface ConquestMap {
  mapId: string;
  width: number;
  height: number;
  countries: Country[];
  continents: Continent[];
  paths: Path[];
  tiles: Tile[];
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

export interface Player {
  playerId: string;
  seatOrder: number;
  color: string;
  kind: "human" | "ai";
  userId: string | null;
  archetype: string | null;
  difficulty: string | null;
  troopsRemainingToPlace: number;
  researcherCountryId: string | null;
  capitalCountryId: string | null;
  eliminated: boolean;
  countriesOwned: number;
  totalArmies: number;
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

export interface GameStateView {
  game: Game;
  players: Player[];
  countryStates: CountryState[];
  map: ConquestMap | null;
}

export interface GameError {
  __typename: "GameError";
  code: string;
  message: string;
}

export interface GameResultPayload {
  __typename: "GameResult";
  game: Game;
}

export interface GameStateResultPayload {
  __typename: "GameStateResult";
  state: GameStateView;
}

export type CreateGameResult = GameResultPayload | GameError;
export type GameMutationResult = GameResultPayload | GameError;
export type StateMutationResult = GameStateResultPayload | GameError;

export interface TilePlacementInput {
  countryId: string;
  count: number;
}
