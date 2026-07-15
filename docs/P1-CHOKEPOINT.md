# P1 — the chokepoint: architecture & build spec

**Status:** Designed + adversarially reviewed (2026-07-15). Produced by a 15-agent map→design→verify pass
(8 package readers + prisma/config + wiring tracer → 3-angle architect panel → synthesis → skeptical
reviewer). The synthesis was strong; the reviewer returned **`holds:false`** with 2 blockers + 6 majors +
5 minors. **This doc is the design AFTER folding in every review fix.** It supersedes PLUGIN-ARCHITECTURE §7's
P1 sketch; it sits under the locked decisions in [STATE.md §5](STATE.md).

> **Gate:** this is the build spec, not permission to auto-post. The [LEGAL-BRIEF](LEGAL-BRIEF.md) ship-gate
> stands — nothing auto-posts beyond the founder's own accounts until counsel signs off. P1 seeds the
> allowlist manually (founder only); the MoR webhook is stubbed.

---

## 1. Architecture in one picture

Two deployables + one datastore + the repointed `@capx/*` libraries.

- **`apps/capx-mcp`** — the only process co-resident with the agent. Exposes `connect_x` / `whoami` /
  `post_now` over stdio. Holds **no X token and no secret** — only a short-TTL **session handle** and
  non-secret `~/.capx/config.json`. Design posture: *assume this process is fully compromised.* Its entire
  capability is "call the gated chokepoint with a revocable handle."
- **`services/chokepoint`** — ONE self-hostable image; the trust boundary and the only process that can
  decrypt an X token or reach X. Hosts: hosted-callback PKCE OAuth, the KMS-envelope-encrypted **token
  vault**, the **admission store** (hashed-email allowlist + short-TTL session + kill-list), the **x-adapter**
  (internal module — the *only* path from a decrypted token to `POST /2/tweets`), a durable **outbox**, and
  **the publish gate** (a server-side port of `canteen.runLoopTick` that calls `casserole.runGauntlet` before
  every send). Stateless-per-request: every request re-derives state from the datastore.
- **One Postgres** holds the entire P1 stateful surface: vault rows + hashed allowlist + kill-list +
  append-only audit + outbox + per-handle recent-post cache. **No Redis in P1** (the outbox uses a pluggable
  Queue whose default driver is a Postgres `SKIP LOCKED` poller; Redis/BullMQ is a P3 hosted-scale seam).
  **KMS is one interface, two drivers** (cloud KMS hosted / local-key or libsodium self-host) at zero code delta.

The **critical-flaw** answer (STATE §6): the token exists only in the vault; the MCP server and everything
co-resident with the agent hold no credential, so they *physically cannot* `POST` to X — they can only ask
the chokepoint, which gates every send through `runGauntlet`.

## 2. Reuse map (from the ground-truth package read)

