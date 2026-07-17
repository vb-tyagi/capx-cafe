# capx-cafe — Handover Seeds (living notes)

_Purpose: a running capture of hard-won facts, foot-guns, and deferred work, so nothing gets lost
before the real handover doc is written. Append as you go; graduate items into the final handover later.
Last touched: 2026-07-17._

---

## 🔫 Foot-guns — things that WILL bite the next person who touches this

These are ranked by "how much time it costs when you hit it cold." Each is: **symptom → cause → fix.**

### 1. `npx @capx/mcp` cannot be published as-is (the workspace:* trap)
**This is the big one — it's still there and will still be there next time someone touches the MCP package.**
- **Symptom:** publish `@capx/mcp` to npm, a stranger runs `npx @capx/mcp`, it installs then instantly crashes: `Cannot find module '@capx/core'`.
- **Cause:** `apps/capx-mcp/package.json` depends on `@capx/core`, `@capx/config`, `@capx/platform-client` via `workspace:*`. That protocol resolves **only inside this monorepo**. On npm those deps do not exist — and all three are `private: true` on purpose (they carry closed domain types / the guardrail-adjacent surface).
- **Why it's a trap:** everything works perfectly in local dev and in CI (both run inside the workspace), so the failure is invisible until the moment you actually try to distribute — i.e. exactly when you're demoing to someone.
- **Fix (recommended):** **bundle** the three `@capx/*` deps into `@capx/mcp` at publish time (e.g. tsup/esbuild) so one self-contained public package ships and the engines stay closed. Do NOT naively `pnpm publish` all four — that leaks the closed packages and creates 4-package version management.
- **Blast radius today:** zero (nobody uses npm yet; the `.mcp.json` points at a local path). Becomes a hard blocker the instant you want anyone outside this repo to install capx.

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

**P0 ✅ · P1 ✅ · P2 ✅ (bar npm publish) · P3 ✅ · P4 ❌ · P5 ❌**

### P4 — Monetization (NOT started)
Turns "founder curls `/admin/allow` per person" into "pay → in, cancel → out."
- Pick a Merchant of Record: **Lemon Squeezy vs Polar** (bake-off deferred here per decision §5.8). MoR handles global tax/VAT/GST; capx never touches card data.
- Wire the MoR webhook → `ingestAllowlist`. **Today `ingestAllowlist`'s signature check is a STUB and nothing calls it** — that's the P4 hole.
- Pricing MUST cover capx's metered X cost, because on lane B **capx pays X per post**.

### P5 — Claude Code plugin sugar (NOT started)
Pure distribution polish, no new capability: `plugin.json` (marketplace), slash commands (`/capx-post`), `userConfig` (Claude Code prompts for the X Client ID instead of hand-editing `.mcp.json`).

### npm publish of `@capx/mcp` — blocked by foot-gun #1 above
Not "just needs your npm account." Needs the bundling job first.

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

- **Service URL:** `https://capx-chokepoint-saptrlsyiq-el.a.run.app` (temp `.run.app`; migrate to `api.capx.ai` = one DNS record + update `OAUTH_CALLBACK_URL` + the X app callback).
- **GCP project:** `capx-cafe` · **billing:** `012D9E-67C8F4-DAE129` (shared with capxcloud/capx-internal/personal) · **region:** asia-south1.
- **Cloud SQL:** `capx-chokepoint-db` (POSTGRES_17, ENTERPRISE, db-f1-micro).
- **Cron:** Cloud Scheduler `capx-loop-tick`, `*/5 * * * *` → `POST /internal/tick` (proven landing, 200).
- **gcloud isolation:** this repo uses its own robot via `.envrc` (`CLOUDSDK_CONFIG=.gcp/gcloud-home`); `cd` here = robot + capx-cafe, `cd ~` = personal + parvani. Never clobbers other sessions.
- **Deploy:** build on Cloud Build (Mac is arm64, Cloud Run is amd64); `run deploy --image` preserves existing env vars + secret refs.
- **Secret Manager:** enabled; 5 secrets (`capx-kms-key`, `capx-x-client-secret`, `capx-vault-db-url`,
  `capx-session-signing-key`, `capx-admin-api-key`). Secret create/IAM = **your** identity; the scoped
  robot has no Secret Manager role. Runtime SA reads them via `secretAccessor`.
- **Cloud Run runtime SA:** `capx-chokepoint-run@…` — least privilege: `cloudsql.client` + per-secret `secretAccessor`.
