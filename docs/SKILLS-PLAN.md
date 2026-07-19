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

**What it requires (regardless of choices):**
1. **X media-upload flow** — X media isn't a single call: it's INIT → APPEND (chunked bytes) → FINALIZE →
   get `media_id` → attach to the tweet. New code in the x-adapter + a new chokepoint path.
2. **Getting the image bytes to the server** — either the MCP reads the local file and streams it to the
   chokepoint, or the chokepoint fetches a URL. (The token still never leaves the server; only the image does.)
3. **AI-content labeling** — X policy requires disclosing AI-generated media. casserole already computes an
   `aiLabelRequired` flag and holds AI graphics for review; media posts inherit that. **This is a given, not
   a choice:** AI images get labeled + routed through casserole's HOLD path.

**The two real forks:**

- **M-Decision 1 — Scope:** images only in v1, or images + video? *(Recommend images-only; video adds a much
  heavier upload + processing path and most dev/creator posts are image-first. Video = fast-follow.)*
- **M-Decision 2 — Who generates the image?**
  - **BYO (recommended):** the *agent's own* image tool generates it (the user already has one — an image
    MCP, higgsfield, an OpenAI-image tool, etc.); capx **uploads + labels + attaches**. Pros: philosophy-
    consistent (capx never generates content — the agent does), zero provider cost/lock-in for capx, works
    with whatever the user already has. Cons: the user needs *some* image tool; capx doesn't offer a turnkey
    "make me an image" button.
  - **capx-integrated:** capx calls an image provider (OpenAI/Replicate/etc.) server-side. Pros: turnkey.
    Cons: capx pays per image (metering hit, esp. lane B), a provider key + lock-in, and it shifts capx into
    content *generation* (a stance change). Could be a later premium feature.

**Media-touched skills (once media lands):** any A/B skill can attach an image — e.g. **build-in-public**
can add a generated diagram, **launch-thread** a hero image, **ship-note** a screenshot. So media is a
capability layered under the existing skills, not a separate skill.

## 7. Recommended build order

- **v1 (launch batch):** A1 build-in-public · A2 ship-note · A3 repurpose · B1 voice-match · B3 draft-review
  · F2 quickstart — plus the **preview endpoint** (§6.1). Author each for Claude Code + Cursor + Codex up
  front (per the locked decision), off one canonical `SKILL.md`.
- **v2 (fast-follow, each a mini-launch):** A4, A5, A6, A7 · B2, B4, B5 · C1, C2, C3 · E2, E3 · F3.
- **v3 (gated):** D1–D4, A8 — after the scope + privacy-policy decision.

**Ship A1 first** — it's the GTM launch-week-2 headliner and the clearest "nothing else does this" moment.

---

## 8. Still-open decisions to lock (even after today's answers)

1. **Confirm the v1 list** above (A1, A2, A3, B1, B3, F2 + preview endpoint) — or adjust.
2. **Canonical-source + generator** vs hand-authoring each agent's files? *(Recommend canonical + a tiny
   generator to prevent N-way drift.)*
3. **Which agents in the "up front" set for v1?** Claude Code + Cursor + Codex is the high-coverage trio;
   Windsurf/others can be a v1.1. *(Recommend the trio for v1.)*
4. **Build the preview endpoint in v1?** *(Recommend yes — it lifts draft-review and every other write-skill.)*
5. **Naming convention** for invocations across agents (e.g. everywhere: `capx-build-in-public`,
   `capx-ship-note`…) so muscle memory ports between agents.

_Related: `GTM-PLAN.md` §6 (skills = the content engine), `STATE.md` §5.9 (skills are permissive-licensed),
`HANDOVER-SEEDS.md` TBD ledger #1._
