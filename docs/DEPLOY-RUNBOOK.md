# capx café — Deploy Runbook (the single Phase-3+4 redeploy)

_Written 2026-07-19 for founder review BEFORE go-live. This one redeploy takes the live chokepoint from
"post + loops" to the full v1 surface (preview + audit + reply-chain + media). It is also the **first real
tweet ever sent**. Nothing here runs without the founder's explicit go. Ops facts + foot-guns:
`HANDOVER-SEEDS.md`._

---

## 0. What this deploy changes (all additive, low-risk)

- **P0 token-refresh fix (2026-07-19):** the publish path now refreshes an expired X access token and retries
  once. X OAuth2 access tokens die ~2h after connect, so before this, any `post_now`/loop post more than ~2h
  after connect returned `publish_failed`. Now: on a 401 from X the gate refreshes THIS connection's token
  (via the Refresher, using the connection's own client id) and retries the send once; a failed refresh
  (`invalid_grant`) flags `needsReauth` and returns "needs re-auth". Loops get this automatically (same
  `#publish` path). The real X error is now surfaced in `publish_failed` reasons (was swallowed).
- **New routes:** `POST /preview` (dry-run guardrail), `POST /audit` (send history), `POST /media` (chunked
  upload). **Extended:** `POST /post_now` gains `inReplyToId` + `mediaIds`.
- **New MCP tools** (client-side, already publishable): `preview`, `audit`, `upload_media`.
- **DB migration at boot:** `runMigrations` re-runs `001_init.sql`, which now includes **two** idempotent
  `add column if not exists`: `loops.ai_generated boolean … default false` and, new for the P0 fix,
  `vault.client_id text` (nullable — legacy rows stay NULL and fall back to the server default client id at
  refresh time). Both no-op if already present. No data change, no destructive DDL.
- **No secret/env changes required** — `run deploy --image` preserves existing env vars + secret refs. The
  refresh works on the BYO lane with the connection's client id alone; `X_CLIENT_SECRET` is only consulted
  when refreshing a `CAPX_APP`-lane connection (already wired via `capxAppClientSecret` in `serve.ts`).

## 1. Pre-flight checklist (verify BEFORE building)

- [ ] `pnpm run verify` green locally (currently: 214 pass / 1 skip, tsc clean — includes the P0 refresh tests).
- [ ] On branch `track2/decision-lock-and-p0`, working tree clean (`git status`).
- [ ] gcloud robot env active: `cd` into repo so `.envrc` sets `CLOUDSDK_CONFIG=.gcp/gcloud-home`; confirm
      `gcloud config get-value project` = `capx-cafe` and account = the scoped robot.
- [ ] Current service healthy: `curl -s https://capx-chokepoint-<hash>-el.a.run.app/health` → `{"ok":true,...}`
      (use the URL that `run deploy` last printed, NOT `status.url` — foot-gun #6).
- [ ] Secrets intact (5 in Secret Manager); runtime SA `capx-chokepoint-run@…` unchanged.
- [ ] **Decide the metering cap** — see §4. If real creators (lane B) will use it, set it BEFORE this deploy.

## 2. Build the image (Cloud Build — non-live, safe to run for review)

Mac is arm64 and Cloud Run is amd64, so build in the cloud. Build as the **scoped robot** (foot-gun #4 — the
default compute SA is unprivileged on this project):

```sh
# from repo root, robot env active
gcloud builds submit \
  --project=capx-cafe \
  --service-account="projects/capx-cafe/serviceAccounts/claude-capx-cafe@capx-cafe.iam.gserviceaccount.com" \
  --config=cloudbuild.yaml     # or: --tag <artifact-registry>/capx-chokepoint:phase3-4
```
_Confirm `cloudbuild.yaml` sets `logging: CLOUD_LOGGING_ONLY` and the robot has `roles/logging.logWriter`
(foot-gun #4). Cross-check this command against the last successful build in the shell history — reuse the
exact image path/tag the service currently runs._

## 3. Deploy (the live cutover — FOUNDER GO REQUIRED)

```sh
gcloud run deploy capx-chokepoint \
  --project=capx-cafe --region=asia-south1 \
  --image=<the image built in §2> \
  --service-account="capx-chokepoint-run@capx-cafe.iam.gserviceaccount.com" \
  --no-traffic     # OPTIONAL: deploy a revision without shifting traffic, then migrate + smoke-test, then shift
```
Runtime SA is the least-privilege one (`cloudsql.client` + per-secret `secretAccessor`) — foot-gun #5; do NOT
deploy as the build/deploy identity. The migration runs on the new container's first boot.

**Post-deploy verify (before trusting it):**
- [ ] `curl -s <printed Service URL>/health` → 200 `{"ok":true}` (NOT `/healthz` — GFE reserves it, foot-gun #2).
- [ ] `POST /preview` with a session bearer returns a verdict (proves the new route + DB migration booted OK).
- [ ] Cloud Run logs: no boot errors, both migration statements ran once (`loops.ai_generated`, `vault.client_id`).
- [ ] **P0 fix proof:** `post_now` succeeds on a connection that is **> 2h old** (the exact case that failed on
      2026-07-19). If a fresh reconnect is easier to arrange, a `post_now` still works; the real signal is that
      re-connecting is no longer required after ~2h. On logs, a refreshed send shows a 401 followed by a
      successful retry, not a `publish_failed`.

## 4. Metering cap (lane B) — do this before real creators

Today lane B is **uncapped** (`serve.ts` doesn't set `capxAppDailyCap`, so `Metering` is off). Before any
capx-app-lane creator posts, add a `CAPX_APP_DAILY_CAP` env read in `serve.ts` → pass `capxAppDailyCap`, and
set the env var. **Not blocking a BYO-only first deploy**, but a hard gate before opening lane B (an uncapped
lane can burn capx's shared X quota / cost — HANDOVER-SEEDS "live-service risks").

## 5. First real tweet (do WITH the founder, once, deliberately)

`POST /2/tweets` has never run live. Plan:
1. Founder is present and watching the target X account.
2. Use a **BYO** connection (founder's own X app) so no shared-app blast radius.
3. Draft one benign, true, specific post (it must clear casserole — vague hype/bait will be blocked, by design).
4. Call `post_now` (via the MCP or an authenticated `POST /post_now`) with a fresh `idempotencyKey`.
5. Confirm: the outcome is `published`, the tweet appears on X, and `audit` shows it `SENT`. Then try a
   deliberately spammy draft and confirm it's `blocked` and never reached X (the live proof of the thesis).
6. Optionally exercise `upload_media` with a small image → `post_now { mediaIds }` to prove the media path.

## 6. Rollback

`gcloud run services update-traffic capx-chokepoint --to-revisions=<previous-revision>=100 --region=asia-south1`
— instant revert to the prior revision. The migration is additive (a new column), so a rollback of the image
needs no DB rollback.

---

**Summary for the founder:** additive deploy, idempotent one-column migration, least-privilege runtime SA,
`/health` smoke test, then a careful first real tweet on the BYO lane with you watching. Say go and I'll build
(§2), show you the image + smoke results, and only cut over (§3) on your word.
