# capx café — Skills Plan (PROPOSED — for founder lock, then build)

_Created 2026-07-18. Comprehensive by request._

## ✅ LOCKED SCOPE (founder, 2026-07-18)

- **Author for ALL agents up front** (canonical `SKILL.md` → Claude Code / Cursor / Codex / Windsurf adapters).
- **Build Tier 1 + Tier 2** = every **write-skill**: Category **A** (coding-context content), **B** (voice/
  quality), **C** (scheduling intelligence). This is v1's skill body.
- **Tier 3 = SPUN OUT.** The read-skills (Category **D**: analytics, draft-replies, mention-triage) are NOT
  part of capx-cafe. They become **a separate, independent tool/service** — one that scrapes an X profile,
  serves analytics, and drafts replies — discussed in detail later. capx-cafe v1 ships write-only; the
  read/analytics product is its own thing (own scopes, own privacy surface, own repo/brand). *(Placeholder
  name in this doc: "capx-scope" — the analytics+engagement service. TBD.)*
- **Tier 4 = MEDIA, pulled INTO v1** (supersedes the earlier "text-only" call). See §M below — media has
  real decisions to lock before build (provider model, upload flow, AI-labeling).

---

## 1. Philosophy — why skills are the real product

capx lives inside a **coding agent**, so it has what no social tool has: your **repo, commits, PRs,
releases, issues, and the debugging session you just finished.** The MCP tools (`post_now`, `create_loop`)
are primitives. **Skills turn "what you're already building" into content, automatically.** That is the
moat and the content engine at once.

**Three rules that constrain every skill:**
1. **capx never generates content.** The *agent's own model* (Claude/GPT/Gemini/whatever drives the IDE)
   writes; capx ships. A skill is a *workflow* the agent runs, not a text generator on our servers.
2. **The agent reads context; capx does the posting.** The agent already has repo/git/filesystem access —
   it doesn't need capx for that. capx is the guarded pipe to X. Clean division of labor.
3. **Every write rides casserole.** No skill can post around the guardrail; a skill just produces drafts
   that flow through the same enforced gate. Skills make *good* content easy; casserole stops *bad*
   content regardless of which skill produced it.

---

## 2. Cross-agent authoring model (the "all agents up front" decision)

A skill is a **structured workflow in markdown.** ~90% of a skill's content is identical across agents;
only the *packaging/registration* differs. So:

- **Canonical source of truth:** `skills/<name>/SKILL.md` — the agent-agnostic workflow (what to read, how
  to draft, which capx tool to call, guardrail behavior). One file, one place to edit.
- **Per-agent adapters** (thin wrappers pointing at / embedding the canonical body), authored up front:

| Agent | Skill mechanism | Where it goes |
|---|---|---|
| **Claude Code** | Plugin skills (`skills/<n>/SKILL.md`, auto-invoked) + slash commands (`commands/<n>.md`) | `plugins/capx-cafe/` |
| **Cursor** | Project Rules (`.cursor/rules/<n>.mdc`, description-triggered) | user's `.cursor/` (we ship templates) |
| **Codex** | Custom prompts (`~/.codex/prompts/<n>.md`, `/<n>` invocation) + `AGENTS.md` context | we ship a prompt pack |
| **Windsurf** | Workflows (`.windsurf/workflows/<n>.md`) + Rules | we ship templates |
| **Any other MCP agent** | A generic `SKILL.md` the user points their agent at | in-repo, copy-paste |

- **Maintenance:** edit the canonical `SKILL.md`; a tiny generator produces the per-agent files (or they're
  thin includes). Avoids N-way drift. (The generator is itself a small build step to spec at impl/time.)
- **Distribution:** Claude Code skills ride the existing plugin (P5). Cursor/Codex/Windsurf ship as a
  "skill pack" in the repo + docs, installable per that agent's convention.

---

## 3. The comprehensive skill catalog

Grouped by category. Each: **what it does · reads · produces · X scope · guardrail note.** Priority column:
**v1** (first build), **v2** (fast-follow), **v3** (needs new X scopes + privacy review — gated).

### A. Coding-context content — THE MOAT (write-skills, existing scopes)

