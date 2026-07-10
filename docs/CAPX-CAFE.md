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
Inject `new HttpPlatformClient(process.env.PLATFORM_API_URL)` into canteen instead of
`FakePlatformClient`. Real posting also needs X/LinkedIn OAuth apps (**P8**, external keys).

## Status
- ✅ HTTP seam built + verified (suite 61/61).
- ✅ Fork cloned locally (`../capx-cafe`), AGPL `NOTICE` added, `origin` renamed to `upstream`
  (no accidental pushes to Postiz).
- ⬜ Live run of the fork + real `/public/v1/posts` mapping + OAuth — **P8** (needs keys).
