# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.5.0-rc.1] - 2026-06-13

First pre-release of the modernised stack.

### Changed

- Rebuilt on **TypeScript 6** (strict), **React 19**, **Vite 8**, **Tailwind CSS 4**,
  **ESLint 10**, **Prettier 3** and **Vitest 4**. The server now runs directly with
  [tsx](https://tsx.is) (no build step), and the former `src/server` + `src/client`
  split is now `server.ts` + `src/` + a shared `site.config.ts`.
- Replaced **axios** with the native `fetch` API (honouring `DAEMON_RPC_TIMEOUT`).
  Removed `bitcoin-core`, `mocha` and `chai`.
- Centralised all user-facing text and branding in `site.config.ts`.

### Added

- Light / dark mode toggle (persisted, no flash on load) with dark map tiles
  (CARTO Dark Matter) that follow the theme.
- `DNS_SERVERS` env var: reverse lookups fall back to public resolvers (default
  `1.1.1.1,8.8.8.8`) when the host's own resolver can't answer IPv6 `ip6.arpa` PTR
  queries.
- `dnsOverrides` in `site.config.ts`: force the reverse-DNS hostname of specific
  IPv4/IPv6 addresses. IPv6 matching ignores case, leading zeros and `::` compression.
- Map marker pin configurable from `site.config.ts`.

### Fixed

- IPv6 reverse DNS: `[v6]:port` addresses are unwrapped correctly and bare IPv6 is no
  longer corrupted, so PTR hostnames resolve. Transient resolver failures are no longer
  cached as permanent empty results, and lookups are bounded in concurrency.
- Dark mode now paints the whole viewport, not just the centred container — wide screens
  are no longer white at the sides.

[0.5.0-rc.1]: https://github.com/ROZ-MOFUMOFU-ME/nodemap/releases/tag/v0.5.0-rc.1
