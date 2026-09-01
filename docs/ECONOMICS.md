# capx café — creator-lane economics (locked 2026-08-29)

The money model behind the Short/Tall/Grande tiers. Companion to `docs/STATE.md` §5 (decision log),
`packages/counter/src/plans.ts` (the enforced numbers — **that file is the single source of truth**;
this doc explains them), and `docs/GTM-PLAN.md`.

## 1. What X charges capx (pay-per-use, verified 2026-08)

X discontinued the free tier for new developers (Feb 2026) and auto-migrated Basic (Jun 2026).
New developer apps — including capx's own app powering the creator lane — pay per request:

| X action | Cost to capx |
|---|---|
| Create a post (text or media) | **$0.015** |
| Create a post **containing a URL** | **$0.20** (~13×) |
| Read a post (used once at reply-verification) | $0.005 |
| User lookup | $0.010 |
| Quote-posting via API | **not available** (Enterprise-only since Apr 2026) — capx does not offer QRT |

Two structural consequences drove the whole tier design:
1. **The URL multiplier is the entire cost model.** URL posts get their own quota everywhere, and are
   banned outright on Short.
2. **Media posts bill as standard writes** — media allowances are product differentiation, not a
   cost guard.

## 2. The tiers (enforced in `counter`; billed by P4/Polar)

| | **Short $5/mo** | **Tall $15/mo** | **Grande $35/mo** |
|---|---|---|---|
| Posts / month (umbrella) | 70 | 200 | 500 |
| URL ("link") posts | **banned** | 25 | 50 |
| Threads (≤10 posts each, universal) | none | 10/mo | within post quota |
| Media posts | 10 | 30 | 100 |
| Active loops | 0 | 3 | "unlimited\*" = up to 21 active |
| Accounts (one shared quota pool) | 1 | 2 | 5 |
| **Worst-case X cost to capx** | ≈ $1.05 | ≈ $7.63 | ≈ $16.75 |
| **Worst-case gross margin** | ≈ 69% | ≈ 41% | ≈ 45% |
| Typical-usage margin (~½ quota) | ~80% | ~65% | ~68% |

Pricing philosophy (locked): **cost-floor, not cost-plus** — quotas are sized so even a maxed-out
subscriber leaves real margin; typical usage (breakage) is upside, never the plan.

**Rules that keep the math true** (all enforced server-side at the gate):
- Thread posts may not contain URLs (else a 10-post thread of links = $2.00 of hidden cost).
- No trials, no discounts at beta. Cycles = UTC calendar months.
- Quotas key on the subscription (emailHash), so multi-account plans share one pool by construction.
- Replies chain only onto the subscriber's own posts (one $0.005 verification read for posts capx
  didn't send; zero-cost via the thread index for posts it did).

## 3. Top-up packs (cycle-scoped, stack freely, expire at cycle end)

| Pack | Adds | Price | Available on | Worst-case cost | Margin |
|---|---|---|---|---|---|
| Posts | +50 standard posts | $2 | all plans | ~$0.75 | ~58% |
| URL | +10 URL posts | $3 | Tall/Grande | ~$2.00 | ~29% |
| Media | +10 media posts | $1 | all plans | ~$0.15 | ~83% |
| Threads | +10 threads | $1 | Tall/Grande | ~$0 (capacity) | ~100% |

A pack never unlocks what a plan structurally bans (Short + URLs/threads). Purchases take a
quantity (buy N packs in one checkout).

## 4. The BYO lane (free, and honest about X's prices)

BYO developers bring their own X app: **they are X's customer and pay X directly** — capx meters
nothing on that lane. Since Feb 2026 that means: a credit card + pre-loaded credits in the X
developer console **before the first post**, then $0.015/post ($0.20 with a link). A daily
build-in-public post linking your repo runs **≈ $6/month paid to X** — say it plainly in onboarding;
never imply a free X on-ramp. Heavy/self-host users: run the identical AGPL chokepoint image with
your own app — capx's hosted costs stay out of your path entirely.

## 5. Fixed costs (context, not per-user pricing inputs)

Cloud Run chokepoint + poller ≈ $15–40/mo total at beta scale; KMS + secret manager ≈ $1–3/mo;
Postgres rows per user ≈ KBs (audit + loops + thread index). Marginal infra ≈ $0.10–0.25/user/mo —
noise next to X fees. Break-even on fixed costs ≈ a handful of Tall subscribers.

## 6. Dormant lines (structure ready, cost $0 today)

- **Hosted AI generation: OFF** (locked; "capx generates no content"). The `chef` seam exists; if a
  P4+ decision ever turns it on, its cost line gets its own margin — nothing else here changes.
- **capx-scope** (read product) is out of scope and separately gated on X's written approval.

## 7. Anti-spam velocity caps — ✅ RESOLVED (founder, 2026-09-01)

Plan quotas stay **monthly with no daily quota**\* — but two product-wide anti-spam velocity caps
protect every handle (both lanes) from X's burst-sensitive spam enforcement, enforced in casserole
L2 via the gate (`ACCOUNT_HOURLY_CEILING = 10/hour`, `ACCOUNT_DAILY_CEILING = 40/day`, rolling
windows; replaces the P1-era 25/day):

- **10 posts / rolling hour** and **40 posts / rolling 24h**, per handle.
- These are *safety ceilings, not billing* — they never consume quota, and a capped post is simply
  refused with the reason stated.
- Marketing rule: anywhere "no daily limit" appears, carry the asterisk —
  \* *Anti-spam velocity caps (10 posts/hour · 40/day) protect your account from X's spam
  enforcement. Monthly quotas are the only billing limits.*