| Package | Verdict | P1 role |
|---|---|---|
| `casserole` | **keep-repoint** | IS the guardrail gate. `runGauntlet` + all layers + `computeSlopScore`/`similarity`/`worst` reused **verbatim**, called server-side before every send with a live `killSwitch`. P1 manual posts run with `ctx.loop` undefined (L1 kill-switch, L2 rate, L3 anti-slop/dedup, L4 style, L5 optional health, L6 audit). |
| `canteen` | **transform** | `runLoopTick` becomes the server-side publish gate — it already encodes "runGauntlet → proceed only on PASS && !requiresHumanReview → nothing blocked/held reaches the platform," and its tests assert that invariant. Transforms: host server-side; inject killSwitch at **fire time**; repoint `PlatformClient` to the vault-backed x-adapter; make the ledger **lane-aware** (`ledger|null`); add `scheduled`/`publish_failed` outcomes + idempotency. `runLoopFromBrief` (chef path) deferred. |
| `captain` | **transform** | The admission layer. `resolveKillSwitch`'s `{global,handle}` output kept **verbatim** (it is casserole's exact killSwitch shape); `gateRequest`'s deny-order skeleton kept. Replace in-memory `Set<string>` registry (workspaceId-keyed) with a persistent Postgres kill-list keyed on email-hash/xUserId; replace the invite/`VerificationStatus` machine with hashed-email allowlist + short-TTL session + grace; strip workspace/Membership/RLS/tenantScope. `roles.ts` kept **dormant** (single-actor P1). |
| `counter` | **demote** | Billing integrity only, never a security boundary. Lane A never touches it. Lane B deferred to P4; P1 wires only the lane gate (null-ledger short-circuit). *Correction from review:* making it lane-aware/idempotent/refund-capable is a **transform of `runLoopTick`'s signature + `counter.charge`**, not drop-in reuse — named as a P4 transform. |
| `platform-client` | **keep-repoint** | The client transport (MCP→chokepoint) **and** the template for the server-side x-adapter. Already credential-free by design (`channelId` is "never an OAuth token"). Repoint baseUrl → `CAPX_CHOKEPOINT_URL`; keep the fake\|http factory + `FakePlatformClient`; grow the interface to `{connectX, whoami, postNow}`; swap static `serviceToken` for a rotating session-handle provider (401-refresh, 403-revoked); add idempotency key + timeout; enrich result to a discriminated `PublishOutcome` carrying verdict/reasons. Forward `authHeaderName/Value` (currently dropped). |
| `chef` | **demote** | Generation off the P1 hot path (`post_now` publishes agent-authored text; the host agent IS the LLM). One thin slice on the path: a `draftFromText` normalizer (real `hasLink` via URL regex, honest `aiGenerated`, `type=TEXT`, X weighted-length preflight). `ContentProvider`+mock parked for the P3 generation lane. Guarding stays OUT of chef, IN the gate. |
| `config` | **keep-repoint** | Keep `parseEnv`/coerce/aggregate **verbatim**. Split `appEnvSchema` into a **server** schema (vault DB, KMS, OAuth callback https-enforced, X client id/secret, session key, MoR secret, deploy mode) and a **thin client** schema (chokepoint URL + lane + BYO public client_id). Add layered resolver `env → ~/.capx/config.json → chokepoint session`; add `secret?` flag + redaction, `oneOf` enums, https-only URL. |
| `core` | **keep-repoint** | The type spine. `DraftPost` + `Verdict` reused verbatim. Repoint every consumer from `../../core/src/index.ts` to the `@capx/core` specifier. **Grow** (not rewrite): `Lane`, `SessionHandle`, `XConnectionRef`/`vaultRef`, serializable `KillSwitch`, outbox/job type; **make `GauntletContext.killSwitch` required** (see §6). Park non-P1 surface (LINKEDIN, GRAPHIC/ESSAY, Role, LoopConfig). |

## 3. Hosted-callback PKCE OAuth (both lanes)

Both lanes converge on the SAME callback / vault / admission gate / session model. They differ ONLY in
whose `client_id`/secret is used at token exchange, and whether counter meters (lane B, P4).

1. `connect_x { lane, x_client_id? }` → `capx-mcp` POSTs `/connect/x/start` with the **session handle** + lane
   (+ BYO public client_id). No token/secret/verifier ever leaves the laptop.
2. **License gate FIRST:** chokepoint validates session (email-hash ∈ allowlist AND live-or-in-grace) + global
   kill-switch. Not allowlisted / killed → error, **no OAuth started.**
3. Chokepoint mints `code_verifier` + S256 challenge + CSRF `state` **bound to a session-nonce the initiating
   MCP session holds** (see §6 fix), writes a short-TTL pending row. **The verifier never leaves the server.**
4. Returns the X authorize URL (`redirect_uri` = chokepoint HTTPS, same for both lanes; scopes
   `tweet.read tweet.write users.read offline.access`). Desktop auto-opens; **headless prints it.** User
   consents in ANY browser on ANY device.
5. X redirects to the chokepoint HTTPS callback. Callback validates `state` (reject CSRF mismatch/expiry),
   exchanges `code`+`verifier` (lane B adds the confidential secret, server-side only), calls `/2/users/me`.
6. **Account-binding confirm (review fix):** the vault row is written only after the initiating session
   confirms the specific `pending_id` it started; a relayed consent URL cannot land tokens under another
   identity. Tokens are envelope-encrypted (per-row DEK wrapped by KMS) and stored keyed by `(emailHash, xUserId)`.
