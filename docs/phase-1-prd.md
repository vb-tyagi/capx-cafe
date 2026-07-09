# capx-culture — Phase 1 PRD (v2)

**Module:** Assisted Launch + Management + Loops (working name: *TBD / parked*)
**Status:** Draft v2 — all core decisions locked, ready to build-plan
**Owner:** tyagi@capx.ai
**Last updated:** 2026-07-10

> Phase 2 = **giga-chad-agency** (the AI content-generation arm). Out of scope here except for the clean hooks Phase 1 leaves for it. Loops is the *first bridge* toward it.

---

## 0. Decision log (locked)

| # | Decision | Locked outcome |
|---|---|---|
| 1 | API billing | Platform holds the single Twitter dev account & fronts fees → recovered via credits *(superseded by #8)* |
| 2 | v1 scope | **Full platform**, multi-handle **capped at 3/user** |
| 3 | De-risk demand | **Build & ship** to the whitelist (no formal pre-validation) + tight feedback loop with first 5 users |
| 4 | Headline star | **Management** leads; Assisted Launch is the on-ramp |
| 5 | Build base | **Fork Postiz as open-core** (AGPL platform + closed "brain" services) |
| 6 | Whitelist gate | **Medium** — verify a real identity/business + enforce 3-handle cap |
| 7 | Platforms | **Twitter/X + LinkedIn** |
| 8 | Pricing | **Pure credit packs** — SOLO $20 / TEAM $50 / ORG $100, pay-per-use + 30–60% markup, features gated by tier |
| 9 | Safeguards | New-account **warm-up throttle** + track **"Twitter reviews our app"** as a real risk |
| 10 | Competitor teardown | **Skipped** (learn from real users) |
| 11 | Hosting | **US, major cloud, GDPR-ready**, tokens encrypted |
| 12 | Content-engine prep | **Clean hooks, build nothing** yet |
| 13 | Name | **Parked** |
| + | **Loops** (new feature) | Locked — see §8 |
| + | **Anti-slop framework** | Locked — see §9 |

**Live action items (not blockers, don't forget):**
- ✅ **AGPL open-core boundary — legally validated (lawyer sign-off, 2026-07-10).** The two-repo, network-only approach is approved. **Now a build task, not a legal one:** implement + maintain the boundary (CI boundary-guard) and the AGPL compliance mechanics (publish the fork's source, add a NOTICE file, keep Postiz attribution).
- 🔍 **Verify exact Twitter API rates in the live Developer Console** before finalizing credit prices — current rates are from secondary sources.
- 🤝 **Tight feedback loop with first 5 users** — your chosen substitute for formal validation.

---

## 1. Executive summary

capx-culture lets a **whitelisted** creator run a credible Twitter/X (and LinkedIn) presence from one tool. The headline is **management** — scheduling, publishing, analytics, and **Loops** (recurring AI-ghostwritten posting). **Assisted Launch** (AI brand-kit + guided, compliant handle setup + one-click OAuth connect) is the friendly on-ramp, not the main pitch.

The product is **compliance-first by design**: in a post-ban-wave, post-InfoFi world, *"we keep your account alive and your content non-embarrassing"* is the premium value proposition. The anti-spam / anti-slop framework (§9) is the moat, not a tax.

**Hard reality that shapes everything:** you **cannot create X accounts programmatically** — no API endpoint exists (verified). Assisted Launch is therefore human-in-the-loop by necessity: the creator does the phone/Arkose-gated signup; the tool does everything around it and takes over via OAuth the instant the handle exists.

---

## 2. Strategic constraints (non-negotiable)

| # | Constraint | Consequence |
|---|---|---|
| C1 | No programmatic account creation (human-gated signup) | Launch flow orchestrates *around* a manual signup |
| C2 | Official OAuth only — no anti-detect/proxy/PVA/cookie-session automation | Connection = OAuth 2.0 user-context (PKCE) only |
| C3 | Never automate engagement (no auto-like/follow/retweet/reply/DM) | Automate content + scheduling only |
| C4 | No reward-for-posting / InfoFi mechanics | No token/points incentives tied to posting/engagement |
| C5 | Cross-platform from day one — never single-platform-dependent on X | Twitter + LinkedIn at launch; platform-agnostic core |
| C6 | Metered API economics are a product concern | Credit ledger + per-action cost accounting (§7, §10) |
| C7 | Compliance is a feature, not a tax | Guardrails surfaced as trust/safety UX (§9) |
| C8 | **Open-core AGPL boundary** — closed "brain" never lives inside the Postiz fork | Loops/content-engine/credits/guardrails/identity = separate closed services (§7, §11) |

---

## 3. Business model & pricing (Decision #8)

**Model: pure credit packs (pay-per-use).** No flat subscription. Users buy a tier; every action consumes credits; the platform fronts the real cost to Twitter/AI providers and prices each action at **cost + 30–60% markup** (markup invisible to users, baked into clean credit pricing).

| Tier | Price | Provisional gating *(finalize later)* |
|---|---|---|
| **SOLO** | $20 | 1 handle, core management, **no Loops** |
| **TEAM** | $50 | up to 3 handles, multi-seat, **Loops enabled**, better credit rate |
| **ORG** | $100 | up to 3 handles, more seats, best credit rate, priority |

**Anti-trap guardrails on the credit model** (from the pricing brainstorm):
- Price a **plain post at a tiny, friendly credit amount** + give **chunky free starter credits** → the meter never discourages posting (the behavior you *want*).
- Put the **fatter markup on genuinely expensive actions** — link-posts (Twitter charges ~13× more) and, later, AI image/video generation — where the absolute dollars are real.
- Platform holds **one Twitter developer account**, fronts fees to Twitter, and **recovers cost + margin via credits** (this cleanly replaces Decision #1's flat-subscription idea and removes cost-concentration risk).

> ⚠️ Known trade-off (accepted): pure usage revenue is more volatile and lower-margin on plain posts than a hybrid tier-fee model. Revisit an auto-refill / recurring-credit option if forecasting/fundability needs it.

---

## 4. Target users & whitelist (Decision #6)

- **Primary:** whitelisted creators/operators/founders in the capx orbit.
- **Secondary:** small teams managing a few **real, consenting** handles (TEAM/ORG).
- **Whitelist = moat, not just a gate.** Invite-only, **Medium verification**: confirm a real person/business behind each account (verified email + social/identity proof), and **enforce the 3-handle cap in-product**. This is what lets you tell Twitter/Stripe "every user is a verified real person, capped at 3 real handles" — protecting your API lifeline.
- **Explicit non-user:** anyone wanting throwaway/fake handles at volume. The product actively should not serve this (ethics + it's the fastest way to lose API access).

---

## 5. Scope

**In (Phase 1):** Assisted Launch • multi-tenant workspaces + OAuth per handle (Twitter + LinkedIn) • full management (calendar, queues, composer, drafts, approvals, roles, analytics, scheduled publishing) • **Loops** (§8) • **anti-slop framework** (§9) • credit ledger + cost metering • the two safeguards (§9 L1/L5).

**Out (Phase 2 — giga-chad-agency):** the general AI content-generation pipeline (voice modeling, ideation at scale), advanced growth analytics/competitor intel. *(Loops is a narrow, guardrailed first slice of AI content — the rest waits.)*

**Never:** anti-detect browsers, cloud phones, proxy/SIM/PVA farms, automated engagement, ban-evasion, reward-for-posting.

---

## 6. Core user journey

```
INVITE (whitelist + verify) ─► Onboard ─► Brand kit (AI) ─► Guided launch (human signup)
      ─► Connect (OAuth) ─► MANAGE (calendar / compose / schedule / analyze)
      ─► [TEAM+] set up LOOPS ─► [autonomous or reviewed] posting under the anti-slop gauntlet
```

---

## 7. Feature specs — Launch, Identity, Management

### A. Assisted Launch (the on-ramp)
- **Intake** (~6 questions: niche, audience, voice, goals, references, name ideas) → structured brand brief.
- **AI brand-kit generator:** handle/display-name candidates (with availability hints where checkable), bio variants, avatar + banner options, pinned-post draft, 7-day starter outline. All editable/regenerable; nothing auto-published.
- **Guided launch checklist:** mirrors the real X signup (human does phone/Arkose), brand kit at hand; compliant warm-up guidance (manual only, zero automation).
- **Connect handoff:** OAuth authorize the moment the handle exists.
- *Compliance note:* Module A never touches X programmatically before OAuth — it's content generation + a checklist.

### B. Identity & Connection
- **Multi-tenant workspaces** (one per creator/team); a workspace holds up to **3 handles**; row-level isolation.
- **OAuth 2.0 (PKCE) per handle, per platform** — X scopes `tweet.read tweet.write users.read offline.access` (+ media); LinkedIn equivalent. One registered app; many authorized handles.
- **Encrypted token vault** — KMS envelope encryption, never logged, never client-exposed.
- **Medium verification gate** on invite (§4).

### C. Management layer
Unified cross-platform calendar • per-handle queues • platform-aware composer + drafts/templates • approval workflow (draft→review→approved→scheduled) • **roles** (Owner/Manager/Creator/Viewer, scoped per workspace + handle) • scheduled publisher (job-queue, retry/backoff, failure alerts) • core analytics (respecting the read-cap + dedup budget).

---

## 8. Feature spec — LOOPS (new)

**What it is:** recurring, AI-ghostwritten posting on a schedule. A Loop = *"on these days at this time, generate and post a [type] tweet about [category], guided by [brief], in the style of [≤3 profiles], via [AI model] — autonomously or after my review."*

**Eligibility (hard gates):** TEAM tier+ • account **verified (blue tick)** • account **≥ 30 days old** • account **in good standing** (no recent strikes/lockouts) • new-to-Loops accounts start under tighter caps (warm-up).

**Config flow:**
1. Select the handle to enable Loops on (must pass eligibility).
2. Select time of day. **One loop posts at most once/day** (anti-spam). Multiple posts/day = multiple loops — *but* subject to the account-level daily ceiling (§9 L2).
3. Select days of the week.
4. Select tweet type: **with graphic / text only / essay (long)**.
5. Select AI model + a **category** (short description of the topic).
6. Select **key tags**.
7. Submit a **brief (< 500 words)** describing what the tweet should be about.
8. *(Optional)* **"Sound like" up to 3 Twitter profiles** — used as **style calibration** (tone/cadence/structure), **never verbatim cloning**; influence-capped; user attests they're not impersonating.

**Autonomy (per-loop toggle; Autonomous = default):**
- **Autonomous** = **skips the human tap only** — every post still runs the *full automated gauntlet* (§9 L1–L3, L5–L6). Fail = **held or regenerated**, never posted raw.
- **User-reviewed** = generated ahead of time into an approval queue → approve/edit/skip before it fires.
- **🚲 Training wheels (always on):** the first few posts of any *new* loop are forced through user-review before it flips to its chosen mode — so the user sees the output quality before trusting it.

---

## 9. Anti-spam / anti-slop framework (the moat)

Every Loop post — and every scheduled post — runs this gauntlet before reaching a platform. Autonomous mode skips only Layer 4's *human* step; all automated layers always run.

| Layer | Guardrails |
|---|---|
| **1. Who can loop** (eligibility) | Verified + ≥30 days + good standing + TEAM tier+ • new-to-Loops accounts throttled first N days *(Decision #9 warm-up)* |
| **2. How often** (rate) | Per-loop max 1/day • **account-level daily ceiling across all loops + manual posts** *(closes the multi-loop loophole)* • weekly/monthly caps • **posting-time jitter** (±N min, never fire on exact :00) • min spacing so two loops never share a minute |
| **3. Is it good** (anti-slop quality) | **Semantic duplication check** vs the account's recent posts → block/regenerate *(dodges the "substantially similar content" ToS violation)* • automated **slop-score** (generic-ness, engagement-bait, hashtag-stuffing, broken formatting) → below threshold = hold/regenerate • **banned patterns** ("RT if…", fake urgency, undisclosed promo, >N hashtags, link-stuffing) • **higher bar for AI images** (cap image-loops or force review) • **factuality flag** on claim-like posts |
| **4. Is it human** (authenticity) | Default review window (User-reviewed mode) • **style mimicry constrained** to calibration, never cloning • no automated engagement (C3) • **variation engine** forces angle/opener differences so a loop never reads as a template |
| **5. Watch & kill** (monitoring — mandatory for autonomous) | Per-account health signals (follower drops, reply-ratio anomalies, platform flags) → **auto-pause Loops on that account** • platform-level abuse detection (coordinated identical loops) • **global + per-account kill switch** |
| **6. Label & log** (transparency) | AI-content labeling where required • **full audit trail** per post (brief, model, style-sources, approver) — your defense if a platform questions an account |

**Two Decision-#9 safeguards live here:** the **warm-up throttle** (L1/L2) and treating **"platform reviews our app"** as a tracked risk with a fallback plan (§12).

---

## 10. Technical architecture (open-core)

**The AGPL boundary is the architecture's spine (C8):**

| 🔓 Open platform (AGPL — the Postiz fork) | 🔒 Closed services (your IP — separate works) |
|---|---|
| OAuth/account connection, scheduling, publish engine, calendar/queue UI, multi-platform adapters (X, LinkedIn), analytics ingestion | **Loops engine** (brief→tweet, style calibration, orchestration) • **AI content generation / giga-chad-agency** • **credit/billing + ledger** • **anti-slop guardrail scoring** • **whitelist/identity** |

Closed services **call the open platform over its API** — they are *never* compiled into the fork. ✅ Counsel **validated this boundary (2026-07-10)**; the CI boundary-guard enforces it on every build.

**Recommended stack (revisit at scaffold):** open platform inherits Postiz's stack (Node/TS); closed services in your team's preferred stack • **Postgres** w/ row-level security (multi-tenant) • **Redis + BullMQ** for the publisher/Loop scheduler (retry, rate-limit-aware backoff, jitter) • **cloud KMS** token vault • **S3-compatible** media • cloud region **US** (GDPR-ready).

**Key entities:** `Workspace → Membership(user, role) → Handle(platform, oauth_ref, verified, age, standing) → Post(status, scheduled_at, cost_estimate, slop_score, audit) → Loop(schedule, type, model, brief, style_sources[], autonomy) → BrandKit → CreditLedger → GuardrailEvent`.

**Dev-server port:** allocate a **unique, non-default** port at scaffold time (verify free via `lsof`; avoid 3000/5173/8000/8080); hard-code in dev script + README.

---

## 11. Twitter/X API cost model (facts corrected)

- **Model:** pay-per-use / credit-based — **confirmed on the official docs** (docs.x.com): "pay only for what you use," no subscription requirement, credits deducted per request; **same resource requested twice in 24h charged once** (dedup — softens read/analytics costs).
- **No X Premium required** to use the API (separate from the blue-check subscription).
- **Effective date:** early 2026 (sources vary Jan 21–Feb 6) — **verify in Console.**
- **Rates (widely reported, NOT primary-verified — confirm in Console before pricing credits):** post ~$0.015 • **post-with-link ~$0.20** • read ~$0.005 • read cap ~2M/mo • legacy Basic/Pro/Enterprise ($200/$5k/$42k+) grandfathered & closed.
- **Product response:** `CreditLedger` per workspace; pre-flight cost estimate per action; link-post confirmation UX; batch + dedup-aware reads.

---

## 12. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Platform policy/pricing changes again | High | Cross-platform (C5); don't over-index on X |
| Account suspensions damaging trust | High | Anti-slop gauntlet (§9); official OAuth only; warm-up throttle |
| **Autonomous Loops flagged as inauthentic** | High | Automated gauntlet always runs; mandatory auto-pause monitoring (§9 L5); training wheels |
| **Twitter reviews/limits our OAuth app** (AI/bot scrutiny) | High | Tracked risk + fallback plan; clean compliance posture; audit trail (§9 L6) |
| **AGPL boundary contaminating closed IP** | High → **Low** | ✅ Lawyer-validated (2026-07-10); boundary discipline (C8); CI boundary-guard enforces it; closed services never inside the fork |
| Whitelist abused to farm handles | Med | Medium verification; 3-handle cap; duplicate detection; abuse monitoring |
| Credit-model revenue volatility / thin plain-post margin | Med | Markup weighted to expensive actions; revisit auto-refill/hybrid if needed |
| Style-mimicry → impersonation | Med | Calibration-not-cloning; influence caps; user attestation; labeling |

---

## 13. Roadmap

- **M0 — Foundations (wk 1–2):** open/closed repo split + counsel boundary check • multi-tenant schema • whitelist + Medium verification • X + LinkedIn OAuth + token vault • one manual test post.
- **M1 — Management MVP (wk 3–5):** composer, calendar, queues, scheduled publisher, roles, core analytics, credit ledger + cost metering.
- **M2 — Assisted Launch (wk 5–7):** intake → brand-kit → guided checklist → connect.
- **M3 — Loops + anti-slop gauntlet (wk 7–10):** Loop config, autonomy toggle + training wheels, six-layer framework, monitoring/auto-pause + kill switch.
- **M4 — Hardening (wk 10–11):** account-level ceilings, jitter, duplicate/slop scoring tuning, audit trail, app-review fallback.
- **Phase 2 — giga-chad-agency:** plugs into the composer/Loops via the closed content-generation service.

---

## 14. Success metrics

- **Activation:** % invited → live, connected handle.
- **Retention:** % of handles still publishing at day 30/60.
- **Loops health:** % of Loop posts passing the gauntlet without human edit; slop-score distribution; **suspensions per 1,000 connected handles (target ≈ 0).**
- **Publish reliability:** % scheduled posts fired within ±1 min; failure rate.
- **Unit economics:** credit margin per active handle/month vs. fronted API+AI cost.

---

## 15. Open decisions / to lock later

1. **Name** (parked).
2. **Per-tier feature/credit gating** (provisional table in §3 — finalize).
3. **Exact credit prices** (pending Console rate verification).
4. **LinkedIn** confirmed as second platform (revisit if audience data says otherwise).
5. **Depth of giga-chad-agency hooks** in the composer/Loops interface.
6. ~~**AGPL open/closed boundary** — final legal sign-off.~~ ✅ **Done — legally validated 2026-07-10.**

---

### Changelog v1 → v2
Pricing flipped to **pure credit packs**; build base changed to **Postiz open-core** (+ AGPL boundary architecture); scope set to **full platform, 3-handle cap**; platforms set to **Twitter + LinkedIn**; **Medium** whitelist gate; **Loops** feature + **six-layer anti-slop framework** added; Decision-#9 safeguards embedded; API facts corrected (dedup, no-Premium, date/rate caveats, official pay-per-use confirmation); teardown skipped; hosting US/GDPR-ready; content hooks only.
