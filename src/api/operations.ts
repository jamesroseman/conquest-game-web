import { gql } from "@apollo/client";

/**
 * Operations are written as `gql` template literals against the schema in
 * conquest-game/src/conquest/api/schema.py. Result types are imported from
 * src/api/types.ts. After `pnpm codegen` runs against a live API, swap these
 * for the generated typed hooks.
 */

const GAME_FIELDS = gql`
  fragment GameFields on Game {
    gameId
    name
    status
    isJoinable
    ownerUserId
    minPlayers
    maxPlayers
    isPublic
    inviteCode
    playerCount
    mapId
    outbreakCount
    winnerPlayerId
    endedReason
    config {
      actionsPerTurn
      startingTroopsPerPlayer
      outbreakLossThreshold
      maxCubesPerCountry
      reinforcementBase
      reinforcementPerCountry
      reinforcementCapitalBonus
      continentBonusPool
      winCondition
    }
    setup {
      phase
      activeSeatOrder
    }
    turn {
      activePlayerId
      actionsRemaining
      reinforcementsToPlace
      turnNumber
      roundNumber
      phase
    }
  }
`;

const PLAYER_FIELDS = gql`
  fragment PlayerFields on Player {
    playerId
    seatOrder
    color
    kind
    userId
    archetype
    difficulty
    troopsRemainingToPlace
    researcherCountryId
    capitalCountryId
    eliminated
    countriesOwned
    totalArmies
  }
`;

const COUNTRY_STATE_FIELDS = gql`
  fragment CountryStateFields on CountryState {
    countryId
    ownerPlayerId
    armies
    diseaseCubes
    vaccinated
    isCapitalOf
    hasResearcher
  }
`;

const MAP_FIELDS = gql`
  fragment MapFields on Map {
    mapId
    width
    height
    tiles {
      x
      y
      terrain
      countryId
    }
    countries {
      countryId
      name
      continentId
      centroidX
      centroidY
      pathIds
      tiles {
        x
        y
      }
    }
    continents {
      continentId
      name
      isIsland
      countryIds
      tileCount
      bonusArmies
    }
    paths {
      pathId
      countryAId
      countryBId
      kind
    }
  }
`;

const STATE_FIELDS = gql`
  fragment StateFields on GameStateView {
    game {
      ...GameFields
    }
    players {
      ...PlayerFields
    }
    countryStates {
      ...CountryStateFields
    }
    map {
      ...MapFields
    }
  }
  ${GAME_FIELDS}
  ${PLAYER_FIELDS}
  ${COUNTRY_STATE_FIELDS}
  ${MAP_FIELDS}
`;

// --- Queries ---

export const ME_QUERY = gql`
  query MeQuery {
    me {
      userId
      email
      displayName
    }
  }
`;

export const JOINABLE_GAMES_QUERY = gql`
  query JoinableGamesQuery {
    joinableGames {
      ...GameFields
    }
  }
  ${GAME_FIELDS}
`;

export const GAME_QUERY = gql`
  query GameQuery($gameId: String!) {
    game(gameId: $gameId) {
      ...StateFields
    }
  }
  ${STATE_FIELDS}
`;

// --- Mutations ---

const STATE_RESULT = gql`
  fragment StateResultFields on StateMutationResult {
    __typename
    ... on GameStateResult {
      state {
        ...StateFields
      }
    }
    ... on GameError {
      code
      message
    }
  }
  ${STATE_FIELDS}
`;

const GAME_RESULT = gql`
  fragment GameResultFields on GameMutationResult {
    __typename
    ... on GameResult {
      game {
        ...GameFields
      }
    }
    ... on GameError {
      code
      message
    }
  }
  ${GAME_FIELDS}
`;

export const CREATE_GAME = gql`
  mutation CreateGameMutation(
    $name: String
    $maxPlayers: Int
    $isPublic: Boolean
    $config: GameConfigInput
    $seed: Int
  ) {
    createGame(
      name: $name
      maxPlayers: $maxPlayers
      isPublic: $isPublic
      config: $config
      seed: $seed
    ) {
      __typename
      ... on GameResult {
        game {
          ...GameFields
        }
      }
      ... on GameError {
        code
        message
      }
    }
  }
  ${GAME_FIELDS}
`;

