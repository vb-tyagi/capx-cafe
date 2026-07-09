# capx-culture

Compliance-first, invite-only tooling to **launch and manage** Twitter/X + LinkedIn presences, with an AI recurring-posting feature (**Loops**) guarded by a six-layer **anti-slop framework** — the moat.

> Product spec: [docs/phase-1-prd.md](docs/phase-1-prd.md) · Build plan: [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md)

## Architecture — open-core

| 🔓 Open platform (AGPL — forked Postiz, separate repo) | 🔒 Closed services (this monorepo — proprietary) |
|---|---|
| OAuth/account connection, scheduling, publishing, platform adapters, calendar UI | Loops engine, AI content generation, **credit ledger**, **anti-slop guardrails**, identity/whitelist |

**Boundary rule:** closed services call the open platform over its API and are **never** compiled into the fork. Counsel must bless this line before shipping.

## Monorepo layout

```
packages/
  core/        @capx/core       — shared domain types & constants
  guardrails/  @capx/guardrails — the six-layer anti-slop engine (the moat)
  credits/     @capx/credits    — pay-per-use credit ledger + cost metering
services/      — NestJS closed services (identity, loops, guardrail-api, credits-api) [scaffold]
apps/          — Next.js web app / BFF [scaffold]
prisma/        — Postgres schema (multi-tenant, RLS) [scaffold]
```

## Dev

Requires Node ≥ 22.6 (runs `.ts` natively via type-stripping — no build step for the pure packages).

```bash
npm test              # run all package unit tests
npm run test:credits
npm run test:guardrails
```

`@capx/guardrails` and `@capx/credits` are **dependency-free** and fully unit-tested — they are the parts of the product that need zero external API keys, so they ship first.
