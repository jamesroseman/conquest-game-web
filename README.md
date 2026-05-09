# Conquest Web

React + TypeScript + Vite client for the [Conquest](https://github.com/jamesroseman/conquest-game) GraphQL API.

See `CLAUDE.md` for the full architecture, gameplay rules the client must surface, and the
contract with the API.

## Quickstart

```bash
pnpm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000, VITE_DEV_LOGIN=1
pnpm dev                      # http://localhost:5173
```

Run the API in the sibling repo on `:8000` first.

## Scripts

- `pnpm dev` — Vite dev server
- `pnpm build` — typecheck + production build to `dist/`
- `pnpm typecheck` — TS only, no build
- `pnpm lint` — ESLint
- `pnpm test` — Vitest, run once
- `pnpm test:watch` — Vitest watch mode
- `pnpm format` — Prettier

## Layout

```
src/
├── main.tsx                   # entry
├── App.tsx                    # router + ApolloProvider + AuthProvider
├── api/
│   ├── apollo.ts              # Apollo Client + auth-link
│   ├── auth.ts                # REST client for /auth/*
│   ├── operations.ts          # GraphQL queries/mutations
│   └── types.ts               # hand-written Conquest API types
├── auth/                      # AuthProvider, useAuth, token storage
├── routes/                    # LoginRoute, LobbyListRoute, CreateGameRoute, GameRoute
├── screens/                   # GameLobby, Setup, Game, GameOver
├── components/
│   ├── AppShell.tsx
│   ├── PlayerList.tsx
│   ├── ActionPanel/
│   └── MapView/               # SVG renderer
├── hooks/                     # useGameState, useMyPlayer
└── lib/                       # colors, format helpers
```

`src/api/types.ts` is hand-written today; once the API is reachable from CI, swap it out for
`graphql-codegen` output as `CLAUDE.md` describes.
