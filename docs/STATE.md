# capx-cafe — STATE (handoff)

_Last updated 2026-07-14. In a fresh session, read this first, then `docs/PLUGIN-ARCHITECTURE.md`._

---

## 1. What capx-cafe is
The **umbrella** for the **agent-native track**. The idea: re-engineer the social-posting product into a
**Claude Code / Codex / Cursor plugin** (one portable **stdio MCP server**, optional Claude-Code skill
sugar). A whitelisted user does a **minimal login + connect-X** once; after that, all content creation /
scheduling / management happens **inside their agent session**, driven by the harness's own model. Goal:
**kill the central user database** — tokens + config live on the user's machine.

**⚠️ Scope is deliberately OPEN. Do not build assuming a direction — the core decision (below) is unmade.**

## 2. The three repos (post-split, post-rotation)
- **`capx-cafe/`** (this repo) — the monorepo umbrella. Was `capx-culture`; renamed (inherited its 17-commit git history).
- **`capx-conductor/`** (sibling) — the open **Postiz fork** = the posting engine. Was the folder `capx-cafe`; renamed. Its own git repo (`upstream` → gitroomhq/postiz-app), AGPL, 4.1 GB, Docker-based.
- **`culture/`** (sibling) — a **separate independent product** (full UI SaaS). Zero "capx"; shares nothing at runtime; got clean COPIES of the shared engines. **Leave it alone from here.**

### Naming rotation (what changed)
| Was | Now | What |
|---|---|---|
| `capx-culture` (monorepo) | **`capx-cafe`** | this umbrella |
| `capx-cafe` (fork folder) | **`capx-conductor`** | the Postiz posting engine |
| `@capx/conductor` (pkg) | **`@capx/captain`** | identity/whitelist engine ✅ renamed in code + tests |
| casserole, canteen, counter, chef, config, core, platform-client | *(unchanged)* | closed engines |

