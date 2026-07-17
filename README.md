# capx-culture

Compliance-first, invite-only tooling to **launch and manage** Twitter/X + LinkedIn presences, with an AI recurring-posting feature (**Loops**) guarded by a six-layer **anti-slop framework** — the moat.

> Product spec: [docs/phase-1-prd.md](docs/phase-1-prd.md) · Build plan: [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) · Product map: [docs/PRODUCT-MAP.md](docs/PRODUCT-MAP.md)

## Architecture — open-core

| 🔓 **capx-cafe** — open (AGPL, forked Postiz, separate repo) | 🔒 Closed products (this monorepo — proprietary) |
|---|---|
| X + LinkedIn posting, scheduling, analytics, calendar UI; holds the OAuth tokens | **capx-canteen** (Loops) · **capx-chef** (AI content gen) · **capx-casserole** (anti-slop guard) · **capx-counter** (credits) · **capx-conductor** (identity/whitelist) |

**Boundary rule:** closed services call the open platform over its API and are **never** compiled into the fork. ✅ Counsel validated this boundary (2026-07-10); CI enforces it.

## Monorepo layout

```
packages/
  core/            @capx-cafe/core            — shared domain types & constants
  casserole/       @capx-cafe/casserole       — capx-casserole: anti-slop six-layer guard (the moat)
  counter/         @capx-cafe/counter         — capx-counter: pay-per-use credit ledger + metering
  canteen/         @capx-cafe/canteen         — capx-canteen: Loops publish chokepoint (guard+credits+publish)
  conductor/       @capx-cafe/conductor       — capx-conductor: identity/whitelist/roles/tenancy gate
  chef/            @capx-cafe/chef            — capx-chef: AI content generation (ContentProvider + mock)
  platform-client/ @capx-cafe/platform-client — arm's-length seam to capx-cafe (the open fork) (+ Fake)
  config/          @capx-cafe/config          — fail-fast env validation
services/          — closed service wrappers (NestJS) [scaffold]
apps/              — Next.js web app / BFF [scaffold]
prisma/            — closed Postgres schema (multi-tenant, RLS)
.github/           — CI (verify gate)
```

## Dev

Requires Node ≥ 22.6 (runs `.ts` natively via type-stripping — no build step for the pure packages).

```bash
pnpm install               # dev toolchain (typescript, prisma, node types)
docker compose up -d       # local Postgres (:5433) + Redis (:6380)
pnpm run verify            # boundary-guard + all unit tests + guard self-tests + typecheck
pnpm run guard             # AGPL open/closed boundary guard only
pnpm test                  # unit tests only (native TS, no build)
pnpm exec prisma validate  # validate the closed DB schema
```

- **Dev port:** the web/BFF runs on **4343** (capx 43xx convention; see `.env.example`).
- `@capx-cafe/casserole`, `@capx-cafe/counter`, `@capx-cafe/canteen`, `@capx-cafe/conductor`, `@capx-cafe/chef`, `@capx-cafe/config` are **dependency-free** and unit-tested — the parts needing zero external keys, so they ship first.
- **The full autonomous-Loop pipeline runs end-to-end keyless:** brief → capx-chef (mock) → capx-casserole → capx-counter → capx-cafe (Fake) — see `packages/canteen/test/e2e.test.ts`.
- **CI** (`.github/workflows/ci.yml`) runs the same `verify` gate on every push/PR.