| # | Skill | What it does | Reads | Produces | Prio |
|---|---|---|---|---|---|
| A1 | 🏆 **build-in-public** | Reads recent `git log`, drafts a week of build-in-public posts, queues them as a loop | git log/diff summaries | a loop (queue of posts) | **v1** |
| A2 | **ship-note** | A merged PR or GitHub release → an announcement post/thread | PR title/body/diff, release notes | 1 post or a thread | **v1** |
| A3 | **repurpose** | A blog post / README / long doc → an X thread | a file/URL the user names | a thread | **v1** |
| A4 | **changelog-thread** | A range of commits / a version bump → a "what shipped" thread | commit range, CHANGELOG | a thread | v2 |
| A5 | **fix-note** | A just-closed bug / a debugging session the agent just did → a "we fixed X" post | the session context, closed issue | 1 post | v2 |
| A6 | **launch-thread** | README + first release → a full product launch thread (hook → problem → solution → CTA) | README, release, repo meta | a long thread | v2 |
| A7 | **til** ("today I learned") | The non-obvious thing from the current session → a punchy insight post | current session context | 1 post | v2 |
| A8 | **milestone** | A repo/download/stars milestone → a celebratory post | a number the user or a data source supplies | 1 post | v3 (needs data source) |

### B. Voice, quality, structure (write-skills, existing scopes)

| # | Skill | What it does | Reads | Produces | Prio |
|---|---|---|---|---|---|
| B1 | **voice-match** | Calibrates drafts to the user's own past posts (tone, length, emoji, hashtag habits) | user's recent posts (`tweet.read` — already granted) | a style profile applied to drafts | **v1** |
| B2 | **thread-builder** | Structured multi-post threads: hook, body beats, CTA; queued as a sequence | user's raw material | a sequenced thread | v2 |
| B3 | **draft-review** | Runs a draft through casserole **preview** and shows the verdict + fix suggestions BEFORE posting | the draft | pass/rewrite/block + reasons | **v1** *(needs a check-only endpoint — see §6)* |
| B4 | **reformat** | Long post ⇄ thread; adapt to length norms; split/merge | the draft | reshaped draft | v2 |
| B5 | **hook-rewrite** | Rewrites the first line for stopping power — *casserole still gates so it can't become bait* | the draft | alternative openers | v2 |

### C. Scheduling intelligence (write-skills)

| # | Skill | What it does | Reads | Produces | Prio |
|---|---|---|---|---|---|
| C1 | **best-time** | Suggests post times (heuristic first: audience-tz + known-good windows; data-driven later) | tz, later analytics | recommended slots | v2 |
| C2 | **cadence-planner** | Turns a backlog of drafts into a sensible multi-loop schedule | draft list, tz | one or more loops | v2 |
| C3 | **gap-alert / auto-refill** | When a loop is running low, prompts the agent to draft more from recent git activity — *closes the loop with A1* | `list_loops` + git log | tops up the loop | v2 |

### D. Read-skills → ⬛ SPUN OUT to a separate service ("capx-scope", TBD)

These are **no longer part of capx-cafe.** They require read scopes (X profile scrape, engagement metrics,
mentions), a distinct privacy surface, and a different data-retention posture — so they become an
independent analytics + engagement product. Listed here only to record the boundary; not built in this repo.

| # | Skill | Belongs to the separate service | New scope needed |
|---|---|---|---|
| D1 | **analytics** | "How did my last N posts do?" | metrics read (tiered on X plan) |
| D2 | **what-resonated** | Best past posts → topic/voice signal | metrics read |
| D3 | **reply-draft** | Drafts replies to mentions | mentions read |
| D4 | **mention-triage** | Summarizes mentions | mentions read |

_The clean seam: capx-cafe = **write** (guarded posting from your work). capx-scope = **read** (profile scrape
+ analytics + reply drafting). Two products, one brand. Detailed spec is a separate future exercise._

### E. Trust & ops (mixed)

| # | Skill | What it does | Prio |
|---|---|---|---|
| E1 | **status** | `whoami` + `list_loops` summary (already a slash command) | ✅ done |
| E2 | **audit-trail** | "Show me everything capx posted on my behalf and why the guard passed/blocked it" — a *trust* feature | v2 *(needs an audit-read endpoint)* |
| E3 | **connection-health** | needs-reauth + kill-switch status, self-heal prompt | v2 |

### F. Onboarding / meta (write/none)

| # | Skill | What it does | Prio |
|---|---|---|---|
| F1 | **connect** | The connect_x flow (already a slash command) | ✅ done |
| F2 | **quickstart** | Guided first-post walkthrough for a brand-new user | v1 |
| F3 | **self-host-guide** | Walks a user through standing up their own chokepoint | v2 |

---

## 4. The self-refilling content engine (the compounding insight)

**A1 (build-in-public) + C3 (gap-alert) form a loop that never runs dry:** you code → commits accrue → the
loop's queue drains as it posts → gap-alert notices → it drafts fresh posts from the *new* commits →
requeues. The developer's normal work *is* the content pipeline, hands-off. This is the demo that sells the
whole product — worth designing A1 and C3 together even though C3 is v2.

