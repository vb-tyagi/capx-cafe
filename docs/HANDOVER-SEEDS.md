# capx-cafe — Handover Seeds (living notes)

_Purpose: a running capture of hard-won facts, foot-guns, and deferred work, so nothing gets lost
before the real handover doc is written. Append as you go; graduate items into the final handover later.
Last touched: 2026-07-17._

---

## 🔫 Foot-guns — things that WILL bite the next person who touches this

These are ranked by "how much time it costs when you hit it cold." Each is: **symptom → cause → fix.**

### 1. ✅ RESOLVED — the workspace:* publish trap (was: `npx @capx-cafe/mcp` crashes)
**Kept as the top entry because the fix must not be undone — anyone editing the MCP package's deps can re-open it.**
- **Was the trap:** `apps/capx-mcp` depends on `@capx-cafe/{core,config,platform-client}` via `workspace:*`, which resolves ONLY inside this monorepo (and those packages are `private: true`). A naive publish crashes for a stranger with `Cannot find module '@capx-cafe/core'` — invisible in dev/CI (both run inside the workspace), a hard blocker the instant you distribute.
- **Fix (done, 2026-07-18):** `apps/capx-mcp/build.mjs` (esbuild) **inlines** those three private engines into one `dist/capx-cafe.mjs`, keeps `@modelcontextprotocol/sdk` + `zod` external, and emits `dist/package.json` named **`capx-cafe`** (unscoped). Verified by `npm pack` → install into a clean temp project (no monorepo) → the bin runs standalone.
- **To publish:** `pnpm --filter @capx-cafe/mcp build` → `cd apps/capx-mcp/dist && npm publish`. **Before the FIRST publish:** (a) pick a real `license` (currently `UNLICENSED` placeholder in build.mjs), (b) `npm login`, (c) bump `version`.
- **Do NOT** revert to publishing `apps/capx-mcp` directly, and do NOT `pnpm publish` the four packages — that re-opens the trap and leaks the closed engines.

### 2. `/healthz` is reserved by Google's frontend on Cloud Run
- **Symptom:** container is provably healthy and listening, but every probe of `/healthz` returns Google's own HTML 404 (no `server:` / `x-cloud-trace-context` header). Looks dead for ~40 min; you chase phantom causes.
- **Cause:** the Google Front End intercepts the literal path `/healthz` and answers it itself; the request never reaches your container. `GET /anything-else` returns your app's JSON.
- **Fix (done):** liveness path is **`/health`**; `/healthz` kept as a local/self-host alias only. Comment in `server/router.ts` warns against re-picking `/healthz`.

### 3. Cloud SQL defaults to ENTERPRISE_PLUS on new projects (~$200/mo vs ~$9)
- **Symptom:** `gcloud sql instances create --tier=db-f1-micro` errors `Invalid Tier (db-f1-micro) for (ENTERPRISE_PLUS) Edition`.
- **Cause:** new projects default to Enterprise Plus, which rejects the cheap shared-core tiers and wants `db-perf-optimized-N-*` (expensive).
- **Fix (done):** pass `--edition=ENTERPRISE` explicitly to allow `db-f1-micro`. **Had this error silently auto-corrected upward, the bill would be ~20x.**

### 4. Cloud Build's default SA has no permissions on new projects
- **Symptom:** `gcloud builds submit` → `403 …-compute@developer.gserviceaccount.com does not have storage.objects.get` on its OWN source upload.
- **Cause:** builds default to the Compute Engine default SA, which is unprivileged on freshly-created projects.
- **Fix (done):** run builds as the scoped robot: `--service-account=…claude-capx-cafe@…` (needs `roles/logging.logWriter` on the robot + `logging: CLOUD_LOGGING_ONLY` in `cloudbuild.yaml`).

### 5. Cloud Run RUNTIME identity ≠ the DEPLOY identity
- **Symptom:** deploy succeeds, container boots, then dies: `ECONNREFUSED /cloudsql/…` / `missing permission cloudsql.instances.get`.
- **Cause:** the service runs as the Compute Engine default SA at runtime, NOT as whoever deployed it. The robot's `cloudsql.admin` is irrelevant to the running process.
- **Fix (done):** dedicated runtime SA `capx-chokepoint-run@…` with **exactly one role** (`roles/cloudsql.client`), passed via `--service-account` on `run deploy`. Least privilege: the process holding X tokens can reach the DB and nothing else.