7. `capx-mcp` learns connection **metadata only** (username), never the token. Refresh runs server-side.

## 4. The unbypassable boundary (how casserole actually enforces)

Unbypassable **by construction**, resting on four stacked facts:

1. **Token location** — X token only in the vault (KMS-wrapped). Nothing agent-side holds a credential, so
   nothing agent-side can POST to X. The worst a compromised/injected agent can do is call the **gated**
   `post_now` with the session handle.
2. **Single internal path** — the x-adapter is an **internal module, not an HTTP route**; its sole caller is
   the gate (`runLoopTick` ported server-side). No "raw publish" endpoint exists.
3. **Kill-switch required, fail-closed** — the ctx builder ALWAYS populates `ctx.killSwitch` from the live
   kill-list; the wrapper **throws** if it's unset, and `GauntletContext.killSwitch` is made a **required**
   type (§6) so omission is a compile error. An unreadable admission store → synthetic `{global:true}` BLOCK.
4. **Re-run at send** — `runGauntlet` is pure/re-runnable, so the gate runs it **again at fire time** with a
   freshly-read kill-switch; a switch flipped after admission still blocks (instant revocation).

**Honest scope of the guardrail:** it is a **quality/abuse** filter, not an **intent** filter. A
stylistically-clean attacker tweet (no slop, under limits, kill-switch off) WILL pass and post to the user's
real account — Option B accepts this; the mitigations are the kill-switch, per-handle rate/anti-slop, and the
short session TTL. "A prompt-injected post is just another gated draft" is true for *token safety* (it never
reaches the credential), not a claim that the gauntlet blocks all malicious-but-clean content.

## 5. MCP tool contracts

- **`connect_x`** `{ lane?, x_client_id? }` → `{ consent_url, pending_id, expires_at, instructions }` |
  `{ error, reason }`. License gate before any authorize URL; PKCE material server-side only; never returns a token.
- **`whoami`** `{}` → `{ connected, username?, lane?, standing?, killed?, session:{valid,in_grace,expires_at} }`.
  Metadata only. **Does NOT return `vaultRef`** (review fix — no server-owned handle crosses to the client;
  identity is always resolved session → emailHash → vault, server-side).
- **`post_now`** `{ text, ai_generated?, type?='TEXT' } + idempotency key` → discriminated
  `{ outcome: published|blocked|held|regenerate|rejected|insufficient_credits|publish_failed, verdict,
  requiresHumanReview, finalReasons[], scheduledAtMs? }`. No `channelId`, no token — identity server-resolved;
  `hasLink` derived server-side. **Server-side checks in order:** admission → lane → kill-list (fail-closed) →
  draft-normalize (weighted-length, hasLink, honest aiGenerated) → **per-handle advisory lock** →
  `runGauntlet` (killSwitch required) → publish via x-adapter ONLY on `PASS && !requiresHumanReview` →
  counter charge after confirmed send (lane B only, idempotency-keyed) → outbox dedup.

## 6. Hardening applied from the adversarial review