export const JOIN_GAME = gql`
  mutation JoinGameMutation($gameId: String!, $inviteCode: String) {
    joinGame(gameId: $gameId, inviteCode: $inviteCode) {
      ...GameResultFields
    }
  }
  ${GAME_RESULT}
`;

export const LEAVE_GAME = gql`
  mutation LeaveGameMutation($gameId: String!) {
    leaveGame(gameId: $gameId) {
      ...GameResultFields
    }
  }
  ${GAME_RESULT}
`;

export const ADD_AI_SEAT = gql`
  mutation AddAiSeatMutation($gameId: String!, $archetype: String!, $difficulty: String) {
    addAiSeat(gameId: $gameId, archetype: $archetype, difficulty: $difficulty) {
      ...GameResultFields
    }
  }
  ${GAME_RESULT}
`;

export const REMOVE_SEAT = gql`
  mutation RemoveSeatMutation($gameId: String!, $targetPlayerId: String!) {
    removeSeat(gameId: $gameId, targetPlayerId: $targetPlayerId) {
      ...GameResultFields
    }
  }
  ${GAME_RESULT}
`;

export const START_GAME = gql`
  mutation StartGameMutation($gameId: String!) {
    startGame(gameId: $gameId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const ABANDON_GAME = gql`
  mutation AbandonGameMutation($gameId: String!, $archetype: String) {
    abandonGame(gameId: $gameId, archetype: $archetype) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const PLACE_SETUP_TROOP = gql`
  mutation PlaceSetupTroopMutation($gameId: String!, $countryId: String!) {
    placeSetupTroop(gameId: $gameId, countryId: $countryId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const PLACE_RESEARCHER = gql`
  mutation PlaceResearcherMutation($gameId: String!, $countryId: String!) {
    placeResearcher(gameId: $gameId, countryId: $countryId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const PLACE_CAPITAL = gql`
  mutation PlaceCapitalMutation($gameId: String!, $countryId: String!) {
    placeCapital(gameId: $gameId, countryId: $countryId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const PLACE_REINFORCEMENTS = gql`
  mutation PlaceReinforcementsMutation(
    $gameId: String!
    $placements: [TilePlacementInput!]!
  ) {
    placeReinforcements(gameId: $gameId, placements: $placements) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const MOVE_RESEARCHER = gql`
  mutation MoveResearcherMutation($gameId: String!, $toCountryId: String!) {
    moveResearcher(gameId: $gameId, toCountryId: $toCountryId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const AIRDROP_RESEARCHER = gql`
  mutation AirdropResearcherMutation($gameId: String!, $toCountryId: String!) {
    airdropResearcher(gameId: $gameId, toCountryId: $toCountryId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const CURE = gql`
  mutation CureMutation($gameId: String!) {
    cure(gameId: $gameId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const CREATE_VACCINE = gql`
  mutation CreateVaccineMutation($gameId: String!) {
    createVaccine(gameId: $gameId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const ATTACK = gql`
  mutation AttackMutation(
    $gameId: String!
    $fromCountryId: String!
    $toCountryId: String!
    $armies: Int!
  ) {
    attack(
      gameId: $gameId
      fromCountryId: $fromCountryId
      toCountryId: $toCountryId
      armies: $armies
    ) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const MOVE_TROOPS = gql`
  mutation MoveTroopsMutation(
    $gameId: String!
    $fromCountryId: String!
    $toCountryId: String!
    $armies: Int!
  ) {
    moveTroops(
      gameId: $gameId
      fromCountryId: $fromCountryId
      toCountryId: $toCountryId
      armies: $armies
    ) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;

export const END_TURN = gql`
  mutation EndTurnMutation($gameId: String!) {
    endTurn(gameId: $gameId) {
      ...StateResultFields
    }
  }
  ${STATE_RESULT}
`;