### 6. `status.url` on a new Cloud Run service can return a stale/legacy hostname
- **Symptom:** `gcloud run services describe --format='value(status.url)'` returns a `…-<hash>-<region>.a.run.app` URL that 404s, while `run deploy`'s own printed "Service URL" (`…-<projectnum>.<region>.run.app`) is the live one.
- **Fix:** trust the URL printed by `run deploy`, or `status.address.url`; verify with a real `curl /health` before wiring it anywhere (esp. `OAUTH_CALLBACK_URL`).

### 7. Empty-variable interpolation set a garbage OAuth callback
- **Symptom:** container refuses to boot: `OAUTH_CALLBACK_URL must be a valid URL (got "/oauth/callback")`.
- **Cause:** deploy script did `--update-env-vars=OAUTH_CALLBACK_URL=${URL}/oauth/callback` while `$URL` was empty (a prior deploy had failed).
- **Silver lining:** the S1 fail-fast env validation caught it — the service refused to run with a broken callback rather than half-working. Keep that validation.
- **Fix:** only set the callback AFTER a deploy that produced a non-empty URL; hard-fail the script if `$URL` is empty.

---

## 📦 Deferred work (phase status as of 2026-07-17)

**P0 ✅ · P1 ✅ · P2 ✅ · P3 ✅ · P4 ⏸ (deferred) · P5 ✅**  — the only thing between "built" and "anyone
can install it" is one `npm publish` of the `capx-cafe` bundle (needs your npm login + a license choice).

### P4 — Monetization (⏸ EXPLICITLY DEFERRED 2026-07-18, at founder's call)
Turns "founder curls `/admin/allow` per person" into "pay → in, cancel → out."
- **MoR choice is UNMADE — decide first.** Lemon Squeezy vs Polar (bake-off deferred per decision §5.8). (superseded: MoR = Polar, 2026-08-29)
  The choice gates the code: each MoR signs webhooks differently, so the signature-verification impl can't
  be written until it's picked. (Founder chose to punt the decision on 2026-07-18.)
- Then wire the MoR webhook → `ingestAllowlist`. **Today `ingestAllowlist`'s signature check is a STUB and
  nothing calls it** — that's the P4 hole. Add subscribe→allowlist-add and cancel/refund→allowlist-remove.
- Pricing MUST cover capx's metered X cost, because on lane B **capx pays X per post**.
- **Interim reality:** billing = the founder running `POST /admin/allow` by hand. Fine for a private alpha;
  a hard blocker for self-serve signups.

### P5 — Claude Code plugin sugar (✅ DONE 2026-07-18)
Plugin built at `plugins/capx-cafe/` + marketplace at `.claude-plugin/marketplace.json`:
- `plugin.json` manifest; `.mcp.json` launches the server via `npx -y capx-cafe`.
- 4 slash commands: `/capx-cafe:connect | post | loop | status` (`commands/*.md`).
- **No install-time secret prompt exists in Claude Code** (confirmed against current docs). So `CAPX_EMAIL`
  + `X_CLIENT_ID` come from `~/.capx/config.json` (the server already reads that file layer); documented in
  the plugin README. `CAPX_CHOKEPOINT_URL` is baked (overridable in the file for self-hosters).