---

## 5. X scopes & the write-before-read rule

- **Currently requested at connect:** `tweet.read`, `tweet.write`, `users.read`, `offline.access`.
- **All v1/v2 write-skills fit inside these** — no new consent screen, no new privacy surface.
- **v3 read-skills (analytics, replies) need MORE scopes** → a new consent prompt, a privacy-policy update
  (you'd be reading engagement data), and on the capx-app lane, higher X API tiers. So v3 is a **product +
  legal** decision, not just code. **Sequence: all write-skills ship before any read-skill.**

---

## 6. Two small server additions that unlock several skills

1. **casserole preview endpoint** (`POST /preview` → verdict + reasons, no send). Powers **draft-review
   (B3)** and lets every skill show "here's why this would be blocked" *before* scheduling. This is the
   internal, safe version of the "casserole as a linter" idea — never marketed as enforcement.
2. **audit-read endpoint** (per-handle post history + verdicts). Powers **audit-trail (E2)** — a trust
   feature that shows users exactly what capx did on their behalf and why.

Both are small, both are AGPL (server side), both make skills materially better. Recommend building the
preview endpoint alongside v1.

---

## M. Media (Tier 4) — pulled into v1 (decisions to lock)

Media is a **meaty** addition, not a checkbox — it roughly doubles the posting surface. Honest breakdown so
the decisions are informed:

**What it requires:**
1. **X media-upload flow** — X media isn't a single call: it's INIT → APPEND (chunked bytes) → FINALIZE →
   get `media_id` → attach to the tweet. New code in the x-adapter + a new chokepoint path.
2. **Getting the asset bytes to the server** — either the MCP reads the local file and streams it to the
   chokepoint, or the chokepoint fetches a URL. (The token still never leaves the server; only the asset does.)
3. **AI-content labeling = a SKILL's job, NOT casserole's** (founder, 2026-07-18) — X policy requires
   disclosing AI media; the **agent/skill sets the AI-label flag before upload** and capx carries it to X.

**⛔ casserole does NOT touch media (founder, 2026-07-18):** no gate, no review, no audit — **all media passes
by default.** Only the post's **caption text** goes through casserole; the asset rides along un-inspected.
(Deliberate stance: capx does not moderate media content — the user owns what they attach.) casserole's
dormant L3-"AI-graphic→HOLD" + L6-`aiLabelRequired` rules stay **unused** (they never fired — the gate only
ever produces TEXT drafts). Build impact: the media path is just **upload + attach + carry-label** — no
casserole wiring, no HOLD path.

**✅ LOCKED (2026-07-18):**
- **Scope = images + video** (both in v1).
- **Generation model = the user's OWN media-gen MCPs + capx "director" skills.** capx runs **no** models and
  integrates **no** provider. The user connects their own media-gen MCP servers (**higgsfield, fal, kling**, …)
  to their agent; capx ships skills that orchestrate them and then upload:

| # | Media skill | What it does |
|---|---|---|
| G0 | **media-connect** | Guide: how to connect the user's own media-gen MCP servers (higgsfield / fal / kling / …) to Claude Code / Cursor / Codex / Windsurf |
| G1 | **image-director** | Picks the right image model for the goal + drives the user's *own* tool to a high-quality result, then hands to upload |
| G2 | **video-director** | Same for short video (hook, aspect ratio, length norms for X) |
| G3 | **prompt-engine** | Reusable prompt-engineering skill — vague ask → model-optimized prompt (image or video); the quality engine the directors call |
| G4 | **model-guide** | Reference: which model for which job, current best options, tradeoffs (a "guide" skill) |
| G5 | **media-attach** (capability) | Server side: chunked upload → `media_id` → attach, **carrying the skill-set AI-label flag**. **No casserole** (media passes by default). The pipe every director ends in. |

  Rationale: capx never generates content (philosophy-consistent), zero provider cost/lock-in, works with
  whatever media MCPs the user already has — while G0–G4 still deliver a turnkey-feeling "great media"
  experience. capx-integrated generation is explicitly rejected for v1.

**Media as a layer, not a silo:** the directors produce an asset; any A/B content skill can then attach it —
**build-in-public** adds a diagram, **launch-thread** a hero image/clip, **ship-note** a screencap. G5 is the
shared server capability all of them flow through.

## 7. Build order — LOCKED scope, feature-rich launch (build it all, THEN launch)

Launch shape is feature-rich (STATE §5.10), so v1 = everything below, built before going public. Phased so
each phase is shippable + testable on its own.

**✅ Status (2026-07-19): Phases 1–5 all built + committed; `pnpm run verify` green (209 pass).** 24 skills ×
4 agents. The only thing between "built" and "live" is one **founder-gated redeploy** of the chokepoint
(preview + audit + reply-chain + media go live together — founder chose "deploy once after Phase 4"), which
is also the first real tweet. **Note on media AI-label:** X's API has no reliable per-media AI-content flag,
so disclosure is done at the **caption** (guarded) + the post's `aiGenerated` (Option C) — the director skills
prompt the user to disclose. The chunked upload carries `media_category`; the honesty label rides the caption.

- **Phase 1 — Skill infrastructure:** the canonical `skills/<name>/SKILL.md` format + the per-agent generator
  (Claude Code / Cursor / Codex / Windsurf). Build **build-in-public (A1)** first, end-to-end across all four
  agents, as the pattern-setter. *(Pure markdown + generator; no chokepoint change; low risk.)*
- **Phase 2 — the rest of the write-skills:** A2–A7 · B1, B2, B4, B5 · C1, C2, C3 · E3 · F2, F3 — fan out off
  the Phase-1 pattern.
- **Phase 3 — server additions:** the **casserole preview endpoint** (§6.1) + the **audit-read endpoint**
  (§6.2) → unlocks **draft-review (B3)** and **audit-trail (E2)**. *(Chokepoint code + tests + redeploy.)*
- **Phase 4 — media pipeline:** the **media-attach capability (G5)** — X chunked upload in the x-adapter +
  a chokepoint media path that **carries the skill-set AI-label flag**. **No casserole for media** (passes by
  default; only the caption text is guarded). *(Chokepoint code + tests + redeploy; simpler than first scoped.)*
- **Phase 5 — media skills:** media-connect (G0), image-director (G1), video-director (G2), prompt-engine
  (G3), model-guide (G4) — the BYO orchestration + quality layer that ends in G5.
- **Then:** GTM launch (see `GTM-PLAN.md`), led by the build-in-public demo.

**Spun out, not built here:** Category D (analytics/replies) → the separate "capx-scope" read product.

---

## 8. Micro-decisions — ✅ LOCKED 2026-07-18 (defaults accepted)

1. **v1 skill set = ALL write-skills** (categories A + B + C) + the **media suite** (G1–G5). Not the small
   subset — the founder chose comprehensive.
2. **Canonical source + a tiny generator** — YES. One `skills/<name>/SKILL.md` is the source of truth; a
   small generator emits the per-agent files to prevent N-way drift.
3. **Agents up front = Claude Code + Cursor + Codex + Windsurf** (founder said "all agents up front").
4. **Preview endpoint = YES in v1** (lifts draft-review + lets every skill show "why this would be blocked").
5. **Naming convention = `capx-<skill>`** everywhere (`capx-build-in-public`, `capx-ship-note`, …) so muscle
   memory ports across agents.

## 9. Phase-2 review follow-ups — ✅ RESOLVED (2026-07-19)

Both items the consistency critic raised are now settled and implemented:

1. **Reply-chain capability — ✅ ADDED.** `post_now` now takes an optional `inReplyToId` (a prior post's
   `platformPostId`); the gate threads it to the x-adapter, which nests it under X's
   `reply.in_reply_to_tweet_id`. The thread skills (repurpose, thread-builder, launch-thread, changelog-thread)
   now chain natively — post the first, then pass its `platformPostId` as the next post's `inReplyToId`. The
   old "numbered standalone" caveat has been removed from those skills.
2. **`aiGenerated` policy — ✅ LOCKED = Option C (the user decides).** capx never forces the flag. Uniform rule
   across every write path: **before posting/scheduling, ask the user whether to label the post(s) AI-assisted
   and pass `aiGenerated` per their answer; default `false` (opt-in) when unspecified.** It is an honesty
   label: for text it does not block — casserole decides sending on its own rules. Implemented end-to-end:
   `post_now` + `preview` take it from the caller (default false); loops carry a **per-loop** choice
   (`loops.ai_generated`, default false — the old hard-coded `true` in `postFromLoop` is gone); the four skills
   that hard-coded/conditioned it (repurpose, launch-thread, quickstart, til) now state the uniform rule, and
   the silent skills inherit the default. **This is the "no inconsistency anywhere" resolution.**

_Related: `GTM-PLAN.md` §6 (skills = the content engine), `STATE.md` §5.9 (skills are permissive-licensed),
`HANDOVER-SEEDS.md` TBD ledger #1._