## 3. Current state (verified)
- **Monorepo:** 8 packages; `pnpm run verify` green = **boundary-guard (clean) + 64 unit tests + 4 guard self-tests + typecheck**.
  - casserole (six-layer anti-slop guard), canteen (Loops orchestrator + the publish chokepoint), counter (credit ledger), captain (identity/whitelist/roles/tenancy/kill-switch), chef (AI-gen abstraction + mock), platform-client (`FakePlatformClient` + `HttpPlatformClient`), config, core.
  - Also present (from the SaaS era): `prisma/` (closed multi-tenant schema + RLS), `tools/boundary-guard.mjs`, `.github/ci`, `docker-compose.yml` (Postgres/Redis for the closed side — distinct from the fork's stack).
- **Fork (`../capx-conductor`):** complete (6 apps, libraries, node_modules, .env), Docker containers were up (project pinned `capx-cafe`), **its dev servers were killed** during the repo reshuffle — restart per `docs/GO-LIVE.md`.

## 4. The Track-2 direction (from `docs/PLUGIN-ARCHITECTURE.md`)
- **Packaging:** one stdio MCP server working across Claude Code + Codex + Cursor; Claude-Code skills as optional sugar. **BYO-X-app** (user brings their own X developer app → they pay X, no capx API cost/token-custody).
- **Confirmed serverless (verified by research):** the whole **OAuth + refresh runs 100% on-device** (public PKCE client, `127.0.0.1` loopback, no secret — X's own `xurl` CLI proves it); **DB-less monetization** via merchant-of-record license keys + offline-verified Ed25519 tokens.
- **The four things that break "zero server"** (each wants a thin server): reliable scheduling (laptop-off), an *unbypassable* guardrail, instant abuse revocation, keeping the token out of the co-resident agent's reach.

## 5. 🔴 OPEN decisions — UNMADE, decide in the fresh session (do not assume)
1. **THE core decision: Option A (pure-local — token in local keychain, guardrail *advisory*/bypassable, best-effort scheduling) vs Option B (one thin, stateless, self-hostable hosted chokepoint — guardrail *enforced* at the X boundary, real scheduling laptop-off, real kill-switch; token in an encrypted server vault; still NO multi-tenant user DB). Recommended: B.** *(User was asked and deferred — still open. Everything downstream depends on it.)*
2. **BYO-X-app only, or add a capx-app trial lane** (which revives a slim `counter` for cost caps)?
3. **Scope honesty:** is this now a developer-audience, **X-only** assistant? (Killing the fork forecloses analytics/multi-platform/UI unless the chokepoint hosts them.)
4. **Legal:** sign-off on a proxy posting with the user's token + automated recurring posting under X's Developer Agreement.

## 6. 🔴 The critical flaw to get right (if this direction proceeds)
"The harness writes, casserole decides what ships" is **false in a pure-local design**: a live X token in the
local keychain is readable by the co-resident autonomous agent, other MCP servers, prompt-injected content,
or malware — they can post directly and **bypass casserole entirely**. The credential must be reachable
**only** through the casserole chokepoint (→ points at Option B: a hosted publish proxy where the token never
lands next to the agent). This is the single thing that makes-or-breaks the thesis.

## 7. Keep / Kill / Transform (what the plugin pivot implies — NOT yet executed)
KEEP: **casserole** (the moat; but it needs a live kill-switch input + to be the only path to the credential).
TRANSFORM: **canteen** (Loops: drop the credit step → guardrail→publish), **platform-client** (→ direct X client / chokepoint), **captain** (shrink to a stateless whitelist/allowlist + soft handle-cap), **chef** (demote — the harness model generates; mock stays for tests). KILL (if the pivot is taken): **capx-conductor/Postiz fork** (dissolves the whole AGPL boundary problem), **counter** (BYO = user pays X). *None of this is done — it's contingent on the §5.1 decision.*

## 8. capx-conductor (the fork) — careful handling & next steps
- **Location:** `../capx-conductor` (renamed from the old `capx-cafe` folder). Own git repo, `upstream` = Postiz.
- **Docker:** the Compose project name is **pinned to `capx-cafe`** (`name: capx-cafe` in `docker-compose.dev.yaml`), so the data volumes (`capx-cafe_postgres-volume`, `capx-cafe_redisinsight`, holding the dev schema / 48 tables) **stay associated after the folder rename** — no data loss. Always run compose from `../capx-conductor`.
- **Backend port moved to `:3006`** (your `parvani`/women-gym-app owns `:3000`); frontend `:4200`, orchestrator `:3002`. DB creds are `postiz-local` / `postiz-local-pwd` (the `.env.example` shipped wrong ones — already fixed in `.env`).
- **To run it:** see `docs/GO-LIVE.md` — `pnpm install` → `pnpm run dev:docker` → `PATH="$PWD/node_modules/.bin:$PATH" pnpm run --filter ./apps/backend --filter ./apps/frontend --filter ./apps/orchestrator --parallel dev` (skip the `extension` app; hoisted node-linker means dotenv lives in root `.bin`). UI at http://localhost:4200.
- **⚠️ Lesson (why it matters):** during this reshuffle a **running dev server recreated a stale path mid-rename** and nearly nested a repo. **Always stop the fork's dev servers before any folder move.**
- **AGPL boundary:** the fork stays generic Postiz — it carries a `NOTICE` + a mirror `tools/capx-boundary-guard.mjs` (fails if `@capx/*` leaks in). Closed code talks to it only over HTTP. Live integration (real `POST /public/v1/posts` mapping, OAuth keys) is **pending** (needs X/LinkedIn dev apps).

## 9. Docs in this repo
- `PLUGIN-ARCHITECTURE.md` — Track-2 direction + open decisions (current).
- `PRODUCT-MAP.md` — named products + boundaries (updated to the rotation).
- `CAPX-CAFE.md`, `GO-LIVE.md` — the fork's integration + run guide (paths updated to `../capx-conductor`).
- `BUILD-PLAN.md` — the original monorepo mega-sprint plan (capx-branded, historical; predates the plugin pivot).
- *(The product PRD moved to `../culture` — it's the culture product's spec.)*

## 10. Next steps
1. **Make the §5.1 decision (Option A vs B)** — nothing else in Track-2 should be built until this is settled.
2. Then follow PLUGIN-ARCHITECTURE §7 (P0 excise-or-keep fork → P1 local OAuth + `XApiClient` → P2 MCP server + cross-harness → P3 chokepoint/scheduling → P4 monetization → P5 plugin sugar).
3. Get the legal sign-off (§5.4) before any automated posting ships.
