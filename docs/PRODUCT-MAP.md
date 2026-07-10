# capx — Product Map

The named products, their boundaries, and how they interact. Hospitality theme: a **café** out front (public), a proprietary **kitchen** behind it, and every order passing the **casserole** (quality) before it's served.

## The products

| Product | Role | Source | Package / repo | Status |
|---|---|---|---|---|
| **capx-cafe** | X + LinkedIn posting, scheduling, management, analytics, calendar/composer UI. Holds the OAuth tokens; does the actual posting. | 🔓 **OPEN** (AGPL) | fork of **Postiz** — *separate repo* | not forked yet (P7); reached via `@capx/platform-client` (Fake) |
| **capx-chef** | AI **content generation** engine + its own AI guardrails/enablement (drafts, graphics, voice/style). **Most AI-heavy.** | 🔒 CLOSED | `services/chef` (+ future `@capx/chef`) | not built (Phase 2 / "giga-chad-agency") |
| **capx-canteen** | **Loops** — scheduled AI recurring posting. **2nd most AI-heavy.** | 🔒 CLOSED | `@capx/canteen` | orchestrator built + tested |
| **capx-casserole** | Anti-spam / anti-AI-slop **six-layer guard**. The **mandatory chokepoint**. | 🔒 CLOSED | `@capx/casserole` | built + tested (19 tests) |
| **capx-counter** | Credits / billing / metering (pay at the counter). | 🔒 CLOSED | `@capx/counter` | built + tested (10 tests) |
| **capx-conductor** | Identity / whitelist / tenancy / roles — directs who gets on. | 🔒 CLOSED | `services/conductor` | not built (P2) |

**Not products (shared plumbing):** `@capx/core` (domain types), `@capx/config` (env validation), `@capx/platform-client` — the **"waiter"** that carries orders between the kitchen and capx-cafe.

## The one hard boundary

**Only capx-cafe is open.** Every other product is closed and talks to capx-cafe **only over its HTTP API through the `platform-client` seam** — never compiled into the fork. This is the AGPL open/closed line, **legally validated 2026-07-10**, and enforced on every build by `tools/boundary-guard.mjs`.

## How they interact

**A Loop post (autonomous):**
```
capx-canteen  →  capx-chef   →  capx-casserole  →  capx-counter  →  ⟨waiter⟩  →  capx-cafe
 (Loop fires)    (draft)         (guard: pass/         (meter/charge)   HTTP API      (publish)
                                  hold/regen/block)
```
capx-casserole is the mandatory chokepoint — **nothing reaches capx-cafe unguarded**. (Proven by the chokepoint tests in `@capx/canteen`.)

**A manual post (typed into capx-cafe's own UI):** capx-cafe's pre-publish webhook calls **capx-casserole** (allow / hold / deny) *before* it posts — so even open-side content passes the closed guard.

**Cross-cutting:**
- **capx-conductor** gates who/what on every request (whitelist + 3-handle cap + tenancy).
- **capx-counter** meters capx-chef (AI gen) + capx-canteen (posting) + capx-cafe reads (analytics).
- **capx-casserole** is shared by capx-canteen, capx-chef, and capx-cafe's webhook.

## Naming index

café (the public storefront) · chef (cooks the content) · canteen (recurring service = Loops) · casserole (quality control) · counter (where you pay) · conductor (directs who boards).
