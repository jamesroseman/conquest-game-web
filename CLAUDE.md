# Conquest Web

React/TypeScript client for **Conquest**, a turn-based strategy game with a shared pandemic
mechanic. The server (separate repo: `conquest-game`) owns the map, all game state, rule
enforcement, and the AI. This client is **render-only**: it pulls state via GraphQL and
dispatches mutations. Anything that "computes game state" in the UI is a bug.

## Architecture

- **Backend:** sibling repo `conquest-game` exposes a GraphQL API at `http://localhost:8000/graphql`
  plus REST auth endpoints (`/auth/google`, `/auth/dev-login`, `/auth/me`). Run it with
  `poetry run ./scripts/run_local.sh` in that repo.
- **This repo:** SPA. No business logic. No client-side rule enforcement. The server is
  authoritative for everything.
- **Wire format:** JSON is `camelCase` on both REST and GraphQL surfaces. TypeScript types
  match.
- **Auth:** every GraphQL request carries `Authorization: Bearer <conquest_jwt>`. The JWT
  is minted by REST (`/auth/google` or `/auth/dev-login`) and persisted in `localStorage`.

## Tech stack

- **Language:** TypeScript (strict mode).
- **Framework:** React 18+ with hooks. No class components.
- **Bundler / dev server:** Vite.
- **GraphQL client:** Apollo Client.
- **Codegen:** `@graphql-codegen/cli` against the running API's schema → typed hooks for
  every operation under `src/api/__generated__/`. **All GraphQL operations are typed
  end-to-end** — no `any`, no manual response shapes.
- **Routing:** React Router v6.
- **Styling:** Tailwind CSS.
- **Forms:** React Hook Form + Zod for validation.
- **Testing:** Vitest + React Testing Library + MSW (Mock Service Worker) for network
  stubs.
- **Linting:** ESLint with `@typescript-eslint`, `react-hooks`, `react-refresh`.
- **Formatting:** Prettier.

## Tooling

