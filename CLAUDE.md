# CLAUDE.md

Guidance for AI agents (Claude Code and similar) working in this repository.

## Overview

nodemap visualises cryptocurrency daemon nodes on a map. The backend is a TypeScript +
Express API that talks to the coin daemon over JSON-RPC; the frontend is a React 19 + Vite
app styled with Tailwind CSS 4. The server runs **directly with `tsx`** — there is no server
build step.

## Layout

- `server.ts` — the Express API (peer info, geolocation, reverse DNS). Run with `tsx`.
- `src/` — the React client (`main.tsx`, `App.tsx`, `index.css`).
- `site.config.ts` — the single source of user-editable config, shared by server and client
  (headings, table columns, map, footer, and `dnsOverrides`). Change text/branding here, not
  in the components.
- `test/` — Vitest + supertest tests (`server.test.ts`, `mockData.ts`).

## Commands

- `npm run dev` — API (`tsx watch`) + Vite dev server together.
- `npm run build` — build the production client into `dist/`.
- `npm start` — serve the built client + API (`tsx server.ts`).
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run format`.

## Before committing — run the full gate

Keep all of these green before committing:

```
npm run format:check && npm run typecheck && npm run lint && npm test && npm run build
```

## Conventions

- TypeScript strict. ESLint 10 flat config (`eslint.config.js`). Prettier: no semicolons,
  single quotes, 2-space indent, width 100, trailing commas. Match the surrounding style.
- Prefer the native `fetch` API over adding HTTP dependencies. RPC uses `fetch` +
  `AbortSignal.timeout` (honours `DAEMON_RPC_TIMEOUT`).

## Configuration (`.env`)

`DAEMON_RPC_HOST` / `PORT` / `USERNAME` / `PASSWORD` / `SSL` / `TIMEOUT`, `IPINFO_TOKEN`,
`DNS_SERVERS`, `CACHE_REFRESH_INTERVAL`, `PORT`, `VITE_DEV_PORT`. See the README for details.

## Implementation notes / gotchas

- **`extractIp` must stay idempotent.** `[v6]:port` → bare IPv6; a bare IPv6 (2+ colons) is
  returned unchanged. Re-extracting an already-bare address must be a no-op, or IPv6 reverse
  DNS breaks.
- **Reverse DNS** (`reverseDnsLookup`): tries the system resolver, then public resolvers
  (`DNS_SERVERS`, default `1.1.1.1,8.8.8.8`) because many hosts cannot answer IPv6 `ip6.arpa`
  PTR queries. Only a genuine NXDOMAIN/ENODATA is cached as empty; transient failures retry.
- **PTR overrides**: `site.config.ts` → `dnsOverrides`, keyed by bare IP (IPv4 or IPv6). IPv6
  matching is normalised for case and `::` compression via the URL parser.
- **Dark mode** is class-based (`html.dark`) with a no-flash inline script in `index.html`;
  `html` itself carries the themed background so the whole viewport — not just the centred
  container — follows the theme.
- Peer lookups run with bounded concurrency to avoid overwhelming the resolver.

## CI

GitHub Actions (`.github/workflows/node.js.yml`) runs the gate on Node 20 / 22 / 24. CircleCI
has been removed — do not reintroduce it.
