# capx café — Go-to-Market & Marketing Plan

_Created 2026-07-18. Strategy of record for launching + marketing the capx-cafe MCP server._

---

## ✅ LOCKED DECISIONS (founder, 2026-07-18)

| Decision | Locked value |
|---|---|
| **License — permissive half** | **MIT** (client + `core`/`config`/`platform-client` + skills/docs) |
| **License — server half** | **AGPL-3.0** (chokepoint + casserole/captain/counter/canteen/chef) — STATE §5.9 |
| **Launch shape** | **Feature-rich** — build all write-skills + media FIRST, then publish + launch with a wow |
| **Repo** | Move to a **`capx` GitHub org** before going public (off personal `vb-tyagi`) |
| **Contributor terms** | **CLA** required before the first outside PR (keeps relicensing possible) |
| **Trademark** | Register **"capx café"** (the un-forkable moat; founder's legal to action) |
| **Docs home** | In-repo `/docs` first; a dedicated docs/landing site at launch |
| **Flagship launch skill** | **build-in-public** (git log → a week of posts) |
| **Analytics/replies** | **Spun out** to a separate read-side product ("capx-scope", TBD) — not in this launch |

Remaining pre-launch actions (not decisions — execution): `npm publish` the bundle, ship the "beast" README +
landing page + demo video, set up the CLA bot, file the trademark, list in the MCP directories.

---

## 0. The one-line positioning (lead with this everywhere)

> **The safe way to let your AI run your X. The only one where your token never lives next to the agent,
> and every post passes a guardrail before it ships.**

Feature-parity with "post to X" tools is table stakes. **Safety is the wedge.** Every competing tool tells
you to paste your X token into a plaintext config file next to an autonomous agent that reads untrusted
content. We are the only one that structurally can't be prompt-injected into posting a scam. That is the
whole story — do not bury it under feature lists.

**Audience order:** (1) developers using coding agents (immediate), (2) creators who want zero-setup
scheduling (near-term, needs the capx-app lane + pricing).

---

## 1. What actually ships (the deliverables map)

| Layer | Deliverable | Status |
|---|---|---|
| Universal | `capx-cafe` on **npm** (`npx capx-cafe`) | built, needs publish |
| Discovery | Listings: MCP registry, Smithery, Glama, mcp.so, awesome-mcp-servers | TODO |
| Per-agent | Claude Code plugin + marketplace | ✅ built |
| Per-agent | Cursor "Add to Cursor" deeplink + MCP directory listing | TODO |
| Per-agent | Codex / Windsurf / Cline / Zed copy-paste snippets | TODO (trivial) |
| Trust | The **security page** (the single most important asset) | TODO |
| Trust | Public GitHub repo + "absolute beast" README + demo GIF | TODO |
| Web | Landing page / docs site | TODO (gated) |

---

## 2. Phase 0 — Launch-ready (before telling anyone)

- [ ] **Repo public** (move to a `capx` GitHub org, not personal). Secret-scan already clean.
- [ ] **License chosen** (client MIT/Apache; chokepoint permissive-or-BSL — see licensing TBD).
- [ ] **npm publish** `capx-cafe` (`pnpm --filter @capx-cafe/mcp build` → `cd apps/capx-mcp/dist && npm publish`).
- [ ] **README** — trust story FIRST, then 60-sec install, then the per-agent matrix. This is the doc most
      people read; it must be excellent.
- [ ] **Demo asset** — a 30–60s GIF/video: connect X → ask the agent to post → it appears on X, with the
      "token never touched my machine" line on screen.
- [ ] **Security page** — the confused-deputy problem, the mailroom/vault architecture, the red-team proof,
      self-host option. This converts skeptics.
- [ ] **Directory listings** prepared (MCP registry entry, Smithery/Glama/mcp.so, awesome-mcp-servers PR).

## 3. Phase 1 — The meta-launch (the unfair move)

- [ ] **Launch capx *using* capx.** Write the launch thread; post it *through the tool.* Hook:
      "This thread was posted by my AI agent, guardrailed, and my X token never touched my laptop —
      here's how." It's a live demo, a proof, and a hook in one artifact. This is the single highest-
      leverage marketing act available and costs nothing.

## 4. Phase 2 — Channels, in fit order (highest intent first)

1. [ ] **MCP community** — r/mcp, MCP Discord, the directories above. Highest intent, lowest skepticism.
2. [ ] **Agent communities** — r/ClaudeAI, r/cursor, OpenAI/Codex forums, Windsurf/Cline Discords.
3. [ ] **Hacker News (Show HN)** — lead with the *security architecture*, not the feature. "How we keep an
       X token out of reach of a co-resident AI agent" is a front-page-shaped title. Expect scrutiny;
       the open-source + red-team-tests + self-host answers most of it. Post Tue–Thu morning ET.
4. [ ] **Product Hunt** — schedule after HN; reuse the demo GIF; line up early supporters.
5. [ ] **Dev-content deep-dive** — a written post ("keeping a credential away from a co-resident agent")
       on the capx blog / dev.to. Doubles as SEO + credibility; link from README and HN.

## 5. Phase 3 — Compounding

- [ ] Fast public issue triage (open repo = visible responsiveness = trust).
- [ ] **Each new skill is a mini-launch** — the skills roadmap is the ongoing content engine (see below).
- [ ] Collect + showcase real "posted-by-my-agent" examples from early users.
- [ ] Only after real creator demand: turn on the capx-app lane pricing (P4) and market to creators.

---

## 6. The skills roadmap = the real moat + the content engine

capx sits inside a *coding* agent — so it has what no social scheduler has: the user's **repo, commits,
PRs, releases**. Skills that write content *from what the developer already did* are the defensibility.

- **Build-in-public from your git log** ← the flagship bet. Agent reads recent commits → drafts a week of
  posts → queues a loop. Ship this as launch-week #2.
- Turn this PR / release into an announcement thread.
- Repurpose a blog post / README into a thread.
- Voice-matching (calibrate drafts to the user's past posts).
- Best-time-to-post intelligence.
- Later (need new X scopes + guardrail review): replies/engagement, analytics.

Rule: **write-skills first** (ride existing casserole, safe by default); **read-skills later** (need new
permissions + privacy review). A full prioritized skills plan is a TBD (tracked in HANDOVER-SEEDS ledger).

---

## 7. Open-core positioning (how the money works while the code is free)

- **Open:** all code — client, chokepoint, guardrail. Read, self-host, contribute.
- **Paid:** the *running* hosted service — capx's managed X app (creators skip developer.x.com), uptime,
  kill-switch/allowlist ops, creator features.
- **The moat is not code secrecy:** it's (1) the managed X app self-hosters can't replicate without
  registering their own, (2) being the reputable always-on boundary people hand tokens to, (3) velocity +
  brand + community.
- **Proven model:** Cal.com, PostHog, Supabase, Plausible, Dub — OSS + hosted paid.
- **License nuance (get 10 min of counsel, don't let it block launch):** client permissive; chokepoint
  either permissive (max trust/adoption) or source-available BSL/AGPL (blocks a hosted clone). Recommended:
  **ship permissive, keep BSL in the back pocket** — at nascent stage nobody clones your service, and a
  restrictive license hurts early trust more than it protects.

---

## 8. Metrics to watch (pick a few, don't vanity-chase)

- npm weekly downloads of `capx-cafe`.
- GitHub stars + unique repo visitors (trust proxy).
- # connected accounts (real usage), # posts shipped, # loops running.
- Directory placement / rank (MCP registry, Smithery).
- Qualitative: are people posting *about* capx *with* capx? (the meta-loop working)

---

## 9. Immediate ordered checklist (when the go-decision is made)

1. Pick license(s). 2. Repo → `capx` org → public. 3. `npm publish`. 4. Ship README + security page +
demo GIF. 5. Directory listings. 6. Meta-launch thread (posted via capx). 7. Show HN. 8. Ship the
git-log skill as the week-2 follow. 9. Product Hunt. 10. Iterate in public.

_Related docs: `HANDOVER-SEEDS.md` (foot-guns, TBD ledger, casserole pinned points), `P1-CHOKEPOINT.md`
(architecture), `STATE.md` (decision log)._
