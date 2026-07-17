# @capx-cafe/chokepoint

The thin, stateless, self-hostable **Option-B chokepoint** — the only process that can decrypt an X token
or reach X. Full design + build order: [`docs/P1-CHOKEPOINT.md`](../../docs/P1-CHOKEPOINT.md).

**Status:** S0 scaffold (structure only; no wired behavior yet).

## What it holds
Token vault (KMS-envelope-encrypted) · hosted-callback PKCE OAuth (both lanes) · admission
(hashed-email allowlist + short-TTL session + kill-list) · x-adapter (internal, sole path to `POST /2/tweets`)
· the casserole-enforced publish gate · a durable outbox. All state in **one Postgres** (no Redis in P1).

## Ports (this machine)
- **4477** — chokepoint HTTP (`CHOKEPOINT_PORT`). _Confirm free before first bind._
- **5442** — self-host Postgres (host) → 5432 (container).

## Run (self-host, once the service boots — S3+)
```sh
# from services/chokepoint
docker compose up          # worker + Postgres, project = capx-chokepoint
```
Self-host also needs a **public HTTPS** `OAUTH_CALLBACK_URL` registered in your own X app, plus
`KMS_KEY_ID` (or a local key), `SESSION_SIGNING_KEY`, and a seeded hashed allowlist (§8). Minimal
self-host = BYO-only (no capx secret, no MoR, no counter).

## Test
```sh
pnpm --filter @capx-cafe/chokepoint test        # node --test over src/**/*.test.ts
pnpm --filter @capx-cafe/chokepoint typecheck
```
