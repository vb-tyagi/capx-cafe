# capx café — Project Handoff (v1 build complete)

_Written 2026-07-19. The single "read this to take over" doc. It synthesizes state + points at the deep docs;
it does not duplicate them. Deep detail: `STATE.md` (decisions), `P1-CHOKEPOINT.md` (architecture),
`SKILLS-PLAN.md` (skills), `GTM-PLAN.md` (launch), `HANDOVER-SEEDS.md` (foot-guns), `DEPLOY-RUNBOOK.md` (go-live)._

---

## 1. What capx café is

An **agent-native X poster** that installs as **one MCP server** into any coding agent (Claude Code, Cursor,
Codex, Windsurf). A whitelisted user connects their X account once, then creates / schedules / manages posts
from inside their agent session. **Security thesis:** the X token, the guardrail (casserole), and the send are
**one inseparable server-side unit** — the agent holds only a short-TTL session handle, never the token. So it
structurally can't be prompt-injected into posting a scam. *"The AI writes; casserole decides what ships."*

## 2. Architecture (the shape)

```
your machine (untrusted)                 the capx chokepoint (hosted · AGPL)              X
─────────────────────────    ── trust ──  ──────────────────────────────────  ── only ──  ────────
agent · capx skills ·         boundary    admission → casserole → vault →       egress    /2/tweets
capx MCP client (handle) ────────────────→ x-adapter ; outbox · metering ·                 media upload
your own media MCPs                        scheduler ; MediaGateway (no guard)
                                           backed by Postgres · KMS · Cloud Scheduler
```

- **Client** (`apps/capx-mcp`, MIT): thin MCP server, holds no token. Tools: `connect_x`, `whoami`,
  `post_now` (+`inReplyToId`, `mediaIds`), `preview`, `audit`, `upload_media`, `create_loop`/`list_loops`/
  `pause_loop`/`top_up_loop`/`delete_loop`. Published as the unscoped `capx-cafe` npm bundle (esbuild inlines
  the 3 permissive engines — see HANDOVER-SEEDS foot-gun #1).
- **Chokepoint** (`services/chokepoint`, AGPL): the only path to X. `PublishGate` (casserole enforced),
  `MediaGateway` (media, un-guarded by design), vault (AES-256-GCM + KMS), admission (allowlist + kill-switch),
  hosted-callback PKCE OAuth, durable outbox, lane-B metering, loops + Cloud-Scheduler tick, Postgres store.
- **casserole** (`packages/casserole`, AGPL): six-layer deterministic (non-AI) guardrail. Guards **text only**.
- **Two lanes:** BYO (user's own X app, they pay X) · capx-app (capx's app, capx pays, metered/capped).

## 3. Decisions — all LOCKED (do not re-litigate; full text in `STATE.md` §5)

Option B (thin hosted chokepoint, no user DB) · both lanes · X-only v1 · legal ship-gate cleared · fork
cold-archived · hosted-callback OAuth · **MIT** client / **AGPL-3.0** server (casserole = AGPL) · skills for
all 4 agents · Tier-3 read-skills spun out to a separate "capx-scope" product · **media = images+video, BYO gen
+ director skills, casserole never touches media, AI-label is a skill's job** · feature-rich launch · Option-C
`aiGenerated` (the user decides, default false) · media bytes transport = **MCP-streams-file** (no SSRF).

## 4. Build status — ✅ ALL PHASES DONE, committed, `pnpm run verify` green (209 pass / 1 skip, tsc clean)

| Phase | What | State |
|---|---|---|
| P0–P1 + GA | Full chokepoint, Postgres, real X wiring, deployed to GCP | ✅ live |
| P2 | BYO onboarding wizard | ✅ |
| P3 (loops) | Scheduling | ✅ |
| P5 skills 1–2 | 17 write-skills, all agents, + Claude Code plugin | ✅ |
| **P5 skills 3** | casserole **preview** + **audit** endpoints, **reply-chaining**, **Option-C aiGenerated** (incl. per-loop) + draft-review/audit-trail skills | ✅ |
| **P5 skills 4** | **media pipeline**: MCP streams bytes → chunked X upload (INIT/APPEND/FINALIZE/STATUS) → MediaGateway → attach via `post_now mediaIds`; `upload_media` tool | ✅ |
| **P5 skills 5** | 5 media director skills (media-connect, image/video-director, prompt-engine, model-guide) | ✅ |

**24 skills × 4 agents.** Branch `track2/decision-lock-and-p0` (origin exists, not pushed, ~16 commits ahead
of `main`).

## 5. What is NOT done (open items)

1. **The single live redeploy** — founder chose "deploy once after Phase 4." It's due. See `DEPLOY-RUNBOOK.md`.
   It's also the **first real tweet ever** (`POST /2/tweets` never exercised live). **Founder-gated.**
2. **Legal** — `docs/legal/{TERMS-OF-SERVICE,PRIVACY-POLICY}.md` are final except 4 `[CONFIRM]` values: legal
   entity + address, governing-law jurisdiction/venue, liability cap, MoR pick — filled 2026-09-02 (individual
   operator, Dubai/UAE; cap = greater of 12-mo fees / USD 100; MoR = Polar).
3. **Live-service risks** — lane-B metering cap is UNSET (set `capxAppDailyCap` before real creators);
   consumer product holds tokens; shared-app blast radius (kill-switch is the defense).
4. **Launch prep** — beast README, landing page, security page, demo GIF, `npm publish capx-cafe` (needs npm
   login + MIT LICENSE files), repo → `capx` org, CLA, trademark, MCP directory listings. See `GTM-PLAN.md`.
5. **Deferred** — P4 monetization (MoR pick gates webhook code); the "capx-scope" read product (separate repo).

## 6. How to work here

- **Verify:** `pnpm run verify` (repo root) = node --test across packages/services/apps + `tsc --noEmit`.
- **Constraints:** Node ≥ 22.6, run via `--experimental-strip-types` (**no** TS enums / param-properties /
  decorators; use `#private` fields). Skills: edit `skills/<name>/SKILL.md`, run `pnpm gen:skills` (regenerates
  per-agent adapters — never hand-edit `plugins/capx-cafe/`). casserole stays server-side; capx generates
  nothing; permissive `core`/`config`/`platform-client` must never import AGPL code.
- **GCP:** isolated robot via `.envrc` (`CLOUDSDK_CONFIG=.gcp/gcloud-home`). Project `capx-cafe`, region
  asia-south1. Service `capx-chokepoint`, DB `capx-chokepoint-db`, cron `capx-loop-tick`, 5 Secret Manager
  secrets. **Foot-guns are in `HANDOVER-SEEDS.md` — read them before touching infra.**

## 7. Immediate next actions (priority order)

1. **Review `DEPLOY-RUNBOOK.md`** → on your go, build the image + `gcloud run deploy` (migration auto-runs) →
   verify `/health` → the first real `post_now`.
2. Set `capxAppDailyCap` before any real creator uses lane B.
3. Fill the 4 legal `[CONFIRM]` values — filled 2026-09-02 (individual operator, Dubai/UAE; cap = greater of
   12-mo fees / USD 100; MoR = Polar).
4. Launch prep per `GTM-PLAN.md` §2 (README, security page, npm publish, directory listings).
