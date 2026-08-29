# X developer-policy compliance — founder checklist (2026-08-29)

X's 2026 policy round made three things load-bearing for the capx-owned app (the creator lane).
This is the founder's action list; the product-side enforcement already exists in code.

## 1. Registered use case (BINDING — file before the creator-lane beta opens)

X treats the submitted use-case description as contractually binding; material changes need
notice + approval BEFORE operating them. File this locked text (approved 2026-08-29) on the capx
app in the [X Developer Portal](https://developer.x.com/en/portal/dashboard) → Projects & Apps →
the capx app → Settings → use case / app details (if the field is frozen, via
[developer support](https://developer.x.com/en/support) as a use-case update):

> capx café is a posting assistant for X. End users explicitly authorize the app via OAuth 2.0 and
> compose or approve their own content inside their development tools; the app publishes that
> content to the user's own account immediately or on a user-defined schedule including attached
> media. Every post passes a server-side content-quality and rate guardrail before publication. The
> app posts only to the authorizing user's own account: it does not read other accounts' content,
> does not automate engagement (likes, follows, replies to third parties), and does not generate
> content itself. Users may label posts as AI-assisted. Volume is capped per user per day.

Status: [ ] filed · [ ] acknowledged/approved by X

Code keeps this wording true: replies are structurally restricted to the user's own posts (gate
policy, both lanes); capx generates no content; per-user caps enforced at the gate.

## 2. Bot self-identification (day-one rule — LOCKED: surface + attest)

Automated accounts must self-identify in the profile bio, no grace period. Locked approach:
onboarding states the rule + links X's automation policy + one-time checkbox attestation
("my bio discloses automation where required"); the notice repeats at `create_loop` (scheduling is
the clearly-automated surface). No technical bio enforcement (no lookup spend, no false positives).

- [ ] Attestation copy added to the connect flow (creator lane)
- [ ] Same notice in the `create_loop` skill/tool response

## 3. AI-generated replies (explicit prior written approval required)

X requires written approval for apps that use AI to generate and post replies. capx therefore
ships **threads only** (replies chained onto the user's OWN posts — enforced in the gate); replying
to third parties is structurally blocked. That feature (and capx-scope generally) stays gated on
X's written sign-off — do not enable it in product before the letter exists.

- [ ] (only if/when wanted) approval request drafted and sent to X

## 4. One-time verifications in the developer console

- [ ] Glance at the pay-per-use billing sheet to confirm media upload carries no separate fee
      beyond the $0.015 post-create (aggregators say it doesn't; the per-endpoint sheet is
      console-only). Economics assume $0.015 — see `docs/ECONOMICS.md` §1.
- [ ] Confirm the capx app's credits balance + auto-top-up posture before opening the beta.
