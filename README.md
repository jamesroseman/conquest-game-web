# Conquest Web

React/TypeScript client for [Conquest](https://github.com/jamesroseman/conquest-game), a
turn-based strategy game with a shared pandemic mechanic. The server is authoritative for
all game state; this client only renders snapshots and dispatches mutations.

## Quick start

```bash
# 1. Backend (in conquest-game/)
poetry install
./scripts/run_local.sh        # API on http://localhost:8000

# 2. This app
pnpm install
cp .env.example .env
pnpm dev                      # http://localhost:5173
```

Open http://localhost:5173, click **Continue** with a display name (dev login), create a
game, add an AI seat, hit start.

## Pointing at any backend

The API URL is resolved at runtime in this order (first match wins):

1. `localStorage["conquest.apiUrl"]` — set via the **API endpoint** panel on the login screen
2. `window.__CONQUEST_CONFIG__.apiUrl` — set in `public/config.js`, editable post-build
3. `VITE_API_URL` — baked into the build at compile time
4. `http://localhost:8000` — fallback default

This means **the same compiled bundle can talk to any backend**. Useful when:

- You're switching between localhost and a deployed API.
- A friend hosts a game and you want to point at their server without rebuilding.
- You're running multiple backends side-by-side in different browser profiles.

The login screen exposes a settings panel (collapsed by default) where you can paste any
URL and hit **Save** — subsequent GraphQL and REST requests pick it up immediately.

## Architecture

- **GraphQL:** Apollo Client against `${API_URL}/graphql`. Auth header injected from
  `localStorage["conquest.jwt"]` on every request.
- **REST auth:** plain `fetch` against `/auth/google`, `/auth/dev-login`, `/auth/me`.
- **Polling:** the active game query polls every 2s while the tab is visible and the
  game has not ended (see `src/hooks/useGameState.ts`).
- **Routing:** React Router v6.
  - `/login` — Google / dev login + API-URL settings
  - `/` — joinable games list
  - `/games/new` — create-game form
  - `/games/:gameId` — dispatcher; renders the right screen based on `game.status`
- **Map rendering:** SVG, one `<rect>` per tile, polylines for paths, labels and overlays
  on country centroids. Good enough for v0.1 — we'll revisit canvas if profiling demands.
- **State:** server-authoritative via Apollo cache. Auth in React context. Ephemeral UI
  bits (`selectedCountryId`, action mode) in `useState`.

See `CLAUDE.md` for the full architectural spec.

## Codegen

`pnpm codegen` introspects the running API at `VITE_API_URL/graphql` and emits typed
hooks under `src/api/__generated__/`. Until you run that, `src/api/types.ts` and
`src/api/operations.ts` are hand-written mirrors of the schema in
`conquest-game/src/conquest/api/`.

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `pnpm dev`        | Vite dev server on :5173                  |
| `pnpm build`      | TypeScript build + Vite production build  |
| `pnpm preview`    | Preview the production build              |
| `pnpm typecheck`  | `tsc -b --noEmit`                         |
| `pnpm lint`       | ESLint                                    |
| `pnpm format`     | Prettier write                            |
| `pnpm codegen`    | Regenerate typed GraphQL hooks            |
