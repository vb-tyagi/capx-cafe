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
| `@capx-cafe/conductor` (pkg) | **`@capx-cafe/captain`** | identity/whitelist engine ✅ renamed in code + tests |
| casserole, canteen, counter, chef, config, core, platform-client | *(unchanged)* | closed engines |

## 3. Current state (verified)
- **Monorepo:** 8 packages; `pnpm run verify` green = **64 unit tests + typecheck**. *(P0, 2026-07-14: the AGPL boundary-guard + its 4 self-tests were unwired from `verify` — fork cold-archived per §5.5. `tools/boundary-guard.mjs` + `pnpm guard`/`guard:test` remain on disk, re-armable.)*
  - casserole (six-layer anti-slop guard), canteen (Loops orchestrator + the publish chokepoint), counter (credit ledger), captain (identity/whitelist/roles/tenancy/kill-switch), chef (AI-gen abstraction + mock), platform-client (`FakePlatformClient` + `HttpPlatformClient`), config, core.
  - Also present (from the SaaS era): `prisma/` (closed multi-tenant schema + RLS), `tools/boundary-guard.mjs`, `.github/ci`, `docker-compose.yml` (Postgres/Redis for the closed side — distinct from the fork's stack).
- **Fork (`../capx-conductor`):** complete (6 apps, libraries, node_modules, .env), Docker containers were up (project pinned `capx-cafe`), **its dev servers were killed** during the repo reshuffle — restart per `docs/GO-LIVE.md`.

## 4. The Track-2 direction (from `docs/PLUGIN-ARCHITECTURE.md`)
- **Packaging:** one stdio MCP server working across Claude Code + Codex + Cursor; Claude-Code skills as optional sugar. **BYO-X-app** (user brings their own X developer app → they pay X, no capx API cost/token-custody).
- **Confirmed serverless (verified by research):** the whole **OAuth + refresh runs 100% on-device** (public PKCE client, `127.0.0.1` loopback, no secret — X's own `xurl` CLI proves it); **DB-less monetization** via merchant-of-record license keys + offline-verified Ed25519 tokens.
  - *(2026-07-14: the research stands, but the chosen design moved both into the chokepoint — hosted-callback OAuth (§5.7) and folded license checks (§5.8). The on-device flow and the offline edge fn are NOT being built.)*
- **The four things that break "zero server"** (each wants a thin server): reliable scheduling (laptop-off), an *unbypassable* guardrail, instant abuse revocation, keeping the token out of the co-resident agent's reach.

## 5. Decisions — ALL ✅ LOCKED in the 2026-07-14 decision round (do not re-litigate)
1. **✅ Option B** — one thin, stateless, **self-hostable** hosted chokepoint: guardrail **enforced** at the X boundary, real scheduling laptop-off, real kill-switch; token in an encrypted server vault; still **NO** multi-tenant user DB. Option A (pure-local: token in keychain, guardrail advisory, best-effort scheduling) rejected — it makes the §6 flaw permanent.
2. **✅ Two lanes, both built now** — **BYO-X-app** (developer lane) *and* a **capx-owned-app lane** (the creator lane — not a "trial": creators never register dev apps). Revives a **slim `counter`** now (per-user metering + cost caps on the capx lane). Action items: register + pay for capx's own X app. Shared-app ToS blast radius is mitigated by chokepoint-enforced casserole + per-handle caps + kill-switch.
3. **✅ Scope: X-only v1, creators soon** — the build is X-only, but creator expansion is a near-term commitment (this drove decisions 2 and 6). Analytics / multi-platform = explicit chokepoint-roadmap later-items, not v1 promises.
4. **✅ Legal = ship-gate — CLEARED (2026-07-15).** Founder reports the legal team gave the green flag; the automated-posting ship-gate is lifted. Counsel brief that was reviewed: `docs/LEGAL-BRIEF.md` (BYO token-custody = novel; capx-app scheduler model = conventional; X Automation Rules for `create_loop`; consumer ToS/privacy for the creator lane). *(Keep the brief + any written sign-off on file.)*
5. **✅ Fork: cold-archive** — stop the Docker stack, `pg_dump` the dev schema to a shelf file, keep `../capx-conductor` cold on disk (own git repo, zero upkeep); excise the monorepo AGPL apparatus at P0; delete volumes only after the chokepoint posts for real.
6. **✅ Onboarding: full BYO wizard early (P1–P2)** — hosted guided page (screenshots, deep links, pre-filled callback — the chokepoint serves it) + in-flow preflight validation with specific fix messages. The creator lane needs no wizard (no registration at all).
7. **✅ OAuth: hosted-callback only** — the chokepoint holds the PKCE verifier + HTTPS callback; consent works from any browser on any device; **the token never touches the user's machine** — no keychain, no pinned port, no loopback flow at all. Cross-harness promise = identical tool surface; capability detection only picks auto-open-browser vs print-URL.
8. **✅ License verification folds into the chokepoint** — MoR webhooks → allowlist of email hashes + subscription state; short-TTL session creds with a cached grace window. The separate Ed25519 offline edge fn (an Option-A artifact) is dropped. MoR pick (Lemon Squeezy vs Polar) deferred to a P4 bake-off; creator-lane pricing must cover capx's metered X API cost.
9. **✅ SOFTWARE LICENSING — LOCKED 2026-07-18.** Two-license split by half:
   - **Permissive (client + everything it bundles + skills/docs/guides):** the published `capx-cafe`
     package (`apps/capx-mcp`), and the shared packages it inlines — `@capx-cafe/core`, `@capx-cafe/config`,
     `@capx-cafe/platform-client` — plus all skills, tool-use, guides, and docs. *(Non-negotiable CONSTRAINT,
     not a preference: the permissive client bundle legally cannot contain copyleft code, so these three
     shared packages MUST be permissive.)* Permissive flavour (MIT vs Apache-2.0) still to pin at publish —
     Apache-2.0 recommended for its patent grant.
   - **AGPL-3.0 (the server half / the moat):** `services/chokepoint` and the server-only packages it
     compiles in — **`@capx-cafe/casserole`**, `@capx-cafe/captain`, `@capx-cafe/counter`, `@capx-cafe/canteen`,
     `@capx-cafe/chef`. A network-service user must open-source their modifications. (capx is never bound by
     its own license — dual-licensing stays available.)
   - **casserole = AGPL-3.0** (answer to the founder's Q): it is server-only (never in the permissive client
     bundle — verified: the client depends on core/config/platform-client, not casserole), and it is the
     guardrail moat, so copyleft-protecting it is both natural and correct. Tradeoff accepted: this weakens
     the "casserole as a free drop-in library for CLOSED commercial products" hook — OSS/self-host reuse
     still works fine; only a closed competitor embedding it is deterred, which is the point.
   - **Still open (not blocking):** exact permissive flavour (MIT/Apache), a **CLA/DCO** before the first
     outside PR (keeps relicensing possible), and **trademark** on "capx café" (the truly un-forkable moat —
     license governs code, never the name).
10. **✅ ROUND-2 LOCKS — 2026-07-18 (skills / media / GTM).** Detail in `docs/SKILLS-PLAN.md` + `docs/GTM-PLAN.md`.
    - **Permissive flavour = MIT** (founder pick; over Apache-2.0).
    - **Skills:** build ALL write-skills (coding-context + voice/quality + scheduling intelligence), authored
      for **all agents up front** (canonical `SKILL.md` → Claude Code / Cursor / Codex / Windsurf). **Tier-3
      read-skills (analytics, reply-draft, mention-triage) are SPUN OUT** to a separate independent read-side
      product ("capx-scope", TBD) — clean seam: **capx-cafe = write, capx-scope = read.**
    - **Media IN v1 = images + video.** capx **generates nothing** — the user connects their **own** media-gen
      MCP servers (higgsfield / fal / kling / …) to their agent; capx ships **skills that (a) guide connecting
      those MCPs, (b) pick the right model for the job, (c) prompt-engineer great output** (image-director,
      video-director, prompt-engine, model-guide), then capx **uploads + attaches** to the post (X chunked
      upload). **CLARIFIED 2026-07-18 (founder):**
        · **casserole does NOT touch media** — no gate, no review, no audit; all media passes by default. The
          post's **caption text is still guarded** by casserole; the asset rides along un-inspected. (Deliberate:
          capx does not moderate media content — the user owns what they attach.)
        · **AI-labeling is a SKILL responsibility** — the agent sets the AI-content label before upload; capx
          just carries the flag to X. casserole's dormant L3-AI-graphic-HOLD + L6-aiLabelRequired logic stays
          unused (never fired anyway — the gate only ever produced TEXT drafts).
        · Build impact: the media pipeline (Phase 4) is just upload+attach+carry-label — no casserole wiring,
          no HOLD path. Intelligence lives in the markdown director/prompt skills.
    - **GTM launch shape = FEATURE-RICH** — build write-skills + media first, THEN publish + launch with a wow.
    - **GTM defaults locked** (were recommend-by-default, no objection): repo → a `capx` GitHub org before
      public; **CLA** before the first outside PR; register the **"capx café" trademark**; docs in-repo `/docs`
      first, dedicated site at launch.

## 6. 🔴 The critical flaw to get right (if this direction proceeds)
"The harness writes, casserole decides what ships" is **false in a pure-local design**: a live X token in the
local keychain is readable by the co-resident autonomous agent, other MCP servers, prompt-injected content,
or malware — they can post directly and **bypass casserole entirely**. The credential must be reachable
**only** through the casserole chokepoint (→ points at Option B: a hosted publish proxy where the token never
lands next to the agent). This is the single thing that makes-or-breaks the thesis.

**✅ Resolved by §5.1 + §5.7 (2026-07-14):** with hosted-callback OAuth the token *only ever exists* in the
chokepoint's vault — it never touches the user's machine — and every publish passes casserole at the X boundary.

## 7. Keep / Kill / Transform (what the plugin pivot implies — NOT yet executed)
KEEP: **casserole** (the moat; gets its live kill-switch input and runs at the chokepoint's X boundary — the only path to the credential).
TRANSFORM: **canteen** (Loops: guardrail→publish; metering step only on the capx-app lane), **platform-client** (→ chokepoint client), **captain** (shrink to stateless whitelist/allowlist + handle-cap, enforced chokepoint-side), **chef** (demote — the harness model generates; mock stays for tests), **counter** (slim revival NOW — per-user metering + cost caps for the capx-app lane, §5.2). KILL: **capx-conductor/Postiz fork** (cold-archive per §5.5 — dissolves the whole AGPL boundary problem). *None of this is executed yet — all §5 decisions are locked (2026-07-14); the revised phase plan is §10.*

## 8. capx-conductor (the fork) — careful handling & next steps
- **🗄️ P0 cold-archive status (2026-07-14):** decided KILL→cold-archive (§5.5). Done: stray fork frontend dev server (`next-server`, was orphaned on `:4200` since the reshuffle) **stopped**; ports 4200/3006/3002 all clear; Docker daemon is **down** so the stack isn't running; monorepo AGPL apparatus **unwired** (boundary-guard out of `verify`, fork docs banner-marked historical). **Deferred (Docker daemon down + not yet needed — volumes are safe on disk and §5.5 gates deletion to "after the chokepoint posts for real"):** the `pg_dump` shelf backup. Run it next time Docker is up, and **mandatorily** before ever deleting the volume:
  ```sh
  # from ../capx-conductor, with the stack up (pnpm run dev:docker):
  docker exec postiz-postgres pg_dump -U postiz-local postiz-db-local \
    > ../capx-cafe/docs/_archive/capx-conductor-devdb-2026-07-14.sql   # volume: capx-cafe_postgres-volume
  ```
- **Location:** `../capx-conductor` (renamed from the old `capx-cafe` folder). Own git repo, `upstream` = Postiz.
- **Docker:** the Compose project name is **pinned to `capx-cafe`** (`name: capx-cafe` in `docker-compose.dev.yaml`), so the data volumes (`capx-cafe_postgres-volume`, `capx-cafe_redisinsight`, holding the dev schema / 48 tables) **stay associated after the folder rename** — no data loss. Always run compose from `../capx-conductor`.
- **Backend port moved to `:3006`** (your `parvani`/women-gym-app owns `:3000`); frontend `:4200`, orchestrator `:3002`. DB creds are `postiz-local` / `postiz-local-pwd` (the `.env.example` shipped wrong ones — already fixed in `.env`).
- **To run it:** see `docs/GO-LIVE.md` — `pnpm install` → `pnpm run dev:docker` → `PATH="$PWD/node_modules/.bin:$PATH" pnpm run --filter ./apps/backend --filter ./apps/frontend --filter ./apps/orchestrator --parallel dev` (skip the `extension` app; hoisted node-linker means dotenv lives in root `.bin`). UI at http://localhost:4200.
- **⚠️ Lesson (why it matters):** during this reshuffle a **running dev server recreated a stale path mid-rename** and nearly nested a repo. **Always stop the fork's dev servers before any folder move.**
- **AGPL boundary:** the fork stays generic Postiz — it carries a `NOTICE` + a mirror `tools/capx-boundary-guard.mjs` (fails if `@capx-cafe/*` leaks in). Closed code talks to it only over HTTP. Live integration (real `POST /public/v1/posts` mapping, OAuth keys) is **pending** (needs X/LinkedIn dev apps).

## 9. Docs in this repo
- `PLUGIN-ARCHITECTURE.md` — Track-2 direction + open decisions (current).
- `PRODUCT-MAP.md` — named products + boundaries (updated to the rotation).
- `CAPX-CAFE.md`, `GO-LIVE.md` — the fork's integration + run guide (paths updated to `../capx-conductor`; historical once §5.5's cold-archive executes).
- `LEGAL-BRIEF.md` — counsel brief for the two-lane posting compliance sign-off (§5.4; the ship-gate).
- `P1-CHOKEPOINT.md` — the P1 architecture + build spec (designed + adversarially reviewed 2026-07-15; supersedes PLUGIN-ARCHITECTURE §7's P1 sketch).
- `BUILD-PLAN.md` — the original monorepo mega-sprint plan (capx-branded, historical; predates the plugin pivot).
- *(The product PRD moved to `../culture` — it's the culture product's spec.)*

## 10. Status + next steps (under the locked §5 decisions)

**✅ BUILT & VERIFIED (2026-07-15, branch `track2/decision-lock-and-p0`, `pnpm verify` = 153 tests + tsc):**
- **P0** — fork cold-archived + AGPL boundary-guard unwired from `verify` (`../capx-conductor` stays cold on disk).
- **P1 (S0–S7)** — the full chokepoint per [`docs/P1-CHOKEPOINT.md`](P1-CHOKEPOINT.md): vault (AES-256-GCM envelope), admission (allowlist/session+grace/kill-list), hosted-callback PKCE OAuth (account-binding), vault-backed x-adapter, crash-consistent refresh→needs-reauth, **casserole enforced at the publish boundary**, durable idempotent outbox, recent-post cache, lane-B metering, HTTP service, and the `@capx-cafe/mcp` stdio server (`connect_x`/`whoami`/`post_now`, credential-free). Red-team suite proves the §6 flaw is defended.
- **Post-P1 GA hardening** — `PostgresStore` + `migrations/001_init.sql` (verified vs pg-mem AND real Postgres 17); real X API v2 wiring (`httpTokenExchange`/`httpRefreshExchange`/`httpIdentity`); **`services/chokepoint/src/serve.ts`** deployable binary (booted against real Postgres: `/healthz` ok, `/session` unallowlisted→403).

**⏭️ REMAINING (code):** P3 scheduling — `create_loop` + the outbox POLLER (durable primitive + idempotency already exist). Later: P4 monetization (MoR), P5 plugin sugar, the BYO onboarding wizard (§5.6).

**🔴 EXTERNAL GATES (not code — founder actions):**
1. ~~**Legal ship-gate (§5.4)**~~ ✅ **CLEARED 2026-07-15** — legal team gave the green flag; automated posting is unblocked (keep the brief + written sign-off on file).
2. **Register the two X apps (§5.2):** capx-app (confidential → `X_CLIENT_ID`+`X_CLIENT_SECRET`) + a BYO test app (public client id); callback = the hosted HTTPS `OAUTH_CALLBACK_URL`.
3. **Provision hosting:** a host + managed Postgres + HTTPS domain; set `serverEnvSchema` env (VAULT_DB_URL, KMS_KEY_ID, SESSION_SIGNING_KEY, ADMIN_API_KEY, OAUTH_CALLBACK_URL, optional X_CLIENT_ID/SECRET); deploy `serve.ts`.
4. **Git remote / PR:** no remote is configured yet — add one, push `track2/decision-lock-and-p0`, open the PR (30 commits). Then a live connect+post against real X.