- **Package manager:** pnpm.
- **Pre-commit:** lint-staged + Husky → ESLint + Prettier on staged files.
- **CI:** GitHub Actions running `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Core concepts

### Auth flow

Two paths, exposed in the UI as **Sign in with Google** and (in dev only) **Dev login**:

1. **Google Sign-In (production path).**
   - Use `@react-oauth/google` to render the Google button, get an ID token.
   - `POST /auth/google` with `{ idToken }` → returns `{ token, userId, displayName, email }`.
   - Store `token` in `localStorage` under key `conquest.jwt`.
2. **Dev login (local only).**
   - `POST /auth/dev-login` with `{ displayName }` → same response shape.
   - Hidden behind a build flag (`import.meta.env.DEV` or `VITE_DEV_LOGIN=1`).

`/auth/me` is the "validate my stored JWT on app start" probe — clear `localStorage` if it
401s.

### Lobby flow

```
createGame                  → status: "lobby"          (creator joins seat 0)
joinGame(invite_code)       → status: "lobby"          (any authed user)
leaveGame                   → self-service, lobby only
addAiSeat / removeSeat      → owner-only
startGame                   → status: "placing_troops" (locks players in)
abandonGame                 → in-progress, hands seat to AI
```

`game.is_joinable` is `true` while `status === "lobby"` and `playerCount < maxPlayers`.

### Game phases

Server-driven. The client renders whatever phase the snapshot reports:

- `lobby` → render `LobbyScreen`.
- `placing_troops` / `placing_researchers` / `placing_capitals` → render `SetupScreen`,
  highlight the active seat, allow the active player to click a country to place.
- `in_progress` → render `GameScreen` (full map + action panel).
- `ended` → render `GameOverScreen` with the winner / loss reason.

The setup phase auto-progresses: after a human places, the server runs any consecutive AI
seats and the next snapshot reflects that. The client just polls.

### Map rendering

The map is a 2D grid of tiles. The `Map` query returns:
- `tiles[]` — `{x, y, terrain: "land"|"ocean", countryId}`
- `countries[]` — `{countryId, name, continentId, centroidX, centroidY, pathIds, tiles[]}`
- `paths[]` — `{pathId, countryAId, countryBId, kind: "land"|"sea"}`
- `continents[]` — `{continentId, name, isIsland, countryIds, tileCount, bonusArmies}`

V1 rendering uses **SVG**:
- One `<rect>` per tile, filled by terrain (ocean blue) or by country owner color (looked up
  via `countryStates[countryId].ownerPlayerId`).
- Country borders drawn as polylines around tile boundaries.
- Path lines between country centroids: solid for `land`, dashed for `sea`.
- Country labels at the centroid; armies/disease cubes overlaid on the centroid tile.
- Selected country gets a highlight outline; click handlers dispatch the right mutation
  for the current phase (place setup troop, attack, move troops, etc.).

Don't try to be clever in v1 — just `<rect>` per tile + `<polyline>` per path. Optimization
comes after gameplay works.

### State sync

No subscriptions in v0.1. Apollo `pollInterval` on the active `Game` query at **2 seconds**
while a game is in progress; pause polling when the tab is hidden (`document.visibilityState`).
After every mutation, refetch the game query; mutations return the new state directly so
the cache updates immediately.

A future v0.2 may add WebSocket subscriptions; the polling abstraction lives behind a
`useGameState(gameId)` hook so swapping it out is a one-file change.

### Discriminated mutation results

Every mutation returns a tagged union of `{Success, GameError}`. In TypeScript, discriminate
on `__typename`:

```ts
const result = data?.startGame;
if (result?.__typename === "GameStateResult") {
  // happy path: result.state is a GameStateView
} else if (result?.__typename === "GameError") {
  // typed error: result.code is one of "NOT_YOUR_TURN", "REINFORCEMENTS_NOT_PLACED", etc.
}
```

Codegen produces these unions automatically. Always handle the error branch — toast the
`message`, no silent failures.

## Repository layout

```
conquest-game-web/
├── CLAUDE.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── codegen.ts                    # graphql-codegen config
├── .env.example                  # VITE_API_URL, VITE_DEV_LOGIN
├── public/
└── src/
    ├── main.tsx                  # entry; mounts <App/>
    ├── App.tsx                   # router + ApolloProvider + AuthProvider
    ├── api/
    │   ├── apollo.ts             # Apollo Client + auth-link reading localStorage
    │   ├── auth.ts               # POST /auth/google, /auth/dev-login, /auth/me
    │   ├── operations/           # *.graphql files (queries + mutations)
    │   └── __generated__/        # codegen output (do not edit)
    ├── auth/
    │   ├── AuthProvider.tsx      # context: { user, token, signIn, signOut }
    │   └── useAuth.ts
    ├── routes/
    │   ├── LoginRoute.tsx
    │   ├── LobbyListRoute.tsx
    │   ├── CreateGameRoute.tsx
    │   ├── GameLobbyRoute.tsx    # /games/:gameId while status === "lobby"
    │   └── GameRoute.tsx         # /games/:gameId once started
    ├── components/
    │   ├── MapView/              # SVG map rendering
    │   │   ├── MapView.tsx
    │   │   ├── TileLayer.tsx
    │   │   ├── PathLayer.tsx
    │   │   └── CountryOverlay.tsx
    │   ├── ActionPanel/          # phase-aware action UI (setup, reinforcements, actions)
    │   ├── PlayerList.tsx
    │   ├── EventLog.tsx
    │   └── ui/                   # buttons, dialogs, toast, etc.
    ├── hooks/
    │   ├── useGameState.ts       # Apollo polling + visibility pause
    │   └── useMyPlayer.ts        # find the calling user's player in a snapshot
    ├── lib/
    │   ├── colors.ts             # consistent player colors from server hex codes
    │   └── format.ts
    └── styles/
        └── index.css             # Tailwind directives
