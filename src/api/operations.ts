import { gql } from "@apollo/client";

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
    outbreakCount
    winnerPlayerId
    endedReason
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
    countries {
      countryId
      name
      tag
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
      climate
    }
    paths {
      pathId
      countryAId
      countryBId
      kind
    }
    tiles {
      x
      y
      terrain
      countryId
      biome
    }
  }
`;

const STATE_FIELDS = gql`
  ${GAME_FIELDS}
  ${PLAYER_FIELDS}
  ${COUNTRY_STATE_FIELDS}
  ${MAP_FIELDS}
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
`;

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
  ${GAME_FIELDS}
  query JoinableGamesQuery {
    joinableGames {
      ...GameFields
    }
  }
`;

export const GAME_QUERY = gql`
  ${STATE_FIELDS}
  query GameQuery($gameId: String!) {
    game(gameId: $gameId) {
      ...StateFields
    }
  }
`;

export const CREATE_GAME_MUTATION = gql`
  ${GAME_FIELDS}
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
`;

export const JOIN_GAME_MUTATION = gql`
  ${GAME_FIELDS}
  mutation JoinGameMutation($gameId: String!, $inviteCode: String) {
    joinGame(gameId: $gameId, inviteCode: $inviteCode) {
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
`;

export const LEAVE_GAME_MUTATION = gql`
  ${GAME_FIELDS}
  mutation LeaveGameMutation($gameId: String!) {
    leaveGame(gameId: $gameId) {
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
`;

export const ADD_AI_SEAT_MUTATION = gql`
  ${GAME_FIELDS}
  mutation AddAiSeatMutation($gameId: String!, $archetype: String, $difficulty: String) {
    addAiSeat(gameId: $gameId, archetype: $archetype, difficulty: $difficulty) {
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
`;

export const REMOVE_SEAT_MUTATION = gql`
  ${GAME_FIELDS}
  mutation RemoveSeatMutation($gameId: String!, $targetPlayerId: String!) {
    removeSeat(gameId: $gameId, targetPlayerId: $targetPlayerId) {
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
`;

export const START_GAME_MUTATION = gql`
  ${STATE_FIELDS}
  mutation StartGameMutation($gameId: String!) {
    startGame(gameId: $gameId) {
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
  }
`;

export const ABANDON_GAME_MUTATION = gql`
  ${STATE_FIELDS}
  mutation AbandonGameMutation($gameId: String!, $archetype: String) {
    abandonGame(gameId: $gameId, archetype: $archetype) {
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
  }
`;

const STATE_MUTATION_RESULT = `
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
`;

export const PLACE_SETUP_TROOP_MUTATION = gql`
  ${STATE_FIELDS}
  mutation PlaceSetupTroopMutation($gameId: String!, $countryId: String!) {
    placeSetupTroop(gameId: $gameId, countryId: $countryId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const PLACE_RESEARCHER_MUTATION = gql`
  ${STATE_FIELDS}
  mutation PlaceResearcherMutation($gameId: String!, $countryId: String!) {
    placeResearcher(gameId: $gameId, countryId: $countryId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const PLACE_CAPITAL_MUTATION = gql`
  ${STATE_FIELDS}
  mutation PlaceCapitalMutation($gameId: String!, $countryId: String!) {
    placeCapital(gameId: $gameId, countryId: $countryId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const PLACE_REINFORCEMENTS_MUTATION = gql`
  ${STATE_FIELDS}
  mutation PlaceReinforcementsMutation(
    $gameId: String!
    $placements: [TilePlacementInput!]!
  ) {
    placeReinforcements(gameId: $gameId, placements: $placements) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const MOVE_RESEARCHER_MUTATION = gql`
  ${STATE_FIELDS}
  mutation MoveResearcherMutation($gameId: String!, $toCountryId: String!) {
    moveResearcher(gameId: $gameId, toCountryId: $toCountryId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const AIRDROP_RESEARCHER_MUTATION = gql`
  ${STATE_FIELDS}
  mutation AirdropResearcherMutation($gameId: String!, $toCountryId: String!) {
    airdropResearcher(gameId: $gameId, toCountryId: $toCountryId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const CURE_MUTATION = gql`
  ${STATE_FIELDS}
  mutation CureMutation($gameId: String!) {
    cure(gameId: $gameId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const CREATE_VACCINE_MUTATION = gql`
  ${STATE_FIELDS}
  mutation CreateVaccineMutation($gameId: String!) {
    createVaccine(gameId: $gameId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const ATTACK_MUTATION = gql`
  ${STATE_FIELDS}
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
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const MOVE_TROOPS_MUTATION = gql`
  ${STATE_FIELDS}
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
      ${STATE_MUTATION_RESULT}
    }
  }
`;

export const END_TURN_MUTATION = gql`
  ${STATE_FIELDS}
  mutation EndTurnMutation($gameId: String!) {
    endTurn(gameId: $gameId) {
      ${STATE_MUTATION_RESULT}
    }
  }
`;
