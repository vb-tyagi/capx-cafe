# capx café — Deploy Runbook (the single Phase-3+4 redeploy)

_Written 2026-07-19 for founder review BEFORE go-live. This one redeploy takes the live chokepoint from
"post + loops" to the full v1 surface (preview + audit + reply-chain + media). It is also the **first real
tweet ever sent**. Nothing here runs without the founder's explicit go. Ops facts + foot-guns:
`HANDOVER-SEEDS.md`._

---

## 0. What this deploy changes (all additive, low-risk)

- **New routes:** `POST /preview` (dry-run guardrail), `POST /audit` (send history), `POST /media` (chunked
  upload). **Extended:** `POST /post_now` gains `inReplyToId` + `mediaIds`.
- **New MCP tools** (client-side, already publishable): `preview`, `audit`, `upload_media`.
- **DB migration at boot:** `runMigrations` re-runs `001_init.sql`, which now includes
  `alter table loops add column if not exists ai_generated boolean not null default false`. **Idempotent** —
  it adds one column to the `loops` table and no-ops if already present. No data change, no destructive DDL.
- **No secret/env changes required** — `run deploy --image` preserves existing env vars + secret refs.

## 1. Pre-flight checklist (verify BEFORE building)

- [ ] `pnpm run verify` green locally (currently: 209 pass / 1 skip, tsc clean).
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
- [ ] Cloud Run logs: no boot errors, migration statement ran once.

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