| # | Finding (sev) | Resolution folded into this spec |
|---|---|---|
| 1 | **Exactly-once posting impossible** — X `POST /2/tweets` has no idempotency key (blocker) | Drop the "exactly one X post" claim. Mark outbox row `sending` in-txn; on retry, **reconcile** against recent tweets/cache and skip on content+window match. Documented as **best-effort at the X boundary** with a narrow crash-window double-post risk (see §9). |
| 2 | **Build-order circularity** — S3/S6 verify needs S7's outbox (blocker) | Pull the **minimal outbox primitive** (a Postgres row with `sending/sent` + idempotency key + per-handle lock) **forward into S2**. S3 proves only what the in-process gate can prove; fire-time-re-run assertion stays in S7. |
| 3 | **OAuth account-binding / login-CSRF** (major) | §3 step 6: bind `xUserId` to the initiating session via a session-nonce only that MCP session holds; require it to confirm the specific `pending_id`; a relayed consent URL can't write another identity's vault row. |
| 4 | **Refresh-rotation "cannot brick" is false** — X one-time refresh token (major) | Replace with **crash-consistent + auto-reauth**: persist `rotation-in-progress` marker before the X call, commit the new refresh token atomically; on restart with a dangling marker, try the new token, else mark connection `needs-reauth` and surface via `whoami`. Never claim atomicity across the X call. |
| 5 | **Recent-post cache race** — concurrent `post_now` both read empty history, both pass spacing (major) | **Per-handle advisory lock** (`pg_advisory_xact_lock` / `SELECT … FOR UPDATE` on the vault row) around read-history → runGauntlet → send → write-cache. Concurrency test added to S3. |
| 6 | **L2 5-min spacing blocks legit manual posts** (major) | **✅ DECIDED (2026-07-15): manual `post_now` is EXEMPT** from the L2 5-min loop-spacing rule (it is a loop/autonomy rule). Manual posts still get kill-switch + anti-slop + a manual daily ceiling + weighted-length. Implemented in the gate's ctx builder (a manual-mode flag relaxes L2 spacing/loop-cap); covered by an S3 test. |
| 7 | **"One-flag" self-host hides a public-HTTPS-callback requirement** (major) | §8 states it honestly: self-host needs a public HTTPS callback (domain+TLS or tunnel) registered in the self-hoster's own X app, plus KMS/vault-DB/session-key/seeded-allowlist. "One code path, one mode flag" stays; "compose up + one URL = done" retired. |
| 8 | **`killSwitch` stays type-optional** (major) | Make `GauntletContext.killSwitch` a **required** field in `@capx/core` (S1), so omission is a compile error; keep the runtime throw as defense-in-depth; lint-forbid direct `runGauntlet` outside the gate module. |
| 9 | counter not drop-in reuse (minor) | Reclassified as a P4 transform (ledger `|null` short-circuit + idempotency-key + atomic compare-and-deduct + refund kind). |
| 10 | `whoami` leaks `vaultRef` (minor) | Removed from the `whoami` contract (§5). No endpoint accepts a client-supplied identity selector. |
| 11 | "sole decryptor" wording inaccurate — refresh loop also decrypts (minor) | Reworded: x-adapter is the sole path from a decrypted token **to an X publish**; the refresh module is the only other decryptor and can only exchange, never post. Both decryptors live inside the vault's `withToken()`. |
| 12 | vault row edging toward a user record (minor) | Hard rule: vault row = `{emailHash, xUserId, ciphertext, dekWrapped, lane, refreshRotatedAt}` only; `standing` is a TTL'd cache, not authoritative; **no PII / no profile / no engagement fields ever** in vault/allowlist. |
| 13 | length preflight mis-counts t.co URL wrapping (minor) | Implement X's **weighted-length** (URLs→23, CJK/emoji weighting); near-boundary → reject-with-reason, not a hard BLOCK. Premium long tweets out of P1 scope (§10). |

## 7. Build order (S0 → S7, circularity fixed)

Each slice keeps `pnpm verify` green and adds `node --test` coverage.

- **S0 — Package repoint & extraction seam.** `@capx/core` specifier everywhere (no `../../core/src`); real
  `@capx/*` deps + build/test scripts; config split server/client; scaffold `apps/capx-mcp` +
  `services/chokepoint` + one Dockerfile + compose (worker + Postgres). *No behavior change.* **Verify:** verify
  stays green; fresh-dir import resolves without `../../`; worker image builds.
- **S1 — Layered config + core Option-B types.** Resolver `env → ~/.capx/config.json → chokepoint session`;
  `secret?`+redaction, https-only, `oneOf`; core gains `Lane`/`SessionHandle`/`XConnectionRef`/`KillSwitch`/outbox
  types; **`killSwitch` made required.** **Verify:** env precedence, absent config tolerated, secret redacted,
  non-https callback rejected, client schema doesn't require vault/KMS.
- **S2 — Vault + admission + minimal outbox on one Postgres.** Migrations (vault, allowlist, kill-list, audit,
  outbox w/ `sending/sent`+idempotency+per-handle lock, recent-post cache); AES-256-GCM envelope behind KMS
  interface (local-key driver); session issue/validate + grace; kill-list emitting `{global,handle}`;
  `/admin/revoke`; MoR webhook signature-verified ingest (**stubbed for P1**). **Verify:** encrypt round-trip,
  ciphertext-only at rest, `getMetadata` never decrypts, allowlist+grace admits, past-grace denied, kill BLOCKs,
  unreadable store → fail-closed, advisory-lock serializes.