- **Gated on npm publish:** the plugin's `.mcp.json` uses `npx -y capx-cafe`, so it only works once the
  bundle is published (foot-gun #1 recipe). Until then, the founder's local repo `.mcp.json` is the path.
- Install: `/plugin marketplace add https://github.com/vb-tyagi/capx-cafe` → `/plugin install capx-cafe@capx-cafe`.

### npm publish of `capx-cafe` — unblocked (bundle done), pending your npm login + license
`pnpm --filter @capx-cafe/mcp build` → `cd apps/capx-mcp/dist && npm publish`. Pick a license first
(currently `UNLICENSED` placeholder). This is the ONE step that makes both the plugin and `npx capx-cafe` live.

---

## ⚠️ Live-service risks you now own (lane B is on)

- **Metering cap is UNSET → lane B is uncapped.** capx pays X for every capx-app-lane post; an uncapped lane can run up cost / burn the shared app's X quota. Set `capxAppDailyCap`. (Free X tier ≈ 500 posts/mo across ALL creators combined.)
- **Shared-app blast radius is real.** One abusive creator on lane B can get capx's X app suspended for everyone. The guardrail + per-handle kill-switch are the only defence — that's why they're enforced server-side.
- **Consumer ToS + privacy policy don't exist** (counsel brief item 4). Lane B makes capx a consumer product holding other people's X tokens.
- **A real tweet has never been sent.** `POST /2/tweets` is the one untested X endpoint (classifier outages blocked live `post_now`). The Loop fires Monday 09:00 IST and will exercise it whether or not it's tested first.

---

## 🔐 Secrets inventory — ✅ ALL in Secret Manager (verified 2026-07-17)

Every sensitive value on Cloud Run `capx-chokepoint` is a `valueFrom.secretKeyRef` — **no plaintext
secret in the service config.** Runtime SA `capx-chokepoint-run@…` holds `secretmanager.secretAccessor`
on these five and nothing else (verified). The service boots reading from them (`/health` 200, `/session`
200 exercises the signing key + KMS key).

| Env var | Secret | What it is | Sensitivity |
|---|---|---|---|
| `KMS_KEY_ID` | `capx-kms-key` | master key that decrypts EVERY vaulted X token | 🔴 highest |
| `X_CLIENT_SECRET` | `capx-x-client-secret` | impersonates **capx itself** to X (lane B confidential client) | 🔴 highest |
| `VAULT_DB_URL` | `capx-vault-db-url` | Postgres conn string incl. DB password | 🔴 highest |
| `SESSION_SIGNING_KEY` | `capx-session-signing-key` | signs session bearers | 🟠 high |
| `ADMIN_API_KEY` | `capx-admin-api-key` | `x-admin-key` for `/admin/*` and `/internal/tick` | 🟠 high |

- **Non-secret env vars stay plaintext (correct):** `X_CLIENT_ID` (public), `OAUTH_CALLBACK_URL` (public),
  `CAPX_DEPLOY_MODE`, `NODE_ENV`.
- **To rotate a secret:** `gcloud secrets versions add <name> --data-file=- --project=capx-cafe` then
  redeploy (or the service picks up `:latest` on next cold start). Never `--set-env-vars` a secret back to plaintext.
- Robot SA key: `.gcp/claude-capx-cafe-key.json` (gitignored, mode 600). **Rotate ~15 Oct 2026.**
- Admin key mirror for local curl: `.gcp/admin-key.env` (gitignored). This is the ONE place a secret
  still sits on disk in cleartext — fine for a founder-only laptop; delete it if this machine changes hands.

**Correction note (for honesty in the record):** an interim status in this session claimed "4 plaintext
env vars." That came from a grep matching env *names* without distinguishing literal values from secret
refs. `X_CLIENT_SECRET` genuinely WAS plaintext at revision 00008, but the migration to Secret Manager
completed shortly after. Lesson: to audit exposure, check `valueFrom` vs `value`, not just the name.

---

## 🗺️ Operational facts (for the eventual runbook)

- **Service URL:** `https://capx-chokepoint-saptrlsyiq-el.a.run.app` (temp `.run.app`; migrate to a custom domain (TBD; `capx.ai` superseded — individual operator) = one DNS record + update `OAUTH_CALLBACK_URL` + the X app callback).
- **GCP project:** `capx-cafe` · **billing:** `012D9E-67C8F4-DAE129` (shared with capxcloud/capx-internal/personal) · **region:** asia-south1.
- **Cloud SQL:** `capx-chokepoint-db` (POSTGRES_17, ENTERPRISE, db-f1-micro).
- **Cron:** Cloud Scheduler `capx-loop-tick`, `*/5 * * * *` → `POST /internal/tick` (proven landing, 200).
- **gcloud isolation:** this repo uses its own robot via `.envrc` (`CLOUDSDK_CONFIG=.gcp/gcloud-home`); `cd` here = robot + capx-cafe, `cd ~` = personal + parvani. Never clobbers other sessions.
- **Deploy:** build on Cloud Build (Mac is arm64, Cloud Run is amd64); `run deploy --image` preserves existing env vars + secret refs.
- **Secret Manager:** enabled; 5 secrets (`capx-kms-key`, `capx-x-client-secret`, `capx-vault-db-url`,
  `capx-session-signing-key`, `capx-admin-api-key`). Secret create/IAM = **your** identity; the scoped
  robot has no Secret Manager role. Runtime SA reads them via `secretAccessor`.
- **Cloud Run runtime SA:** `capx-chokepoint-run@…` — least privilege: `cloudsql.client` + per-secret `secretAccessor`.

---

## 📌 PINNED (founder asked to re-deliver these exact points on request, 2026-07-18)

### Casserole — the exact points ("the bouncer")

Casserole is the **bouncer at the only door to your X account.** Three things make it real, not decorative:

1. **It lives on the server, not your laptop.** The bouncer stands *inside* the locked mailroom. Even if
   the AI on your machine is fully hijacked, it can only *ask* — it can't walk around the bouncer,
   because the account key is behind him.
2. **It's the only path to the key.** The code is written so the X token is *physically only reachable*
   after the bouncer says "pass." A blocked post never even *unlocks* the key (proven by test: a scam
   post is blocked and the token is never decrypted).
3. **It checks six things + live signals, on every single post:** allowed & not-killed account; too many
   posts today; spammy / duplicate / engagement-bait content; style-cloning; account health; audit stamp.
   Worst result wins: **pass / rewrite / hold-for-review / block.**

Proof it can't be bypassed: calling the chokepoint *directly*, skipping the plugin entirely, still hits
the bouncer (red-team suite). The plugin's checks are cosmetic; the server's are load-bearing. One-liner:
**"the AI writes, casserole decides what ships."** Also pinned: casserole is **deliberately not AI** —
deterministic rules can't be prompt-injected, are testable, and cost nothing per check; the AI writes,
the judge is not an AI. (Full architecture: `docs/P1-CHOKEPOINT.md`; adversarial proof:
`apps/capx-mcp/test/redteam.test.ts`.)

### Hybrid-hosting Q&A (founder architecture round, 2026-07-18)

- **Self-host** = identical image, `CAPX_DEPLOY_MODE=self-host`, own Postgres/key/domain/X-app, own
  allowlist + kill-switch + cron; zero telemetry to capx. A self-hoster can strip casserole from their
  own instance — endangers only their own account; the guarantee is per-operator.
- **Token + guard + send are ONE inseparable unit** (their co-location IS the security thesis). Around it,
  everything mixes: own trigger calling `post_now` (works today), full self-host, casserole as a standalone
  library/linter (OSS). NOT supported: token at home + capx scheduler (recreates the rejected Option A and
  defeats laptop-off). "Casserole-as-a-service" check-only endpoint = easy to add but is a **linter, not a
  lock** — must never be marketed as enforcement.
- **Failure mode = fail closed:** live post errors surface to the agent (idempotent retry, never double);
  scheduled posts fire late only within the 120-min window, else the slot is skipped and the post stays
  queued. Never stale, never duplicate.
- **Capacity honest read:** Cloud Run autoscales (0→100 instances) and casserole is sub-ms; real limits are
  the db-f1-micro Postgres (~25 conns — hundreds of users, one-flag upgrade) and X's own per-app rate
  limits (lane B shares capx's app quota; BYO brings their own). Never load-tested — do that before scale.

---

## 📋 TBD LEDGER (decisions/work parked by the founder, 2026-07-18 — do not lose)

1. **Skills plan** — ✅ LOCKED + documented: `docs/SKILLS-PLAN.md`. Build ALL write-skills (all agents) +
   media (images+video, BYO + director/prompt-engine skills). Tier-3 read-skills (analytics/replies) SPUN
   OUT to a separate read product ("capx-scope", TBD). Build is phased (infra → write-skills → server
   endpoints → media pipeline → media directors) — NOT yet built.
2. **Legal/compliance pack** — license ✅ LOCKED (MIT client / AGPL-3.0 server, STATE §5.9–5.10). Still to do:
   **ToS + privacy policy** (hosted chokepoint = data processor; the capx-scope read product raises this
   further), **CLA** setup before first outside PR, **trademark** filing on "capx café", and the comprehensive
   user docs (per-agent install, walkthroughs, self-host guide, security page).
3. **Launch assets** — "absolute beast" GitHub README + capx-cafe landing/docs site + demo video. Gated on
   the feature-rich build finishing (STATE §5.10); part of GTM execution.
4. **GTM strategy** — ✅ plan + LOCKED decisions in `docs/GTM-PLAN.md` (2026-07-18). Delivered separately.
5. **P4 monetization** — still deferred (MoR pick gates webhook code); see Deferred work section above.
6. **capx-scope** (NEW, spun out 2026-07-18) — the separate read-side product: X-profile scrape + analytics +
   reply drafting. Own scopes, own privacy surface, own repo/brand. Detailed spec is a future exercise.
