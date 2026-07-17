# Product Map (updated 2026-07-14 — post-split + naming rotation)

Two independent products came out of the original build:

| Product | What | Repo |
|---|---|---|
| **culture** | Independent full UI product (Assisted Launch → Management → Loops). **Zero "capx".** | `../culture` (sibling — separate brand, own git, clean `@culture/*` copies). *Not covered here.* |
| **capx-cafe** | Umbrella for the **agent-native / plugin** track. **Scope OPEN.** | `capx-cafe/` (this repo) — see `STATE.md` + `PLUGIN-ARCHITECTURE.md`. |

## Inside the capx-cafe umbrella (hospitality theme)

| Component | Role | Source | Where |
|---|---|---|---|
| **capx-conductor** | X/LinkedIn posting, scheduling, analytics, UI — the **posting engine**. Holds OAuth tokens; does the actual posting. | 🔓 OPEN (AGPL) — Postiz fork | `../capx-conductor` (sibling repo) |
| **capx-chef** | AI content generation (abstraction + mock; real LLMs later). | 🔒 CLOSED | `@capx-cafe/chef` |
| **capx-canteen** | **Loops** — scheduled recurring posting; the publish chokepoint. | 🔒 CLOSED | `@capx-cafe/canteen` |
| **capx-casserole** | Six-layer anti-slop guard — the mandatory chokepoint (**the moat**). | 🔒 CLOSED | `@capx-cafe/casserole` |
| **capx-counter** | Credits / metering. | 🔒 CLOSED | `@capx-cafe/counter` |
| **capx-captain** | Identity / whitelist / roles / tenancy / kill-switch (**was `conductor`**). | 🔒 CLOSED | `@capx-cafe/captain` |

**Shared plumbing (not products):** `@capx-cafe/core` (types), `@capx-cafe/config` (env), `@capx-cafe/platform-client` — the **"waiter"** seam to capx-conductor.

## The one hard boundary (AGPL)
Only **capx-conductor** (the fork) is open (AGPL). Every closed component talks to it **only over HTTP** through `platform-client` — never compiled into the fork. **Lawyer-validated 2026-07-10.** Enforced by `tools/boundary-guard.mjs` (closed side) + a mirror guard inside the fork.

## ⚠️ How they interact — CONTINGENT on the open Option A/B decision
The original SaaS flow was: *Loop fires → capx-chef drafts → capx-casserole guards → capx-counter meters → ⟨waiter⟩ → capx-conductor publishes*; manual posts pass casserole via a pre-publish webhook. **The plugin pivot (STATE.md §4–§7) changes this** — the harness's own model may replace chef, counter may die (BYO-X-app), the publish target becomes the X API or a thin chokepoint. **Do not treat the old flow as locked** — it depends on the unmade Option A vs B decision (STATE.md §5.1).

## Naming index
café → the umbrella · **conductor → the posting engine (fork)** · chef → content · canteen → recurring (Loops) · casserole → quality guard · counter → pay · **captain → who boards (identity)**.