- **S3 — Publish gate with FAKE x-adapter (guardrail at the boundary).** Gate ports `runLoopTick`;
  draft-normalizer (weighted-length + URL-regex hasLink); killSwitch-required wrapper (throws); runGauntlet with
  cache-fed history/health; REGENERATE/HOLD→reject; lane-aware short-circuit; idempotency dedup; sends via
  `FakePlatformClient`. **Verify:** BLOCK / kill-on / over-length / HOLD → 0 adapter calls; clean PASS → exactly
  one; **two concurrent post_now within 5 min → one PASS + one spacing outcome** (concurrency); unset killSwitch
  throws; runGauntlet purity.
- **S4 — Hosted-callback PKCE OAuth + real x-adapter (BYO).** `/oauth/start` + `/oauth/callback` against a mock
  X IdP; account-binding confirm; x-adapter `vaultRef → decrypt → POST /2/tweets` + 401-refresh +
  crash-consistent rotation + `publish_failed`. **Verify:** authorize URL carries S256 + correct redirect_uri;
  callback writes ciphertext-only row; verifier never client-visible; state mismatch/expiry rejected; failed
  refresh → `needs-reauth` (not silent fail); token in NO log line.
- **S5 — MCP server + grown chokepoint client (3 tools).** `apps/capx-mcp` over stdio; session-handle provider,
  idempotency, timeout, 401-refresh, 403-revoked; headless prints consent URL; session handle in `~/.capx`
  (never a token). **Verify:** from a headless host — connect_x returns a URL, whoami has no token, post_now text
  publishes, oversized rejects with reasons, `grep ~/.capx + logs` for the X token → ABSENT, missing config on
  first run doesn't crash.
- **S6 — Lane B (capx-app) + counter seam + prompt-injection red-team.** Lane flag on the vault row; `/oauth/start`
  with capx client_id/secret server-side; `runLoopTick` lane-aware; counter charge idempotency-keyed but
  **feature-flagged OFF**; the "post BUY $SCAM" scenario end-to-end. **Verify:** lane A → 0 ledger ops; lane B →
  quote+charge once after confirmed send (0 on BLOCK, 0 on retry); both lanes hit the identical gate; injected
  scam is BLOCK/held and never reaches the adapter; no route reaches the x-adapter without the gate; mid-session
  kill blocks the next send.
- **S7 — Durable outbox + self-host single-flag proof.** Postgres `SKIP LOCKED` poller behind the Queue
  interface; `scheduled`/`publish_failed` added additively; runGauntlet re-run at fire time; compose (worker +
  Postgres), `CAPX_DEPLOY_MODE=self-host` disables lane B, README. **Verify:** retried job → reconciled
  at-most-one + one charge; X 5xx → `publish_failed` (not a throw); kill flipped between enqueue and fire →
  blocked at fire; clean-machine self-host yields an identical guardrail-enforced post with zero hosted
  dependency; self-host vs hosted diff = env only, never a code fork.

## 8. Self-host story (honest)

ONE open-source worker image is the whole product surface; hosted-capx and any self-hoster run the **identical**
image — the only difference is configuration (`CAPX_DEPLOY_MODE=hosted|self-host`, `CAPX_CHOKEPOINT_URL`). One
Postgres, no Redis, KMS behind an interface with a local-key driver. **But** hosted-callback-only OAuth means a
self-hoster must run a **publicly reachable HTTPS callback** (domain + TLS, or a tunnel) and register it in
**their own** X app, plus provide `KMS_KEY_ID`, `VAULT_DB_URL`, `SESSION_SIGNING_KEY`, and a seeded allowlist.
Minimal self-host = BYO-only (no capx secret, no MoR, no counter — lane A users pay X directly). Accurate claim:
*"one code path, one mode flag — but N required secrets and a public HTTPS domain."*

## 9. Known limitations / accepted risks (state, don't hide)

- **Double-post crash window:** X has no idempotency key, so a crash after X returns 200 but before the outbox
  commits can double-post on retry; mitigated by pre-send reconciliation, not eliminated.
