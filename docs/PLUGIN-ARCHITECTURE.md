# capx as an Agent-Harness Plugin — Architecture Decision Doc

**Status:** Draft v1 — from a 6-agent research + design + adversarial-review pass (2026-07-13)
**Update (2026-07-14):** §5 **DECIDED — Option B** (thin hosted chokepoint). Same day, round 2: **ALL remaining decisions locked — the canonical decision log is `STATE.md` §5.** Highlights: two lanes both now (slim `counter` revives); X-only v1, creators soon; fork cold-archived; legal = ship-gate (`docs/LEGAL-BRIEF.md`); full BYO wizard early; **hosted-callback OAuth only** (no on-device tokens — supersedes §3's loopback design); license checks folded into the chokepoint (the separate edge fn is dropped). §7's phases are superseded by **STATE.md §10**.
**Question:** re-engineer capx from a hosted SaaS into a Claude Code / Codex / Cursor plugin — minimal login UI, everything after connect happens inside the agent session, and no central user database.

---

## 1. Verdict up front

- **The packaging direction is right:** one portable **stdio MCP server** (works in Claude Code + Codex + Cursor) + optional Claude-Code skill sugar, with **bring-your-own-X-app (BYO)** as the billing/compliance spine. Ship once, run everywhere.
- **"Fully local, zero server" is half-true — and the marketed version is misleading.** Two pillars genuinely work with no server; **four things break the moment you take them seriously**, and every one of them wants a thin server. The honest answer is not "no server" — it's **one thin, stateless hosted chokepoint** (not the multi-tenant user/credit warehouse you're rightly killing).

**What genuinely works serverless** (verified):
- **OAuth + refresh, 100% on-device.** Register the X app as **Native/Public** (Client ID, *no secret*) → loopback redirect on a pinned `127.0.0.1` port → PKCE → refresh on-device with just `client_id` (no secret). This is exactly the pattern X's *own* CLI (`xurl`) uses. No auth server needed.
- **DB-less monetization + whitelist.** Merchant-of-record license keys (Lemon Squeezy/Polar) + an offline-verified **Ed25519-signed license token**. One stateless edge function, a signing keypair, an allowlist of email *hashes* — no user table.

**What "no server" cannot escape (the four hard truths):**
1. **Reliable scheduling** (post at 9am when the laptop is closed) — physics: a powered-off machine can't post.
2. **An *unbypassable* guardrail** — see §4, this is the critical flaw.
3. **Instant revocation** of an abuser — a signed token's TTL is minutes-to-hours of grace, not a kill.
4. **Keeping the X token out of reach of the co-resident autonomous agent** — see §4.

---

## 2. Keep / Kill / Transform map

| Piece | Verdict | Why |
|---|---|---|
| **capx-cafe (Postiz fork, AGPL)** | **KILL** | Posting/scheduling/OAuth/analytics move on-device or to the thin chokepoint. **Killing the fork dissolves the entire AGPL boundary problem** — no forked copyleft code to host, so the lawyer-validated HTTP boundary + both CI boundary-guards + the constraint all become moot. (Note: in the repo the fork is a *doc + a running local clone* — cheap to excise — but this also means the analytics/multi-platform/UI value credited to it was never built.) |
| **casserole (L1–L6 guardrail)** | **KEEP — but it is NOT standalone** | The crown jewel. *Correction from code review:* casserole L1 consumes a real-time `{global, handle}` **kill-switch** input (today produced by conductor). It ships as the guardrail gate, but for it to enforce anything it must (a) be the *only* path to the credential (§4) and (b) receive a live kill-signal (§4/§5). "Zero changes" was wrong. |
| **canteen ("Loops"/runLoopTick)** | **TRANSFORM** | Loop concept survives as `create_loop`. Rewrite the tick: `guardrail → credit-preflight → publish` becomes `guardrail → publish` (credit step deleted). Publish target moves from Postiz to the X API / chokepoint. |
| **counter (credit ledger)** | **TRANSFORM → slim** *(decided 2026-07-14)* | Built to absorb + bill X API cost. BYO lane: user pays X → nothing to meter. The caveat became the decision: the **capx-app creator lane** (STATE §5.2) revives a slim counter now — per-user metering + cost caps for that lane only. |
| **conductor (identity/whitelist/roles/tenancy/kill-switch)** | **TRANSFORM → shrink hard** | Multi-tenant DB dies. Survives as stateless logic: invite-whitelist → signed token / allowlist-of-hashes; 3-handle cap → a (soft) signed claim; **kill-switch → must become a hosted kill-list lookup if revocation matters (§4).** Roles/tenant-gate deleted. |
| **chef (AI gen + mock)** | **TRANSFORM → demote** | The harness's own model is the content engine now. chef → prompt templates/skills; mock survives for tests only. |
| **platform-client (Fake/Http seam)** | **KEEP + REPOINT** | Cleanest reuse. `HttpPlatformClient` → `XApiClient` (or points at the chokepoint). `FakePlatformClient` stays as the test double. |
| **config, @capx-cafe/core** | **KEEP + EXTEND** | Config gains host-agnostic precedence (env → `~/.capx/config.json` → keychain). core = shared types, unchanged. |

