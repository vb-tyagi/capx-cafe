# capx — Counsel brief: X posting compliance (DRAFT for review)

_Prepared 2026-07-14. Requesting written sign-off (or required changes) on the two posting lanes below.
Per decision (STATE.md §5.4), this review is a **ship-gate**: development proceeds in parallel, but no
automated posting is enabled for anyone beyond the founder's own accounts until sign-off._

---

## 1. Product + architecture (context for all questions)

**capx** is an agent-native X (Twitter) posting assistant: an MCP plugin used inside AI coding agents
(Claude Code / Codex / Cursor). A whitelisted user connects an X account once; afterwards they create,
schedule, and manage posts from inside their agent session. Key architectural facts:

- Posting and scheduling run through a **thin hosted service ("the chokepoint")** operated by capx.
  The identical worker is open for **self-hosting**, so the hosted deployment is a choice, not lock-in.
- **OAuth 2.0 + PKCE**; access/refresh tokens are stored **encrypted server-side only** — they never
  exist on the user's machine. Post payloads are **deleted after send**.
- There is **no multi-tenant user database** — the service keeps an allowlist of email *hashes*,
  license/subscription state (via a merchant of record), a kill-list, and a job queue.
- **Every publish passes an enforced content guardrail (casserole, six layers)** plus a per-handle and
  global **kill-switch lookup before every send**. This cannot be bypassed by the user's agent or tools,
  because the credential is only reachable through this path.
- Payments are handled by a **merchant of record** (Lemon Squeezy or Polar — TBD); capx never touches
  card data.

**Two lanes:**
- **Lane A — BYO (developers):** the user registers **their own** X developer app (Native/Public client,
  no secret) and authorizes it; capx's chokepoint holds and uses *that app's* user tokens (custody,
  API routing, token refresh) to post on the user's behalf.
- **Lane B — capx-app (creators):** capx's **own registered X app** posts on behalf of users who
  authorize it — the conventional third-party-scheduler model (cf. Buffer/Typefully). Per-user metering
  and cost caps apply.

## 2. Questions for counsel

1. **Lane A (the novel question).** Each BYO user is the registered *developer* of their own X app and
   is bound by X's Developer Agreement for it. Does capx's hosted service **holding and using that
   app's tokens** (encrypted custody, request routing, on-server refresh) sit within the user's
   obligations — in particular any token-security, non-sharing, or "your app = your responsibility"
   clauses? If conditions apply, what terms must capx impose on BYO users (e.g., in our ToS) to keep
   each user compliant?
2. **Lane B (conventional, confirm posture).** Posting user-authorized content through capx's own app:
   confirm the compliance posture under the X Developer Agreement and Developer Policy, including what
   the shared app must enforce so that one abusive user does not jeopardize the app for all users
   (our enforced guardrail + per-handle kill-switch + caps are the built-in mitigations — see §3).
3. **Automation rules (both lanes).** `create_loop` enables **scheduled and recurring** posting.
   Under X's Automation Rules / spam policy: what frequency, duplication, and disclosure constraints
   must be **product-enforced**? (Note: the guardrail already blocks duplicate/templated slop by
   design.) Anything specific to *AI-generated* content disclosure?
4. **Consumer-facing terms.** The creator lane makes capx a consumer product: we need capx ToS +
   privacy policy. Personal data handled: email (as a hash for allowlisting; MoR holds the actual
   billing identity), encrypted X tokens, post payloads (transient — deleted after send), schedule
   metadata. Please advise on the minimum policy set and any data-protection registrations required.
5. **FYI only (no question).** A previously planned AGPL component (a Postiz fork) is being archived
   **unused** — no AGPL code ships in this product.

## 3. Compliance narrative (why this design is defensible)

- The guardrail is **enforced at the API boundary**, not advisory — the posting credential is
  reachable only through it (relevant to platform-manipulation and spam-prevention duties).
- **Instant revocation**: per-handle and global kill-switch checked before every send.
- **Data minimization**: no user database, hashed allowlist, delete-after-send payloads.
- **Gated rollout**: whitelist-only alpha; abuse in Lane A burns the abuser's *own* app and account.

## 4. What we ask

Written sign-off, or a list of required changes, on Lanes A and B — before any automated posting is
enabled beyond the founder's own accounts. Flag anything above that changes materially if capx also
posts to platforms other than X in the future (roadmap item, not v1).