- **Refresh brick window → auto-reauth:** X's one-time refresh token means a crash mid-rotation can't be made
  atomic across the X call; handled by `needs-reauth` surfaced via `whoami`, not by a false "cannot brick" claim.
- **Session-handle grace replay:** the grace window widens the replay window for a stolen handle — still
  fully guardrail- and kill-switch-bounded, still zero token exposure. TTL/grace are tunable (§10).
- **Guardrail is quality/abuse, not intent** (§4): clean malicious content can pass; kill-switch + short TTL
  are the backstops.
- **Vault is the crown jewel:** it inverts the old "closed DB never holds the token" invariant. Hosted needs
  least-privilege KMS + audit; a self-hoster with a weak local key lowers the bar for their OWN tokens only.

## 10. Open decisions (proposed defaults; ★ = wants a founder call)

1. **✅ DECIDED (2026-07-15) — Manual-post spacing:** the L2 5-min minimum spacing does **NOT** apply to manual
   `post_now`. Manual posts are exempt from loop-spacing; they keep kill-switch + anti-slop + a manual daily
   ceiling + weighted-length. (Gate passes a manual-mode flag that relaxes L2 spacing/loop-cap.)
2. **X length semantics:** *Proposed:* P1 = standard 280 with X **weighted-length** (t.co URLs = 23); premium
   long tweets **out of P1 scope.**
3. **Recent-post history source:** *Proposed:* P1 = chokepoint's own recent-post cache only (posts made through
   the chokepoint); fetching recent tweets from X is a P3 option (costs a READ + rate budget).
4. **Session TTL + grace:** *Proposed defaults:* session TTL 15 min, grace 12 h, per-host binding deferred to
   post-P1. Tunable config.
5. **Allowlist for P1:** seed manually (founder accounts only), MoR webhook **stubbed** — forced by the
   [LEGAL-BRIEF](LEGAL-BRIEF.md) ship-gate. Lane B billing **fully OFF** for all of P1.
6. **Prisma tree:** P1 **must NOT** migrate or seed `prisma/schema.prisma` / `rls.sql` / `seed.sql` — only the
   handle-keyed vault/allowlist migrations are created. (Accidental reuse would resurrect the user DB Option B forbids.)
7. **No-PII hard rule:** no PII / profile / engagement fields ever added to vault or allowlist tables.

---

## 11. Build log

- **2026-07-15 — S0 STARTED (partial).** ✅ Scaffolded `services/chokepoint/` (package.json, tsconfig,
  src/index.ts + src/server.ts stubs, Dockerfile, docker-compose = worker + Postgres, README) and
  `apps/capx-mcp/` (package.json, tsconfig, src/index.ts stub, README). Confirmed `pnpm verify` stayed
  green (64 tests) — the new `services/`+`apps/` dirs sit outside the root verify globs, so they're inert.
  Ports chosen: chokepoint HTTP **4477**, self-host Postgres host **5442** (confirm free before first bind).
  - ⏳ **PENDING (blocked on a sustained Bash safety-classifier outage — can't run `pnpm install`/`node --test`/`tsc`/`git`):**
    the verify-gated S0 core — (a) add `@capx/*: workspace:*` deps to each consumer package.json
    (canteen: core+casserole+counter+platform-client+chef; captain/casserole/chef/counter: core;
    platform-client/config/core: none), (b) repoint all **53** cross-package imports (`../../<pkg>/src/index.ts`
    → `@capx/<pkg>`) across **24** files, (c) split `@capx/config` into server vs client schemas, then
    `pnpm install` + `pnpm verify`.
  - **RESUME STEPS when Bash is back:** (1) `rm packages/casserole/test/_resolve_probe.test.ts` (parked
    neutralized probe); (2) do the repoint above; (3) `pnpm install` then `pnpm verify`. **Resolution risk to
    confirm first:** whether `node --experimental-strip-types` resolves the pnpm-symlinked `@capx/core`
    specifier — expected to work because pnpm symlinks resolve to a realpath OUTSIDE `node_modules` (dodging
    `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`); if Node throws it, `git checkout` the repoint and fall
    back to tsconfig `paths` for typecheck while keeping relative runtime imports. (4) Commit S0, then S1.