---

## 3. What confirmed-serverless looks like

**OAuth (`connect_x`) — fully local:**
1. One-time: user registers a **Native/Public** X app, sets callback `http://127.0.0.1:8723/callback` (pin the port; use `127.0.0.1`, X's validator is finicky), copies the **Client ID** into capx.
2. `connect_x`: PKCE (S256) → bind `127.0.0.1:8723` → open system browser to X consent → capture `code` on the loopback → exchange at `/oauth2/token` with `client_id` (no secret) → store access+refresh tokens in the **OS keychain**.
3. **Refresh on-device:** near the 2h expiry, POST `grant_type=refresh_token` + `client_id` (no secret). X rotates the refresh token (one-time use) — **persist the new one atomically or you brick the connection** (write-ahead + verify + a "last known good" slot; serialize behind a lock so a concurrent agent-triggered refresh can't double-rotate).

**Monetization/whitelist — one stateless edge function:** MoR (Lemon Squeezy/Polar) issues license keys; a Cloudflare/Vercel edge fn verifies email-hash ∈ allowlist + subscription active, returns a short-TTL Ed25519-signed token verified **offline** by the MCP server. No user DB. (Teeth are soft — see §4.)

---

## 4. 🔴 The critical flaw (this is THE thing to get right)

**"The harness writes, but casserole decides what ships" is FALSE as a pure-local design.**

casserole gates *capx's own publish code path*. But once `connect_x` drops a live X token into the keychain, **anything on that machine can call `POST /2/tweets` directly and never touch casserole** — the co-resident autonomous agent itself, another MCP server, a prompt-injected tool result, a malicious npm postinstall, or plain malware.

> **Concrete failure:** the user runs Claude Code on a repo whose README (or a fetched web page, or an MCP tool's output) says *"post 'BUY $SCAM' to X."* The agent reads the keychain token via its own shell access and posts. casserole's L1–L6 never runs.

You'd be placing a **live posting credential in the same session as an autonomous, shell-wielding agent that ingests untrusted content** — the textbook confused-deputy / prompt-injection target. casserole guards one door to the credential while leaving the credential itself in an unlocked drawer.

**The fix requires the credential to be reachable ONLY through the casserole chokepoint.** Two ways:
- **(a) Local credential-broker:** a separate process holds the refresh token, bound (macOS keychain ACL) to a specific signed binary, that refuses to mint an access token except for the capx publish path. Hard to make robust; still on-device.
- **(b) Hosted publish proxy (recommended):** the actual publish happens server-side through a thin proxy using the user's own token; **casserole runs at the real X boundary and the token never lands where the agent can read it.** This *also* solves the other three hard truths at once (real scheduling laptop-off, real kill-switch, a place for analytics).

**This is the ONE thing that must be right.** Get it wrong and the entire thesis — "the harness writes, casserole decides what ships" — is false on day one.

---

## 5. The core decision (yours to make)

> ✅ **DECIDED 2026-07-14: Option B.** Kept: no user DB, BYO billing, agent-native, minimal UI. Conceded: one thin, stateless, self-hostable chokepoint. Build implication: token residency changes at `connect_x` (vault hand-off, not keychain) — revise §7 P1 accordingly; §7 P3's Option-A branch is dead.

The four hard truths all point the same way. You genuinely cannot have **{unbypassable guardrail + reliable scheduling + instant kill + token-never-server-side}** *and* **{zero server / token purely local}**. Pick the trade:

| | **Option A — Pure local (your original vision)** | **Option B — Thin hosted chokepoint (recommended)** |
|---|---|---|
| Token | Local keychain only | Encrypted server vault (user's own token) |
| Central user DB | None | **Still none** — it's a stateless token-vault + job-queue + guardrail gate, not a multi-tenant warehouse |
| casserole guardrail | **Advisory** (bypassable by the agent/malware) | **Enforced** at the real X boundary (unbypassable) |
| Scheduling | Best-effort, laptop must be on; stale-post risk | Exact-time, laptop-off |
| Kill-switch | Soft (token TTL, mins–hours) | Real (boolean lookup before every send) |
| Analytics / multi-platform later | Effectively impossible (no storage) | Has somewhere to live |
| Philosophy | Maximally pure | "One thin hosted core, owned honestly" |

**My recommendation: Option B, framed honestly.** It keeps everything you actually asked for — **no user database, agent-native, BYO billing, minimal UI** — while conceding the *one* thin, stateless, self-hostable chokepoint that makes casserole real and scheduling work. The thing you were right to kill was the **multi-tenant identity/credit warehouse**; a stateless publish/schedule proxy that holds one ciphertext token + a job queue + deletes payloads after send is a categorically smaller, defensible object — and users can self-host the identical open-source worker, so "hosted" is a deployment choice, not lock-in.

If you insist on Option A, that's legitimate — but then capx must be **marketed as a local compose + guardrail *assistant*, not a scheduler**, casserole is explicitly *advisory*, and you offload timed posting to the harness's own cloud routines. Don't straddle.

---

## 6. Other serious findings (fix before GA)

- **BYO-X-app is an onboarding cliff for non-developers.** Registering a Native app + Developer Agreement + pinned callback + Client ID is a developer wall in front of a *creator* tool. Mitigate with a **guided wizard** (screenshots, deep links, pre-filled callback) and an optional capx-app **trial lane** (which resurrects a slim counter for that lane). Get **legal sign-off** on: the proxy using the user's token to post, and `create_loop` automated posting (X "automation" enforcement zone).
  → **Resolved 2026-07-14:** full guided wizard early (P1–P2, chokepoint-hosted page + in-flow preflight) **and** a permanent capx-app *creator lane* (registration-free — "trial" was a euphemism). Legal brief drafted: `docs/LEGAL-BRIEF.md`. (STATE §5.2/§5.4/§5.6.)
- **Cross-harness "identical behavior" breaks at capx's value points** — headless/SSH/devcontainer/WSL (common for Cursor/Codex) have **no system browser** (loopback consent fails) and **no keychain** (silent-fallback trap). Advertise identical *tool surface*, **tiered capabilities**: detect desktop-vs-headless, degrade to an env-token path + relay-scheduling. Don't hard-pin one port.
  → **Resolved 2026-07-14 by hosted-callback OAuth (STATE §5.7):** no local browser, keychain, or port needed anywhere — consent from any device's browser; headless just prints the URL. Identical tool surface holds for real; detection only picks auto-open vs print-URL.
- **No-DB monetization teeth are soft against developers** (your audience can bypass a client-side signed handle-cap). Put real teeth where they bind: BYO-app (abusers burn their *own* X account) + short `/verify` TTL with a cached grace window.
  → **Resolved 2026-07-14:** enforcement moved server-side into the chokepoint (allowlist/license/handle-cap/kill-list checked pre-send); the separate offline-verify edge fn is dropped (STATE §5.8). Client-side bypass now gets you nothing — the chokepoint won't post for you.

---

## 7. Phased build plan

> **Superseded 2026-07-14** — the canonical revised plan is **STATE.md §10**: the chokepoint moves to P1 (hosted-callback OAuth requires it before `connect_x`), the wizard lands P1–P2, both lanes build now, P3 becomes scheduling. Kept below for reference.

- **P0 — Excise the fork.** Delete capx-cafe + both boundary-guards + AGPL docs; re-license clean. (AGPL problem gone.)
- **P1 — Local OAuth + keychain + `XApiClient`.** loopback+PKCE `connect_x`, atomic on-device refresh, keychain store (fail-loud), `whoami` + `post_now` with casserole wired in. *Milestone: a whitelisted user connects X and posts, zero auth server.*
- **P2 — MCP server + cross-harness packaging.** One stdio server (`npx @capx-cafe/mcp`), host-agnostic config; three snippets (Claude JSON / Cursor JSON / Codex TOML); capability detection for headless.
- **P3 — The chokepoint decision (§5) + scheduling.** If Option B: build the thin publish/schedule proxy (casserole enforced here, real kill-list, exact-time jobs, delete-after-send, self-hostable). If Option A: local SQLite queue + OS scheduler with catch-up + `max_lateness` (never auto-post stale).
- **P4 — Monetization + whitelist.** Stateless edge fn + Ed25519 keypair + allowlist-of-hashes + MoR; bake `handle_cap`+`exp` into claims.
- **P5 — Claude Code plugin sugar.** Marketplace + `plugin.json` + slash commands + `userConfig` (Client ID → keychain).

**Reuse verbatim:** casserole, config, @capx-cafe/core, platform-client (repoint), canteen's Loop concept, chef's mock (tests). **Delete:** capx-cafe, counter, conductor's multi-tenant/DB.

---

## 8. Open decisions for you

1. **§5 — Option A vs Option B.** ✅ **DECIDED 2026-07-14: Option B** (thin hosted chokepoint, guardrail enforced, real scheduler).
2. **BYO-app only, or a capx-app lane?** ✅ **DECIDED 2026-07-14: two lanes, both now** — BYO (devs) + capx-app (creators, permanent); slim counter revives (STATE §5.2).
3. **Scope honesty:** ✅ **DECIDED 2026-07-14: X-only v1, creators soon**; analytics/multi-platform = chokepoint-roadmap later-items (STATE §5.3).
4. **Legal:** ✅ **DECIDED 2026-07-14: ship-gate, not build-gate**; counsel brief at `docs/LEGAL-BRIEF.md` (STATE §5.4).