```

## API integration

### GraphQL endpoint

Set in `.env`:

```
VITE_API_URL=http://localhost:8000
VITE_DEV_LOGIN=1
```

Apollo Client config (`src/api/apollo.ts`):
- HTTP link to `${VITE_API_URL}/graphql`.
- Auth link injecting `Authorization: Bearer ${localStorage.getItem("conquest.jwt")}` on
  every request. Skip the header on `/auth/*` REST calls.
- `errorLink` that detects `UNAUTHORIZED` extension codes from `IsAuthenticated` denials
  and redirects to `/login`.

### REST auth client

Plain `fetch` for the three REST endpoints. Don't try to send these through Apollo — they
aren't GraphQL, and the auth link has no token to attach yet.

### Codegen

`codegen.ts` points at the running API's schema (introspection) and generates:
- TypeScript types for every Pydantic-derived GraphQL type.
- Typed React hooks for each `.graphql` operation under `src/api/operations/`.

Run `pnpm codegen` after pulling new changes that touch the API schema.

### Server contract details

- All field names are `camelCase`.
- Player colors are `#rrggbb` strings; use them directly as `fill="..."`.
- `gameId`, `playerId`, `countryId`, `pathId`, `continentId` are opaque strings — never
  parse or compare structurally.
- Every mutation is **idempotent at the operation level only when documented**. Don't
  retry mutations on network failure without checking the resulting game state.
- Time is server-authoritative. Don't render relative timestamps on `createdAt`/`updatedAt`
  via `Date.now()` math without acknowledging clock skew.

## Page / route map

| Path                      | Auth | Component         | Purpose                                                    |
|---------------------------|------|-------------------|------------------------------------------------------------|
| `/login`                  | no   | `LoginRoute`      | Google + (dev) display-name sign-in                        |
| `/`                       | yes  | `LobbyListRoute`  | List joinable public games + my games                      |
| `/games/new`              | yes  | `CreateGameRoute` | Form: name, max players, public/private, optional config   |
| `/games/:gameId`          | yes  | `GameRoute`       | Auto-renders the right screen for the current game status  |
| `/games/:gameId/invite`   | yes  | shareable link    | Resolves to `/games/:gameId?invite=...`                    |

`GameRoute` is the dispatcher: it polls `game(gameId)`, then renders `GameLobbyScreen`,
`SetupScreen`, `GameScreen`, or `GameOverScreen` based on `game.status`. Don't put route-
level logic in any other component.

## State management

- **Server state:** Apollo cache. `pollInterval: 2000` while a game is active and the tab
  is visible.
- **Auth state:** React context (`AuthProvider`) wrapping `localStorage`. The token, user,
  and a `signOut()` method are exposed via `useAuth()`.
- **Ephemeral UI state:** `useState`. No Redux. No Zustand. The server-authoritative game
  state plus a few useState calls is enough — adding a global store creates two sources of
  truth for game state, which is exactly what we want to avoid.
- **Selected country / pending action:** local component state in `GameScreen`. Reset on
  every snapshot refresh.

## Local dev

```bash
# In the conquest-game repo:
poetry install
./scripts/run_local.sh        # API on :8000

# In conquest-game-web:
pnpm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000, VITE_DEV_LOGIN=1
pnpm codegen                  # generate types from running API
pnpm dev                      # web on :5173
```

Open `http://localhost:5173` → click **Dev login** → enter a name → land on the lobby list.

## Testing strategy

- **Component tests** (Vitest + RTL): every component that has branching (phase-aware
  `ActionPanel`, `MapView` with selection state) has a test. MSW stubs the GraphQL endpoint
  with realistic payloads.
- **Integration tests:** a "full lobby flow" test that mounts `<App/>` with MSW and walks
  Alice through login → create game → add AI seat → start game → place a setup troop, all
  via `userEvent`.
- **No E2E in v0.1.** Add Playwright if it ever earns its place.
- **No snapshot tests.** They rot; assert on what matters.

## Conventions

- **Imports:** absolute from `src/` via `@/...` alias. No deep relative imports.
- **Components:** one component per file, named export. No default exports except for
  route components used with React.lazy.
- **Hooks:** start with `use`; live under `src/hooks/` or co-located if used once.
- **Styling:** Tailwind utility classes. No CSS modules. No `styled-components`.
- **GraphQL operations:** one operation per `.graphql` file. Name queries `XxxQuery` and
  mutations `XxxMutation`. Codegen produces `useXxxQuery` / `useXxxMutation` hooks.
- **State updates:** never mutate Apollo cache results. Always destructure or copy.
- **Error handling:** every mutation result handled; every query loading + error state
  rendered. No bare `<Suspense>` fallbacks that hide problems.
- **No business logic in the client.** If you find yourself writing rules code (computing
  reinforcements, validating actions, deciding turn order), stop — that's a server bug
  report, not a client feature.

## Open design questions

- **Map rendering perf at 6 players.** Worst case is ~60×60 = 3,600 tiles. SVG with one
  rect per tile should hold up; revisit with `<canvas>` only if profiling shows pain.
- **Subscriptions.** When the API gains GraphQL subscriptions, swap out the polling in
  `useGameState`.
- **Reconnection / offline.** Out of scope for v0.1. Show a banner if Apollo's
  `networkStatus` flips to error.
- **Mobile layout.** Plan for mobile, ship desktop-first.
