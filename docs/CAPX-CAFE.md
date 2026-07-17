> **🗄️ HISTORICAL (P0, 2026-07-14):** the Postiz fork is **cold-archived** (STATE §5.1/§5.5). The AGPL open/closed boundary described below is **moot** — no forked copyleft code ships; the boundary-guard was unwired from `verify` at P0 (tool kept on disk, re-armable). Kept for reference only. Live plan: **STATE §10**.
>
> **⚠️ Naming update (2026-07-14):** this guide predates the repo rotation. Here **"capx-cafe" = the Postiz fork**, now the sibling repo **`../capx-conductor`** (run all fork commands from there). The closed monorepo (formerly "capx-culture") is now **this** repo, `capx-cafe`. Authoritative current fork run + handling: **`docs/STATE.md` §8**.

# capx-cafe — the open platform (Postiz fork) & how the closed side talks to it

## What it is
**capx-cafe** = our fork of **Postiz** (AGPL-3.0), the **OPEN** product: X + LinkedIn
posting, scheduling, analytics, calendar/composer UI. It lives in a **separate repo**
(`../capx-cafe`) and is **never** merged into this closed monorepo.

## The boundary (lawyer-validated 2026-07-10)
- capx-cafe is the **only** open (AGPL) component.
- The closed monorepo talks to it **only over HTTP**, via `@capx/platform-client`.
- No closed code is compiled into the fork; no fork source is imported here.
- `tools/boundary-guard.mjs` enforces this on every build.
- AGPL obligations for the fork: publish Corresponding Source, keep `NOTICE` +
  attribution, document modifications. (The fork carries `NOTICE` + `CAPX-CAFE.md`.)

## The seam (built + verified ✅)
`@capx/platform-client` exposes:
- `PlatformClient` — the interface (`publish(req)`).
- `FakePlatformClient` — dev/test double (zero keys).
- `HttpPlatformClient(baseUrl, { serviceToken })` — the **real** seam, verified against
  a live local HTTP server in `packages/platform-client/test/http.test.ts`.

`capx-canteen` uses whichever `PlatformClient` is injected, so swapping
`Fake → Http` is a one-line change.

## Mapping to Postiz's real API (pending live integration — P8)
`HttpPlatformClient` currently speaks a simple contract (`POST {baseUrl}/api/posts`),
verified against a stub. For a real capx-cafe, point it at Postiz's public API:
- **`POST /public/v1/posts`** (see `apps/backend/src/public-api/routes/v1/` in the fork).
- auth: Postiz **API key**.
- build Postiz's post DTO from `PublishRequest`.

Keeping that translation inside `HttpPlatformClient` (closed side) keeps the fork
**100% generic** — best for AGPL cleanliness and clean upstream merges.

## Run the fork locally
```bash
cd ../capx-cafe
pnpm install
docker compose -f docker-compose.dev.yaml up -d   # Postgres + Redis
# configure .env per the Postiz README
pnpm dev                                           # fork API + UI
```

## Then wire it
canteen depends only on the `PlatformClient` interface, so wiring is an **env change**, not a code change:
```ts
import { createPlatformClient } from '@capx/platform-client';
const platform = createPlatformClient({
  mode: process.env.PLATFORM_MODE as 'fake' | 'http', // 'fake' (default) | 'http'
  baseUrl: process.env.PLATFORM_API_URL,
  serviceToken: process.env.PLATFORM_SERVICE_TOKEN,   // capx-cafe API key
  postsPath: process.env.PLATFORM_POSTS_PATH,         // '/public/v1/posts' for Postiz's public API
});
```
Set `PLATFORM_MODE=http` + the token to go live. Real posting also needs X/LinkedIn OAuth apps
(**P8**, external keys).

## Status
- ✅ HTTP seam built + verified (suite 64/64) — now **configurable** (posts path + auth header) with a
  `createPlatformClient` factory that flips Fake↔Http from `PLATFORM_MODE`.
- ✅ Fork cloned locally (`../capx-cafe`), AGPL `NOTICE` added, `origin` renamed to `upstream`, and a
  **mirror boundary-guard** added to the fork (`tools/capx-boundary-guard.mjs`, 710 files clean).
- ⬜ Live run of the fork + real `/public/v1/posts` mapping + OAuth — **P8** (needs keys). See the run guide.
