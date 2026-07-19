# capx café — Privacy Policy

> **Status: FINAL — locked 2026-07-19 (counsel-reviewed).** The bracketed `[CONFIRM: …]` fields hold
> company-specific values (data-controller entity, applicable privacy regimes) to slot in before public
> launch; everything else is locked. The "what we can and cannot see" table (§3) is the whole trust story —
> keep it accurate as the code evolves.

**Effective date:** 2026-07-19 · **Data controller:** [CONFIRM: legal entity + registered address] ·
**Contact / DPO:** privacy@capx.ai

---

## 1. Scope

This policy covers the **hosted capx café chokepoint** operated by capx. It does **not** cover:

- **Self-hosted instances** — if you or someone else runs their own chokepoint, that operator is the
  controller; capx receives no data from it.
- **The client (`npx capx-cafe`)** — it runs on your machine and holds no credentials; it only passes a
  session handle to the chokepoint.
- **X** — your use of X is governed by X's own privacy policy.
- **Your own media-generation tools** (higgsfield, fal, kling, etc.) — you connect these to your agent
  yourself; their data practices are theirs, not capx's. capx only receives the finished asset you attach.

## 2. What we collect and why

| Data | Why we hold it | Sensitivity |
|---|---|---|
| **Your email (as a salted hash for the allowlist; plaintext only if you're on the capx-app billing lane)** | To check you're whitelisted and, on the paid lane, to tie billing to access | Medium |
| **X access + refresh tokens** | To post on your instruction; stored **encrypted** (AES-256-GCM envelope, key in Google Cloud KMS / Secret Manager) | **Highest** |
| **X account metadata** (user id, username, verified flag, account age/standing) | Guardrail checks (authenticity, kill-switch, caps) | Medium |
| **Post content that passes through** (the text, and media bytes in transit) | To guard, schedule, and deliver it to X | Medium |
| **Audit records** (what was posted, when, and the guardrail verdict + reasons) | Trust/accountability — so you can see exactly what capx did on your behalf | Medium |
| **Operational logs & minimal telemetry** (timestamps, error states, rate counters) | Reliability, abuse prevention, debugging | Low |
| **Billing data (capx-app lane, future)** | Payment, handled by a merchant-of-record | Medium |

We do **not** collect your X password (OAuth never exposes it), your browsing history, your repository
contents, or data from other apps. capx does not read your mentions, DMs, timeline, or analytics — the
current scopes are `tweet.read`, `tweet.write`, `users.read`, `offline.access` (write-side only). Any future
read/analytics product is **separate** ("capx-scope") with its own consent and policy.

## 3. What we CAN and CANNOT see (the trust table)

| capx **can** see | capx **cannot** see |
|---|---|
| The text of posts you route through it | The content of media you attach (uploaded un-inspected) |
| Your X username and public account metadata | Your X password (OAuth flow never exposes it) |
| That a post passed/was held/was blocked, and why | What you do on your machine outside the tool |
| Your encrypted token exists in the vault | The **plaintext** token, except momentarily in memory at the instant of a post (never logged, never stored in the clear, never returned to your agent) |
| Rate/usage counters (for caps) | Your repo, files, other MCP servers, or other apps |

The plaintext access token exists only inside a single in-memory boundary (`vault.withToken()`) for the
microseconds it takes to call X, then is discarded. It is never logged and never leaves the server.

## 4. How your token is protected

- **Envelope encryption:** each token is encrypted with a data key; the data key is wrapped by a master key
  held in Google Cloud KMS. The database stores only ciphertext.
- **Secret isolation:** all secrets (KMS key, DB URL, signing keys, the capx X app secret) live in Google
  Secret Manager; the running service reads them via a least-privilege identity that can reach the database
  and those secrets and **nothing else**.
- **Single decryption path:** code is structured so the token is reachable **only** after the guardrail
  passes — a blocked post never decrypts it (verified by an adversarial test suite).

## 5. Where your data lives; sub-processors

- **Hosting & database:** Google Cloud (Cloud Run + Cloud SQL Postgres + KMS + Secret Manager), region
  asia-south1 (Mumbai).
- **X Corp.:** the destination of your posts.
- **Merchant of record (capx-app lane, future):** [CONFIRM: Lemon Squeezy / Polar — undecided] for payments.

We do **not** sell your data, and we do not use your post content to train any model.

## 6. Retention and deletion

- **Tokens:** kept while your account is connected; on disconnect or allowlist removal they are deleted
  within 30 days, after which capx can no longer post for you.
- **Audit records & logs:** kept for 12 months for security and accountability, then deleted or anonymized.
- **On request:** you can ask us to disconnect X and delete your stored data (see §8).

## 7. Legal bases (where applicable)

[CONFIRM: applicable regimes — likely India DPDP + GDPR for EU users.] Processing is based on: performance
of our agreement with you (posting on your instruction), our legitimate interest in security and
abuse-prevention, your consent for the X connection, and legal obligations where they apply.

## 8. Your rights

Depending on your jurisdiction you may access, correct, export, or delete your data, withdraw consent, or
object to processing. To exercise any of these, or to disconnect and be forgotten, contact privacy@capx.ai.
You can also disconnect X at any time from within the tool.

## 9. Security, breaches, children

- We apply the technical measures in §4 plus least-privilege access and encrypted secrets. No system is
  perfectly secure; use of alpha software is at your own risk.
- **Breach notice:** in the event of a personal-data breach we will notify affected users and any regulator
  without undue delay, as required by applicable law.
- capx is **not** intended for anyone under 18; we do not knowingly collect their data.

## 10. Changes

We may update this policy; material changes will be notified by email or in-product. The "effective date"
above marks the current version.

---

_Companion: `TERMS-OF-SERVICE.md`. The §3 trust table is load-bearing marketing **and** a promise — keep it
true to the code (`services/chokepoint/src/vault/`, `gate/`). If scopes or the media stance change, update
§2–§4 first._
