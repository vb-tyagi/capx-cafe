# capx-culture

Compliance-first, invite-only tooling to **launch and manage** Twitter/X + LinkedIn presences, with an AI recurring-posting feature (**Loops**) guarded by a six-layer **anti-slop framework** — the moat.

> Product spec: [docs/phase-1-prd.md](docs/phase-1-prd.md) · Build plan: [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md)

## Architecture — open-core

| 🔓 Open platform (AGPL — forked Postiz, separate repo) | 🔒 Closed services (this monorepo — proprietary) |
|---|---|
| OAuth/account connection, scheduling, publishing, platform adapters, calendar UI | Loops engine, AI content generation, **credit ledger**, **anti-slop guardrails**, identity/whitelist |

**Boundary rule:** closed services call the open platform over its API and are **never** compiled into the fork. ✅ Counsel validated this boundary (2026-07-10); CI enforces it.

## Monorepo layout

```
packages/
  core/            @capx/core            — shared domain types & constants
  guardrails/      @capx/guardrails      — the six-layer anti-slop engine (the moat)
  credits/         @capx/credits         — pay-per-use credit ledger + cost metering
  platform-client/ @capx/platform-client — arm's-length seam to the open platform (+ Fake)
  loops/           @capx/loops           — Loop tick: the publish chokepoint (gauntlet+credits+publish)
services/          — NestJS closed services (identity, loops, guardrail-api, credits-api) [scaffold]
apps/              — Next.js web app / BFF [scaffold]
prisma/            — closed Postgres schema (multi-tenant, RLS)
.github/           — CI (runs the package tests)
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
- `@capx/guardrails`, `@capx/credits`, `@capx/loops`, `@capx/config` are **dependency-free** and unit-tested — the parts needing zero external keys, so they ship first.
- **CI** (`.github/workflows/ci.yml`) runs the same `verify` gate on every push/PR.
