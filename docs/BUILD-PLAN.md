# capx-culture — Final Mega-Sprint Build Plan (v2, review-hardened)

> **Status update (2026-07-10):** ⚖️→✅ **AGPL open-core boundary legally validated** (lawyer sign-off). The two-repo, network-only, arm's-length boundary is approved. This flips the P9 "AGPL sign-off" gate to **done** and makes the P0 **CI boundary-guard** the priority — it is now the mechanism that keeps you inside what counsel blessed. Remaining AGPL obligations are mechanical: publish the fork's corresponding source, add a NOTICE file, preserve Postiz attribution.

## Intro

capx-culture Phase 1 is a compliance-first, invite-only tool for creators and teams to launch and manage Twitter/X + LinkedIn presences, whose headline product is **LOOPS** — AI recurring-posting protected by a **six-layer anti-slop gauntlet**. The moat is simple to say and hard to copy: *"we keep your account alive and your content non-embarrassing."*

This plan is sequenced **offline-first**: every piece of secret-sauce logic is built and exhaustively unit-tested as a pure package before any IO, and every external vendor drops into a pre-built adapter seam. External keys (X, LinkedIn, Stripe, KMS, LLMs, cloud) are honestly quarantined into P8–P9 so nothing that needs a human, a lawyer, or a credential can silently block earlier work.

This v2 folds in the adversarial review. Three **critical** corrections change the architecture and are called out inline with a `⚠ REVIEW-FIX` tag:

1. **The AGPL boundary guard is mirrored inside the fork repo** — the closed repo physically cannot see leaks *into* the fork, so enforcement now runs on both sides of the wire.
2. **The fork is the single custodian of platform OAuth user tokens** — the earlier design had a closed token-vault *and* fork-as-refresher, which straddled live user tokens across the exact open/closed boundary the architecture exists to protect. The closed vault is re-scoped to closed-side secrets only.
3. **No content bypasses the gauntlet** — the fork is network-isolated with a mandatory fail-closed pre-publish webhook, and all AI-generated content is routed through L3/L4 regardless of manual-vs-loop path.

Nine further high/medium fixes (pricing-peg gating, GDPR-vs-immutable-audit split, credit/publish saga, refresh single-flight, forward-shifted security logging, per-tenant fairness, ledger reversals, WAF/edge, PITR/DR, real-account-id uniqueness, offline factuality) are designed into the phase where the schema or seam is first created, not retrofitted late.

---

## Phase Table

| Phase | Goal (one line) | Shippable Artifact | External Gates |
|---|---|---|---|
| **P0** | Two-repo split, closed monorepo skeleton, **dual-side** AGPL boundary guard, data spine + fail-closed RLS, CI/IaC plane | Green-CI closed monorepo with boundary invariant + tenant-isolated Postgres, runnable on docker-compose | None |
| **P1** | The dependency-free moat: pure gauntlet, credit math, AI abstraction, OAuth PKCE, KMS crypto, timing math, **split-integrity audit chain** | Versioned `@capx/*` package set proving anti-slop + pricing + scheduling IP works fully offline | None |
| **P2** | Invite-only identity/authz authority, Medium gate, 3-handle cap, kill switches, BFF shell — **with security-logging + edge throttling from day one** | Invite-only, tenant-isolated identity service + BFF onboarding shell on local infra | None |
| **P3** | Stateful credit ledger: holds, dedup metering, packs/grants, **reversals/clawback designed in** | Keyless credit ledger with crash-safe authorize-capture + reversal semantics | None |
| **P4** | Six-layer guardrail service wrapping the pure gauntlet, **L1 defined as API-observable proxies**, offline factuality advisory | Standalone service scoring any candidate post through all six layers | None |
| **P5** | LOOPS engine + publishing chokepoint against fakes, **all-AI-through-L3/L4**, **credit/publish saga**, per-tenant fairness | Full LOOPS + management pipeline demonstrable offline with all guardrails live | None |
| **P6** | Trust plane: **closed-side secrets vault only**, split-integrity L6 + signed evidence pack, GDPR DSR, watchdog, degradation | Complete trust/compliance/observability plane on local providers | None |
| **P7** | Postiz fork stood up locally, **mirror boundary guard in fork**, **fork owns token custody**, fake→live-fork adapter swaps, **fork network-isolated** | End-to-end integration with the open platform on local infra, no external accounts | None (local only) |
| **P8** | Live enablement: X + LinkedIn OAuth, real KMS/Stripe/AI/telemetry, **refresh single-flight**, ToS confirmation | Live key-backed vertical slice: one real handle, one real Loop, one real gauntlet-passed post | X app + metered credits; LinkedIn app/approval; Cloud KMS; Stripe; LLM+image keys+cost data; OTLP backend |
| **P9** | Prod cloud + PITR/DR, warm-up, **pre-launch security review**, legal gates, **pricing-peg gate**, first-5 launch | Whitelisted launch of Phase 1 behind the six-layer gauntlet | AWS infra; AGPL sign-off; GDPR sign-off; **+ real-cost-feed peg, Stripe, AI keys (now explicit)** |

---

## P0 — Foundation, AGPL Boundary & Data Spine

> ✅ **Foundation DONE & verified (2026-07-10):** monorepo skeleton · `@capx/core` + `@capx/config` + `@capx/platform-client` · CI-enforced **AGPL boundary-guard** (self-tested) · Prisma schema **CLI-validated** + `rls.sql` + local `docker-compose` (Postgres 5433 / Redis 6380) · dev port **4343** · `verify` gate = boundary-guard + **39 unit tests** + guard tests + **typecheck**, all green. Deferred to the service phases (P3–P5) where they naturally live: the NestJS service skeletons, the BullMQ pipeline run, and the pre-publish HMAC webhook.

**Goal.** Stand up the two-repo split, the closed pnpm+Turborepo monorepo skeleton, a **dual-side** CI-enforced AGPL boundary guard, shared core/config packages, the multi-tenant Prisma schema with fail-closed row-level security, and the full test/CI/local-stack/IaC plane — all with zero external keys. Dev ports allocated in the **43xx block** and documented per project convention.

### Epics & Tasks

**Monorepo topology & open/closed boundary**
- `[now]` **mono-skeleton** — pnpm-workspace + `turbo.json` + `tsconfig.base` + root config; allocate & hard-code unique 43xx dev ports (check listeners first, document in README).
- `[now]` **boundary-guard (closed side)** — dependency-cruiser/eslint-boundaries forbidding `@capx/*` leaks into the fork boundary + license-checker rejecting AGPL deps in the closed graph. ⚠ REVIEW-FIX: this guard only sees the closed graph; the **mirror guard lands in P7 inside the fork repo** and both are required CI.
- `[now]` **platform-client-iface** — `@capx/platform-client` `PlatformClient` interface + `FakePlatformClient` (records calls, returns canned IDs).

**Shared core packages**
- `[now]` **core-schemas** — `@capx/core`: all shared Zod schemas, domain types, event contracts (single source of domain truth).
- `[now]` **config-env** — `@capx/config`: single Zod env schema parsed once at boot (fail-fast) + rejection tests.

**Multi-tenant data model & RLS**
- `[now]` **prisma-schema** — all entities/enums/composite-FKs/indexes/UUIDv7 PKs; closed brain is system-of-record, opaque refs to fork. ⚠ REVIEW-FIX (handle-uniqueness): schema carries a `realExternalAccountId` column, nullable pre-connect, with the global `UNIQUE(platform, realExternalAccountId)` enforced at real-connect time (see P7/P8), separate from the pre-connect fake-ref registry.
- `[now]` **rls-policies** — `prisma/rls/*.sql`: three roles (migrator/authenticated/admin), GRANTs, FORCE RLS, fail-closed policies, append-only ledger grants.
- `[now]` **tenant-context** — `withTenant()` transaction wrapper + `tenantGuard` Prisma extension + dual-client `PrismaService` (runtime/admin).
- `[now]` **db-repos** — tenant-safe repositories + Zod DTOs + seed catalogs (`TierConfig`/`CreditActionPrice`) + two-tenant fixtures.
- `[now]` **rls-test-suite** — cross-tenant SELECT = 0 rows, `WITH CHECK` blocks cross-tenant INSERT, ledger UPDATE/DELETE denied.

**Test / CI / local-stack / IaC plane**
- `[now]` **test-runners** — `node:test` for pure packages + shared Vitest config + `@capx/test-fixtures` deterministic factories.
- `[now]` **local-stack** — docker-compose (PG16+RLS, Redis7, LocalStack KMS/S3) + postiz-mock server + `@capx/postiz-contract`.
- `[now]` **ci-pipeline** — GitHub Actions: turbo affected-graph lint→typecheck→unit→integration→contract→build + gitleaks/osv security jobs.
- `[now]` **iac-authoring** — Terraform modules (network/rds/redis/kms/s3/iam/compute) + validate/tflint/checkov in CI (no apply). ⚠ REVIEW-FIX (WAF): network/compute modules include **edge WAF + rate-limit** primitives. ⚠ REVIEW-FIX (DR): rds module includes **PITR + automated backups + tested-restore** config and an audit-chain-head offsite-export hook.

**Definition of Done.** Monorepo compiles, all package tests green; local Postgres RLS-enforced with a cross-tenant-leak negative test passing; the closed boundary guard hard-fails on a simulated `@capx` leak at the closed boundary or an AGPL dep in the closed graph; Terraform passes validate/tflint/checkov (WAF + PITR modules present); 43xx ports allocated and documented.

**Shippable Artifact.** A green-CI closed monorepo skeleton with the open/closed boundary invariant enforced (closed side) and a tenant-isolated Postgres data spine, runnable end-to-end on docker-compose.

---

## P1 — The Dependency-Free Moat (pure packages)

**Goal.** Implement and exhaustively unit-test every piece of secret-sauce **pure** logic with zero keys: the anti-slop gauntlet core, credit money math, AI-content abstraction, OAuth PKCE, KMS envelope crypto, publisher timing math, observability/audit/authz libs — so the moat exists before any IO or vendor is wired.

### Epics & Tasks

**Anti-slop gauntlet core (L2/L3/L4 math)**
- `[now]` **gauntlet-contracts** — `@capx/gauntlet-contracts`: Zod `CandidatePost`/`GauntletContext`/`Verdict`/`Disposition`/`LayerResult`/`VariationDirective`/`GauntletConfig` + provider interfaces.
- `[now]` **gauntlet-core** — `@capx/gauntlet-core`: TextNormalizer, banned-pattern scanner, slop-score, SimHash/MinHash/Jaccard/Levenshtein dedup, variation/style-clone fingerprints, jitter/spacing solver, EWMA/z-score, verdict reducer. ⚠ REVIEW-FIX (factuality): the L3 factuality component is defined here as a **cheap offline "claim detector"** (numbers / named-entity / absolute-claim patterns) that routes to human review and **is advisory only — never a hard autonomous block**. Real fact-checking is deferred to P8 behind an LLM key and stays advisory.
- `[now]` **gauntlet-golden** — golden-fixture + invariant tests: never-post-raw degrade-to-hold, never lands on `:00`, deterministic seed reproducibility.

**Credit money core**
- `[now]` **credits-core** — `@capx/credits`: branded integer money (uUSD/mcr), `ceilDiv`/`applyMarkupBps`, versioned `RateCard` + `PriceCatalog`, `estimate()`, `tierEntitlements()`, `readDedupDecision()`.
- `[now]` **credits-proptests** — property tests: no-float-drift, ceilDiv correctness, monotonic pricing, peg/markup reproduce worked examples (plain post ~2cr, link-post 32cr, read 0.65cr, packs 2000/5500/12000cr).

**AI content abstraction**
- `[now]` **content-contracts** — `@capx/content` Zod contracts + `ContentProvider` port + `ProviderCapabilities` + `ModelCatalog` + `GenerationIntent` enum.
- `[now]` **content-prompt-style** — versioned `PromptContract v1` assembler + `OutputContract` parser + `StyleCalibrator` with hard *no-source-n-gram > K* guard (style calibration, never verbatim cloning) + `CostEstimator`.
- `[now]` **content-mocks** — `MockTextProvider` + `AdversarialFakeProvider` (emits slop/banned/over-length) + `MockImageProvider` (`requiresHumanReview`) + `SingleShotPipeline` `run()`/`regenerate()` + provenance envelope.

**OAuth PKCE, KMS envelope & connection state**
- `[now]` **oauth-pkce** — `@capx/oauth-pkce`: S256 verifier/challenge + state/nonce gen + constant-time verify (node:crypto only).
- `[now]` **kms-envelope** — `@capx/kms` + `@capx/token-crypto`: `EnvelopeCipher` (AES-256-GCM + AAD tenant-binding) behind `KmsProvider` iface + `LocalKms`/`MockKms` + DEK cache + rotation. ⚠ REVIEW-FIX (custody): this package is consumed by **both** the fork's AGPL-native provider (for platform user tokens, P7) and the closed vault (for closed-side secrets only, P6) — the *code* is shared-shape, the *keys and data* are not.
- `[now]` **connection-statemachine** — `ConnectionStateMachine` pure reducer (all states + full error taxonomy) + `@capx/connection-contracts`.

**Publisher timing math & cross-cutting libs**
- `[now]` **publisher-contracts** — `@capx/publisher-contracts`: `SchedulePostCommand`, `PublishPayload`, policy configs, `PublishErrorClass` taxonomy, `PostizPublishPort`.
- `[now]` **publisher-pure** — pure `node:test` functions: `JitterPolicy` (non-`:00`), spacing solver, daily-ceiling + warm-up curve math, `RetryBackoff`, `ErrorClassifier` (Luxon DST-safe).
- `[now]` **obs-package** — `@capx/observability`: Pino **deny-by-default redaction serializer**, OTel SDK, AsyncLocalStorage correlation context, MetricsRegistry (console exporter). ⚠ REVIEW-FIX: this package is **mounted starting in P2** (first service touching secrets), not deferred to P6.
- `[now]` **audit-chain** — `@capx/audit`: hash-chained append-only writer + `AuditChainVerifier` + tamper-detection tests. ⚠ REVIEW-FIX (GDPR-vs-immutability): audit chain is designed **split-integrity from the start** — the immutable chain stores only a **salted hash/commitment** of PII-bearing fields (the <500-word brief, up-to-3 "sound like" source profiles, approver identity), while plaintext lives in **per-subject-key-encrypted shreddable side storage**. Crypto-shredding a subject's DEK erases plaintext while the chain and any evidence pack still verify structurally.

**Cross-cutting authz**
- `[now]` **authz-engine** — `packages/authz`: Role/Action enums, permission matrix, `can()` with workspace+handle most-specific-grant resolution (node:test, zero infra).

**Definition of Done.** Every pure `@capx/*` package builds and passes node:test/Vitest with golden fixtures and property tests; the *never-post-raw* and *never-fire-on-`:00`* invariants are encoded as passing tests; credit worked-examples reproduce exactly; the audit chain's split-integrity design passes a "shred plaintext → chain still verifies" test; no package imports a framework, network, or external key.

**Shippable Artifact.** A versioned internal `@capx/*` package set proving the anti-slop, credit-pricing, style-calibration, scheduling, and split-integrity-audit IP works fully offline.

---

## P2 — Identity, Whitelist Gate & Tenancy

> 🟡 **Engine shipped (2026-07-10):** `@capx/conductor` is the pure authorization core — role/permission engine, invite + Medium-gate whitelist, the 3-handle cap, scoped kill switches (feeding capx-casserole L1), and the request `gate` returning a tenant scope for RLS. 12 tests green + typecheck clean. Remaining P2 (needs infra/keys): the NestJS service + Next.js BFF auth shell, passwordless sessions, and the security-logging + edge-throttling controls.

**Goal.** Ship the closed authorization authority: passwordless sessions, operator invites + Medium verification gate, workspaces/roles, the 3-handle-per-identity cap, scoped kill switches, abuse signals, and the Next.js BFF auth shell — the invite-only front door and single source of authorization truth. ⚠ REVIEW-FIX: security-logging controls and edge throttling are **live from this phase**, since sessions/capability-JWTs are handled here.

### Epics & Tasks

**Security-logging & edge hardening (moved forward)**
- `[now]` **obs-mount-p2** — mount `@capx/observability` (Pino redaction serializer + correlation context) in the identity service; enable the **no-secret-logging ESLint rule**; run **secret-leak tests in CI from P2 onward**. ⚠ REVIEW-FIX #10.
- `[now]` **bff-edge-throttle** — per-route rate-limiting + lockout/backoff on invite-redeem, magic-link request, and auth endpoints; wire to the IaC WAF from P0. ⚠ REVIEW-FIX #16.

**Passwordless sessions & capabilities**
- `[now]` **auth-sessions** — `SessionService`: opaque Redis+PG sessions, rotation, idle/absolute TTL, revoke, device list, `killswitchEpoch`; magic-link (dev mailer) + WebAuthn passkeys.
- `[now]` **capability-mint** — `AuthorizationModule` guards (Session/Tenant/KillSwitch) + `@RequirePermission` + short-lived ES256 capability-JWT minter (local dev signing key). ⚠ REVIEW-FIX (custody): capability signing keys are exactly the kind of **closed-side secret** the P6 closed vault owns — never platform user tokens.

**Invite + Medium verification gate**
- `[now]` **invite-module** — operator-issued, email-bound, single-use hashed invites; redeem bootstraps User in `PENDING_VERIFICATION`.
- `[now]` **verification-gate** — Medium gate: attestation + social-proof link + operator manual-review queue behind `IdentityVerificationProvider` port (manual adapter default).

**Workspaces, roles & handle cap**
- `[now]` **workspace-membership** — Workspace/Membership/HandleGrant CRUD + tier + role assignment + separation-of-duties (creator cannot approve own post).
- `[now]` **handle-cap** — handle registry + 3-handle-per-verified-identity cap + `UNIQUE(platform, externalAccountId)`, race-safe (fake oauthRef). ⚠ REVIEW-FIX #18: the cap and uniqueness are keyed off `realExternalAccountId` **captured at OAuth connect (P7/P8)**; here they run on fake refs, and a re-validation/merge at first real connect plus a "duplicate real-account claim across identities is rejected at connect" test is stubbed now and enforced in P7.

**Kill switch, abuse signals & audit**
- `[now]` **killswitch-svc** — scoped kill switches (GLOBAL/WORKSPACE/HANDLE/USER) Redis fast-path + PG source-of-truth + signed internal trip/lift endpoints.
- `[now]` **abuse-signals** — identity abuse detectors (login velocity, impossible travel, device/proof sybil, cap-circumvention) emitting `abuse.signal.v1` on BullMQ + stub L5 consumer.
- `[now]` **identity-audit** — append-only auth/authz audit log (identity slice of L6) with GDPR field-level erasure hooks, using the split-integrity chain from P1.

**BFF front door**
- `[now]` **bff-auth** — Next.js App Router BFF: session cookie lifecycle, CSRF double-submit, route protection, whitelist onboarding UI.

**Definition of Done.** A whitelisted invitee redeems an invite, passes the Medium gate via operator review, creates a workspace, registers up to 3 (fake-oauthRef) handles and is blocked at the cap; kill switch instantly revokes in-flight sessions; RLS + `can()` both enforce isolation; **secret-leak tests + no-secret-logging lint are green and edge throttling/lockout is exercised**; full Vitest integration suite green on testcontainers PG+Redis.

**Shippable Artifact.** A working invite-only, tenant-isolated identity/authorization service plus a BFF login/onboarding shell, running on local infra with a dev mailer, local signing key, security-logging, and edge throttling (no external keys).

---

## P3 — Credit Ledger & Cost Metering Service

**Goal.** Ship the stateful closed billing service wrapping `@capx/credits`: append-only ledger, authorize/capture/void holds, dedup-aware read metering, pack purchases + free starter grants, and reconciliation workers, against stubbed payment/cost ports — so the platform can front fees and recover cost+markup invisibly. ⚠ REVIEW-FIX: **reversals/clawback and possibly-negative-balance are designed into the ledger now**, not bolted on in P8.

### Epics & Tasks

**Ledger & holds**
- `[now]` **billing-ledger** — `LedgerModule`: append-only `LedgerEntry` + materialized `Wallet`, atomic conditional decrement (oversell-proof), GET wallet/ledger. ⚠ REVIEW-FIX #13: schema includes **negative-adjustment / clawback / reversal** entry types and a **possibly-negative-balance** wallet state, with reconciliation semantics for post-spend refunds and chargebacks — even though the live Stripe webhook binding lands in P8.
- `[now]` **billing-holds** — `HoldsModule`: authorize → capture → void with TTL, tier fail-close before fronting cost, unique idempotency. ⚠ REVIEW-FIX #8: capture is driven off a **confirmed-publish event** (saga in P5), not inline; void-on-failure and capture-on-confirm are both idempotent.
- `[now]` **billing-estimate** — `EstimateController`: stateless pre-flight over `credits.estimate()` returning credits/breakdown/allowed/requiredTier.

**Metering, purchases & workers**
- `[now]` **billing-metering** — `MeteringModule`: dedup-aware read metering (Redis 24h window + durable PG mirror) + global `PlatformCostEntry` margin ledger.
- `[now]` **billing-purchases** — `PurchaseModule` + Grants: pack purchase (base+tier bonus) + STARTER/promo grants behind stubbed `PaymentPort`. `[blocked: Stripe account + keys — needed only to swap PaymentPort stub for real capture/refund/chargeback in P8]` for the live rail; the stubbed path is `[now]`.
- `[now]` **billing-workers** — BullMQ `HoldReaper` + `LedgerReconciler` (drift/margin) + `DedupSweeper`.
- `[now]` **cost-guard** — runtime cost-guard that alerts/halts fronting when observed cost exceeds the pegged assumption by a configurable threshold. ⚠ REVIEW-FIX #4: built now against stubbed cost, armed against live cost in P8/P9.

**Definition of Done.** Full credit lifecycle (grant → estimate → hold → capture/void → meter → reconcile) runs on local PG+Redis with stubbed `PaymentPort`/`CostSourcePort`/`PlatformPort`; oversell is impossible under concurrency; `HoldReaper` releases orphans; `LedgerReconciler` quantifies rounding margin vs global `PlatformCostEntry`; **a post-spend refund/chargeback clawback into a negative wallet is exercised and reconciles**; all endpoints RLS-isolated and idempotent.

**Shippable Artifact.** A production-shaped, keyless credit ledger service exposing estimate/holds/meter/wallet/purchase/grant APIs with a crash-safe authorize-capture protocol and reversal/clawback semantics.

---

## P4 — Six-Layer Anti-Slop Guardrail Service

**Goal.** Ship `guardrail-svc` wrapping `@capx/gauntlet-core` with DB/Redis: the two-phase `runGauntlet` (L1 eligibility, L2 rate/jitter/ceiling, L3 quality/dedup, L4 authenticity, L5 kill/watch, L6 label+audit), a bounded regenerate loop, health-monitor auto-pause, and a hash-chained audit trail — the runtime enforcement of the moat.

### Epics & Tasks

**Gauntlet runtime (L1–L4)**
- `[now]` **guardrail-svc-core** — NestJS `GauntletService`: two-phase admit/evaluate/runGauntlet, verdict reduction, bounded regenerate loop, degrade-to-hold, per-run cost guard.
- `[now]` **guardrail-l1-l2** — `EligibilityService` (L1) + `RateService`/`JitterSpacing` (L2) with Redis counters + atomic account-ceiling reserve + warm-up curve. ⚠ REVIEW-FIX #7: L1 is defined as **API-observable proxies** — account age from profile creation date; "good standing" **inferred only from observed suspension/limit signals and 401/403/429 patterns via the fork**; any criterion not queryable through the official API is dropped or re-scoped (no scraping/anti-detect, per HARD CONSTRAINTS). `HandleStanding` carries a **staleness TTL with fail-closed behavior**, and **L1 is re-checked at fire-time against fresh, non-stale standing**.
- `[now]` **guardrail-l3-l4** — `QualityService` (banned/slop/**offline advisory factuality claim-detector**/AI-image bar) + `DedupService` (Tier-0 over `PostFingerprint`) + `AuthenticityService` (review-window/style-clone/variation directive). ⚠ REVIEW-FIX #11: factuality never hard-blocks autonomous posting; it routes to review.

**Watch & Kill (L5) + Label & Log (L6)**
- `[now]` **guardrail-l5** — `ControlService` inline O(1) kill/pause pre-flight + `HealthMonitorWorker` (EWMA/z-score auto-pause + cross-account SimHash clustering).
- `[now]` **guardrail-l6** — `AuditService` hash-chained `GauntletRun`/`LayerResult` (split-integrity) + AI-content label applier + `GauntletConfigService` (Zod, versioned, hot-reload).
- `[now]` **guardrail-invariant-tests** — end-to-end Vitest proving autonomous-fail always held/regenerated, ceiling/spacing/jitter enforcement, and audit-chain tamper detection.

**Definition of Done.** `runGauntlet` runs end-to-end on local PG+Redis; the invariant that an autonomous failing post is always held or regenerated (never posted raw) holds under test; kill switch and EWMA/z-score auto-pause work; Tier-0 dedup blocks substantially-similar content; the L6 audit chain verifies; **L1 uses only API-observable proxies with a fail-closed staleness TTL and fire-time recheck**; all thresholds are config-only hot-reloadable and version-stamped per run.

**Shippable Artifact.** A standalone guardrail service that scores and gates any candidate post through all six layers, exposing admit/evaluate/run + kill/pause controls, keyless.

---

## P5 — Loops Engine, Content Wiring & Publishing Chokepoint

**Goal.** Ship the headline recurring-posting pipeline end-to-end against fakes: Loop config + three-gate eligibility + scheduler, generate → gauntlet → credits → publish orchestration with training wheels and approval queue, and the **single publishing chokepoint** enforcing the account daily ceiling, jitter, spacing and shared X rate budget across manual + all loops.

⚠ REVIEW-FIX #3 (bypass): **all AI-generated content is routed through L3/L4 regardless of manual-vs-loop path.** Only pure human-typed text may skip quality layers, and even that still gets L2 + L6 label/audit. **Any user edit of a held/queued post re-enters the gauntlet.**

⚠ REVIEW-FIX #8 (saga): the credit-capture ↔ publish ↔ fork sequence is a **transactional-outbox saga**, not an inline hold/capture around an HTTP publish.

⚠ REVIEW-FIX #12 (fairness): the shared X budget carries **per-tenant/per-handle sub-buckets** under the global cap.

### Epics & Tasks

**Loops config & scheduling**
- `[now]` **loops-config** — `LoopConfigService` CRUD/lifecycle + Zod (brief <500w, ≤3 style profiles, days/time/type/model) + `EligibilityService` enforced at create/run/pre-publish. LOOPS gating: TEAM tier+, verified + ≥30 days old + good standing; per-loop at most once/day; Autonomous(default)/User-reviewed toggle; training-wheels forces first few posts through review.
- `[now]` **loops-scheduler** — `LoopSchedulerService` planner: tz→UTC occurrences, jitter (never `:00`), per-loop 1/day, min-spacing, atomic account-ceiling reservation, ahead-of-time BullMQ delayed jobs.

**Generation & gauntlet orchestration**
- `[now]` **loops-content-module** — `ContentModule` binding `@capx/content` (MockProvider) + `ModelRouter` (tier/type gating) + `StyleCalibration` + `VariationEngine`.
- `[now]` **loops-orchestrator** — `GauntletOrchestrator` state machine (SCHEDULED → … → PUBLISHED) + bounded regen + `GuardrailClient` port (`FakeGuardrailClient`) + hold-never-post-raw. ⚠ REVIEW-FIX: the orchestrator forces **every generated candidate — and every manual post carrying AI content — through L3/L4**; a `reEnterGauntletOnEdit` transition covers user edits of held/queued items.
- `[now]` **loops-autonomy-queue** — `TrainingWheelsService` (effective-mode + decrement/flip) + `ApprovalQueueService` (approve/edit/skip + auto-skip at fire+grace so reviewed items never auto-post).

**Publishing engine chokepoint (L2 enforcement)**
- `[now]` **publisher-svc** — `services/publisher` `SchedulePostService` single chokepoint + `PublishWorker` + `FireTimePipeline` on `FakePostizAdapter`. ⚠ REVIEW-FIX: the fire-time pipeline is `idempotency → kill → health → eligibility(fresh L1) → **L3/L4 for any AI content** → ceiling → spacing → rate → publish → audit` — closing the "manual/assisted path skips quality" hole.
- `[now]` **publisher-guards** — DailyCeiling/Spacing/RateLimit/KillSwitch fire-time guards + `ReconcilerService` + at-most-once idempotency + shared global X token bucket **with per-tenant/per-handle sub-buckets and fair-share scheduling + per-tenant cost accounting** (⚠ REVIEW-FIX #12).
- `[now]` **publisher-credit-saga** — ⚠ REVIEW-FIX #8: transactional-outbox saga — publish intent recorded atomically; fork publish keyed by an idempotency token the fork echoes back; **capture driven off the confirmed-publish event**, with a reconciler that captures-or-voids based on the fork's authoritative post state; both paths idempotent. L6 `PublishAudit` records jitter offset/seed, ceiling snapshot, rate consumed.

**End-to-end pipeline proof**
- `[now]` **pipeline-e2e** — Loop tick → generate → gauntlet → credit debit → publish(fake) integration proving ceiling/spacing/jitter/never-raw/at-most-once across manual + loops with time-travel; a **crash-between-fork-confirm-and-capture** scenario proves the saga captures-or-voids exactly once; a **noisy-tenant** scenario proves sub-buckets prevent starvation.

**Definition of Done.** A configured Loop generates content, passes the full gauntlet, debits credits, and publishes via `FakePlatformClient` on schedule; multi-loop concurrency provably cannot breach the account ceiling; reviewed items never auto-post; autonomous failures are held/regenerated; **AI content on the manual path is provably gated by L3/L4**; the saga survives a simulated crash between fork-confirm and capture with no double-charge and no free post; the reconciler re-arms jobs after a simulated Redis flush; **one noisy tenant cannot starve others**.

**Shippable Artifact.** The full LOOPS + management publishing pipeline demonstrable offline — the headline product working against fakes with all guardrails, the saga, and per-tenant fairness live.

---

## P6 — Trust Plane (Sentinel: closed-secrets vault, GDPR, L6, watch-kill, degradation)

**Goal.** Ship the cross-cutting closed trust plane: **closed-side-secrets vault only**, consolidated L6 audit + signed evidence pack, GDPR DSR/consent/RoPA/retention, the app-health watchdog + feature-flag degradation panel, and observability rolled out across every service — making the "platform reviews our app" fallback concrete.

⚠ REVIEW-FIX #2 (custody): the closed vault is **re-scoped to closed-side secrets ONLY** (capability signing keys, internal service creds). It **never holds X/LinkedIn user OAuth tokens** — those live in the fork (P7), encrypted by the fork's own KMS provider. This removes the two-systems-of-record contradiction and keeps live user tokens off the open/closed boundary.

### Epics & Tasks

**Closed-secrets vault & security controls**
- `[now]` **secrets-vault** — `SecretsVaultService`: envelope-encrypted **closed-side secrets** (LocalKms), in-memory-only decrypt to branded `SecretString`, rotation/re-wrap, never-log. ⚠ REVIEW-FIX: platform user tokens are explicitly out of scope; a test asserts no code path stores an X/LinkedIn user token in this vault.
- `[now]` **secrets-ci** — gitleaks/trufflehog CI + no-secret-logging ESLint rule (already active since P2) + Sentry `beforeSend` scrubber + token threat-model & data-map docs (documenting that user tokens reside in the fork).

**GDPR readiness & consolidated audit**
- `[now]` **gdpr-dsr** — `GdprComplianceModule`: `DsrService` export/erase via **per-subject-key crypto-shred + pseudonymize** (using the P1 split-integrity chain — plaintext side-storage shredded, commitments retained) + Consent/RoPA tables + `RetentionPolicy` TTL jobs + PII classification. ⚠ REVIEW-FIX #6: erasure removes plaintext (brief, "sound like" source profiles, approver identity) while the chain **and the evidence pack still verify structurally**.
- `[now]` **provenance-evidence** — `PostProvenance` capture + `EvidencePackGenerator` signed verifiable bundle (the artifact handed to a platform during review), built over the split-integrity chain so it survives subject erasure.

**App-review fallback & observability rollout**
- `[now]` **app-health-watchdog** — `AppHealthWatchdog` on 401/403/429 spikes + scope changes (driven by fixtures now). `[blocked: live X/LinkedIn error/rate-limit streams via the fork needed for real signals — fixtures until P8]` for real signals.
- `[now]` **feature-flags** — `FeatureFlagService` degradation panel: pause-all-autonomous / force-user-review / throttle-rate / disable-AI-image-loops, audited flips.
- `[now]` **obs-rollout** — mount `ObservabilityModule` + product metrics (gauntlet L1–L6, publish latency, queue depth, credit cost) across all services (dashboards/metric rollout; the redaction serializer itself has been live since P2).

**Definition of Done.** OAuth **user** tokens never touch the closed vault (asserted by test) and never appear in logs/traces/errors (leak tests pass); the audit chain verifies tamper-evidently; DSR export/erase works via crypto-shred **while preserving chain + evidence-pack verifiability**; global/per-account/per-loop kill + degradation flags operate; the evidence pack generates a signed provenance bundle per handle; security CI gates green; all services emit correlated metrics.

**Shippable Artifact.** A complete trust/compliance/observability plane over the platform on local providers: closed-secrets vault, split-integrity audit, GDPR readiness, and the app-review fallback made concrete (minus live external signals).

---

## P7 — Postiz Fork Integration (open platform, local)

**Goal.** Stand up the AGPL Postiz fork locally, apply the KMS envelope patch + AGPL NOTICE/attribution, add a stable public-API facade, **network-isolate the fork**, install the **mirror boundary guard inside the fork repo**, make the fork the **single token custodian**, and swap every Fake adapter for real HTTP/webhook against the running local fork — proving the arm's-length open/closed boundary end-to-end without any external OAuth keys.

### Epics & Tasks

**Fork setup, AGPL compliance & keyless boot**
- `[now]` **fork-setup** — clone + pin Postiz fork (`capx-platform`, separate AGPL repo), boot via its docker-compose, apply NOTICE/attribution + modification log (AGPL §13). ⚠ REVIEW-FIX #14: **audit Postiz's required env matrix and stub/neutralize every provider requirement** (dummy secrets, disabled provider modules, JWT secrets, upload/storage) so the fork boots and serves OAuth/publish endpoints **fully keyless**; bake this into the fork's committed local compose profile.
- `[now]` **fork-boundary-mirror** — ⚠ REVIEW-FIX #1: **required CI in the fork repo** that fails the build on any import of `@capx/*`, any dependency on a closed package, and any non-AGPL/proprietary license in the fork graph — **plus a source-provenance scan** so hand-copied closed logic (prompts, slop-score, dedup math) is caught. The AGPL invariant is now enforced on **both** sides of the wire.
- `[now]` **fork-kms-patch** — ⚠ REVIEW-FIX #2: AGPL-native `KmsEnvelopeEncryptionProvider` replacing env-key AES on the Integration token columns (no closed imports). **This provider is the sole owner of platform user-token encryption** — the fork is the single custodian and refresher.
- `[now]` **fork-api-facade** — thin stable public-API facade module on the fork (boundary-safe generic feature) + spike against the actual Postiz surface.
- `[now]` **fork-network-isolation** — ⚠ REVIEW-FIX #3: network-isolate the fork so **only `platform-gateway` may reach it**; disable fork-native scheduling/calendar publish paths and remove direct user access; make the **pre-publish webhook mandatory and fail-closed** — the fork cannot publish without a closed allow.

**Anti-corruption layer against live fork**
- `[now]` **platform-gateway** — `services/platform-gateway` + `PostizHttpClient` implementing `PlatformClient` against the local fork; server-side tenant→org scoping (sole consumer of the fork API).
- `[now]` **pre-publish-webhook** — generic pre-publish webhook receiver + HMAC verify (URL + allow/hold/deny); **all decision logic closed-side**; fail-closed if the closed service is unreachable.
- `[now]` **postiz-contract-live** — nightly consumer-driven contract test `@capx/postiz-client` vs live fork (pinned-version drift alarm).

**Adapter swaps (Fake → live fork) & token custody proof**
- `[now]` **publisher-http-swap** — swap `FakePostizAdapter` → `PostizHttpAdapter` in publisher (single class, no scheduling/guardrail changes).
- `[now]` **loops-openplatform-swap** — swap `FakeOpenPlatformClient` → real `OpenPlatformClient` in loops (publish/recent-posts/health).
- `[now]` **connection-flow-mock-oauth** — full connect/callback/refresh/disconnect against `MockOAuthProvider` (msw/nock) proving rotation + 401→`NEEDS_RECONNECT` + `ConnectionPolicy` gate. ⚠ REVIEW-FIX #18: the **real external account id is captured at connect** and the global `UNIQUE(platform, realExternalAccountId)` + 3-handle cap are enforced here, with a test that a **duplicate real-account claim across two identities is rejected at connect**. ⚠ REVIEW-FIX #9: a **per-handle single-flight refresh mutex (Redis lock)** is introduced now so only one refresh is ever in flight per handle (validated against the mock before live keys).

**Definition of Done.** The closed pipeline drives the real local Postiz fork over HTTP + HMAC webhook only; the **fork-side mirror boundary guard is green and blocks a simulated `@capx` import and a copied-slop-heuristic**; the fork is the **only** holder of platform user tokens (closed vault holds none); the **fork cannot publish without a closed allow** (fail-closed webhook proven); consumer-driven contract tests green against the pinned fork; publisher and loops run against the live fork with `MockOAuthProvider` (rotation + 401→NEEDS_RECONNECT + single-flight refresh proven); **duplicate real-account claim rejected**; two separate Postgres DBs cross-reference by opaque IDs only.

**Shippable Artifact.** End-to-end integration with the open platform on local infra: the two boxes talking only through the phone line, provable, with the AGPL invariant enforced on both sides and no external accounts.

---

## P8 — Live Platform Enablement (external keys)

**Goal.** Turn on the real world: register the single X + LinkedIn apps, wire live OAuth token exchange (**fork as sole custodian/refresher**), refresh-on-publish and `HandleStanding` sync, and bind real KMS, Stripe, AI providers and telemetry — every task gated on an external credential but each dropping into an already-built adapter seam with zero redesign.

### External Gates
- X developer app + metered API credits (single platform-held account)
- LinkedIn app + product/refresh-token approval for `w_member_social`
- Cloud KMS CMK + IAM (AWS us-east)
- Stripe account + keys
- LLM + image provider API keys + verified per-model cost data
- Telemetry backend OTLP endpoint

### Epics & Tasks

**X + LinkedIn OAuth**
- `[blocked: X developer app + metered API credits]` **x-oauth-app** — register single X dev app; wire live PKCE token exchange + **fork-as-sole-refresher** (rotating `offline.access`) + warm-up throttle live. ⚠ REVIEW-FIX #9: the fork's refresh path uses the **per-handle single-flight mutex** from P7 to survive concurrent publishes without NEEDS_RECONNECT storms. ⚠ REVIEW-FIX #9 (ToS): **before enabling, confirm X's developer agreement permits multi-tenant posting-as-a-service under one app at target scale**; define a **per-app user ceiling** and an **enterprise/second-app contingency** as a documented gate.
- `[blocked: LinkedIn app + product approval for w_member_social / refresh tokens]` **linkedin-oauth-app** — register LinkedIn app (Sign In + `w_member_social`); live token exchange + refresh where approved; same at-scale ToS review as X. ⚠ REVIEW-FIX #5: an explicit **launch-scope decision (X-only vs X+LinkedIn)** is recorded here and feeds P9.
- `[blocked: live X + LinkedIn API access]` **handle-standing-sync** — live `HandleStanding` sync feeding L1, using only the **API-observable proxies defined in P4** (creation-date age; standing inferred from suspension/limit/401/403/429 signals); staleness TTL fail-closed.

**Real KMS & payments**
- `[blocked: Cloud KMS CMK + IAM (AWS us-east)]` **real-kms** — swap `LocalKms` → `AwsKmsProvider`. ⚠ REVIEW-FIX #2: the CMK that **wraps platform user tokens is consumed by the fork's provider**; a **separate** CMK/IAM path serves the closed secrets-vault (capability signing / internal creds). The two key domains never cross.
- `[blocked: Stripe account + keys]` **real-stripe** — bind `PaymentPort` → Stripe (pack capture + refund/chargeback webhooks), driving the **reversal/clawback semantics already built in P3**.

**Real AI, cost feed & telemetry**
- `[blocked: LLM + image provider API keys + verified per-model cost data]` **real-ai-providers** — OpenAI/Anthropic text + text-to-image adapters behind `ContentProvider` + S3 `MediaSink` + open-platform `PostFetcher`; real per-model cost tables. (Optional advisory LLM factuality check may attach here, still non-blocking per P4.)
- `[blocked: X API usage/billing console access]` **real-cost-feed** — bind `CostSourcePort` to live X usage/cost + AI token cost; verify Console rates and **bump `RateCardVersion`**; arm the **cost-guard** from P3 against live cost. ⚠ REVIEW-FIX #4: this is a **hard gate for any real credit-pack sale or fronted-fee action** (enforced in P9).
- `[blocked: Telemetry backend OTLP endpoint + live X/LinkedIn error streams]` **real-telemetry** — point OTLP at a real backend + wire `AppHealthWatchdog`/`HealthSignalIngestor` to live platform error streams.

**Definition of Done.** A real handle connects via live OAuth (token KMS-encrypted **in the fork vault**); one real Loop post publishes through the full L1–L6 gauntlet + credit-saga hold/capture + L6 audit against a throwaway verified test handle; **the per-handle single-flight refresh survives a forced concurrent-publish without NEEDS_RECONNECT**; a real credit-pack purchase credits a wallet via Stripe; AI generation bills real per-model cost; `RateCardVersion` is bumped against live console rates and the cost-guard is armed; live health signals feed the watchdog and L5 auto-pause; the X (and, if in scope, LinkedIn) multi-tenant ToS confirmation is documented.

**Shippable Artifact.** A live, key-backed vertical slice: one real handle, one real Loop, one real published (gauntlet-passed, AI-labeled) post, metered against real credits with a validated cost peg.

---

## P9 — Cloud Infra, Warm-Up & Whitelist Launch Gates

**Goal.** Provision prod cloud (with **PITR/DR**), enforce the new-account warm-up throttle and drill the app-review fallback, pass a **pre-launch security review**, clear the blocking legal gates, **validate the pricing peg**, and open Phase 1 to the first 5 whitelisted users with a config-only tuning loop.

### External Gates
- AWS account + cloud infra (RDS/ElastiCache/KMS/S3/ECS) + apply credentials
- AGPL lawyer sign-off on the open/closed aggregate boundary
- GDPR/privacy counsel sign-off on retention basis + RoPA/DPAs/subprocessors
- ⚠ REVIEW-FIX #4/#5 (now explicit): **real-cost-feed peg + RateCardVersion bump**, **Stripe live rail (real-stripe)**, **AI providers (real-ai-providers)** — all hard gates for first-5

### Epics & Tasks

**Cloud infra apply**
- `[blocked: AWS account + cloud infra + apply credentials]` **iac-apply** — `terraform apply` to AWS us-east (RDS PG16, ElastiCache Redis7, KMS CMK, S3 SSE-KMS, ECS Fargate, secrets, least-priv IAM) + staging/prod parity. ⚠ REVIEW-FIX #17: **RDS PITR + automated backups + a tested restore + periodic offsite export/anchoring of the audit hash-chain head** are part of apply. ⚠ REVIEW-FIX #16: WAF + edge rate-limit deployed.
- `[blocked: AWS account + deploy credentials]` **deploy-pipeline** — gated `deploy.yml` promoting shared images across envs + post-deploy KMS/S3 parity smoke.

**Security, warm-up & app-review readiness**
- `[now]` **pre-launch-security-review** — ⚠ REVIEW-FIX #15: **blocking pre-launch security review gate** — threat-model validation, RLS/tenant-isolation pen-test, token-vault/KMS review (incl. the fork-owns-user-tokens boundary), capability-JWT forgery test, Stripe + fork webhook signature verification, BFF authz. Wire the repo's `/security-review` skill (and `vbt-complete-system-audit`) as the gate. (Buildable/runnable now against the assembled system; must pass before first-5.)
- `[now]` **app-review-fallback** — operational fallback: evidence-pack readiness + degradation-switch drill + "platform reviews our app" runbook.
- `[blocked: live handle standing/account-age via X dev app]` **warmup-activate** — activate new-account/new-loop warm-up throttle curve (age-banded ceilings) in production against real account age.

**Legal gates & pricing-peg gate**
- `[blocked: AGPL lawyer sign-off]` **agpl-signoff** — counsel review + sign-off on the open/closed AGPL aggregate boundary, now covering **both-side boundary guards** and the **fork-as-sole-token-custodian** custody model.
- `[blocked: GDPR/privacy counsel sign-off]` **gdpr-signoff** — counsel sign-off on provenance-retention legal basis + RoPA/DPAs/subprocessor list + retention TTLs, backed by the **split-integrity chain** that reconciles immutability with erasure.
- `[blocked: real-cost-feed peg validated + RateCardVersion bump]` **pricing-peg-gate** — ⚠ REVIEW-FIX #4: gate any real credit-pack sale / fronted-fee action on a **validated peg + armed cost-guard**; margin cannot silently go negative.

**Whitelist launch**
- `[blocked: iac-apply + x-oauth-app + real-stripe + real-ai-providers + real-cost-feed peg + agpl-signoff + gdpr-signoff + pre-launch-security-review + LinkedIn scope decision]` **first5-feedback** — ⚠ REVIEW-FIX #5: dependencies now **explicitly include real-stripe (packs can actually be bought), real-ai-providers (LOOPS can actually generate), real-cost-feed (peg validated), the security-review pass, and the recorded LinkedIn launch-scope decision** — not just X + the two legal sign-offs. Open to first 5 whitelisted users; tune gauntlet/ceiling/pricing thresholds config-only via a tight feedback loop.

**Definition of Done.** Prod (AWS us-east) is provisioned and green with staging parity **and tested PITR restore + audit-chain-head offsite anchoring**; the warm-up ceiling curve is enforced on new/young accounts and loops; the signed evidence pack + degradation drill are rehearsed; **the pre-launch security review has passed**; **the pricing peg is validated against live console rates with the cost-guard armed**; counsel has blessed both the AGPL boundary and the GDPR provenance-retention basis; **Stripe + AI providers are live**; the LinkedIn scope decision is recorded; the first 5 whitelisted users are live and thresholds are tuned config-only.

**Shippable Artifact.** Public (whitelisted) launch of capx-culture Phase 1: compliance-first, invite-only managed X + LinkedIn presences with LOOPS behind the six-layer anti-slop gauntlet — with a validated cost peg, a passed security review, and PITR/DR on the money+audit database.

---

## Critical Path

The longest chain of hard dependencies from nothing to launch:

```
mono-skeleton → core-schemas → prisma-schema → rls-policies → tenant-context
  → [P1 pure moat: gauntlet-core + credits-core + audit-chain(split-integrity)]
  → capability-mint (P2) → workspace-membership → handle-cap
  → billing-ledger(+reversals) → billing-holds
  → guardrail-svc-core → guardrail-l1-l2(API-observable L1) → guardrail-l3-l4
  → loops-config → loops-orchestrator(all-AI-through-L3/L4)
  → publisher-svc → publisher-guards(per-tenant fairness) → publisher-credit-saga
  → pipeline-e2e
  → fork-setup(keyless) → fork-boundary-mirror → fork-kms-patch(token custody)
      → fork-network-isolation → platform-gateway → pre-publish-webhook(fail-closed)
      → connection-flow-mock-oauth(single-flight + real-account-id)
  → x-oauth-app(ToS + single-flight) → real-cost-feed(peg) 
  → iac-apply(PITR/DR) → pre-launch-security-review
  → agpl-signoff ∥ gdpr-signoff ∥ pricing-peg-gate ∥ real-stripe ∥ real-ai-providers
  → first5-feedback
```

**Everything from `mono-skeleton` through `pipeline-e2e` (P0–P6, most of P7) is `[now]` — no external key blocks it.** The critical path only meets external gates at `x-oauth-app`. The three critical review-fixes sit directly on this path: the fork mirror-guard and token-custody swap (P7), and the all-AI-through-L3/L4 routing (P5). The pricing-peg, security-review, and hidden-key gates (`real-stripe`/`real-ai-providers`) now correctly precede `first5-feedback` rather than dangling.

---

## External Gates Checklist (human / keys / lawyer / infra)

| Gate | Type | Blocks | Notes |
|---|---|---|---|
| X developer app + metered API credits | Key/infra | `x-oauth-app`, `real-cost-feed`, `warmup-activate`, `handle-standing-sync` | Single platform-held account fronting fees |
| **X multi-tenant ToS confirmation + per-app user ceiling + 2nd-app contingency** | **Legal/policy** | `x-oauth-app` | ⚠ REVIEW-FIX #9 — confirm posting-as-a-service under one app is permitted at scale |
| LinkedIn app + `w_member_social` / refresh approval | Key/approval | `linkedin-oauth-app`, `handle-standing-sync` | Same at-scale ToS review as X |
| **LinkedIn launch-scope decision (X-only vs X+LinkedIn)** | **Product decision** | `first5-feedback` | ⚠ REVIEW-FIX #5 |
| Cloud KMS CMK + IAM (AWS us-east) | Infra/key | `real-kms`, `iac-apply` | **Separate CMK domains: fork(user tokens) vs closed(secrets)** |
| Stripe account + keys | Key | `real-stripe`, **`first5-feedback`** | ⚠ REVIEW-FIX #5 — packs cannot be sold without it |
| LLM + image provider keys + verified cost data | Key/data | `real-ai-providers`, **`first5-feedback`** | ⚠ REVIEW-FIX #5 — LOOPS cannot generate without it |
| **Real-cost-feed peg + RateCardVersion bump** | Data/key | `pricing-peg-gate`, **`first5-feedback`** | ⚠ REVIEW-FIX #4 — margin protection |
| Telemetry backend OTLP endpoint | Infra | `real-telemetry` | |
| AWS account + apply/deploy credentials | Infra | `iac-apply`, `deploy-pipeline` | Incl. **PITR/DR + WAF** (⚠ #16/#17) |
| **Pre-launch security review pass** | Human review | `first5-feedback` | ⚠ REVIEW-FIX #15 — pen-test, KMS/vault, capability-JWT forgery, webhook HMAC |
| AGPL lawyer sign-off | Lawyer | `agpl-signoff` → `first5-feedback` | Now covers dual-side guard + fork token custody |
| GDPR/privacy counsel sign-off | Lawyer | `gdpr-signoff` → `first5-feedback` | Backed by split-integrity chain |

---

## Ships in the First Session — the dependency-free moat

Everything below is **`[now]`**: it needs **no external keys, no vendor, no lawyer, no cloud** — only the P0 skeleton. This is the secret sauce, provable fully offline and unit-tested before a single credential exists.

**1. Core data model + fail-closed multi-tenant spine**
- `@capx/core` (all Zod schemas, domain types, event contracts) — single source of domain truth.
- `prisma/schema.prisma` + RLS policies (three roles, FORCE RLS, append-only ledger grants) + `withTenant()` + `tenantGuard`.
- RLS isolation suite: cross-tenant SELECT = 0 rows, `WITH CHECK` blocks cross-tenant INSERT, ledger UPDATE/DELETE denied.

**2. `@capx/guardrails` — the six-layer anti-slop engine (pure)**
- `gauntlet-core`: TextNormalizer, banned-pattern scanner, slop-score, SimHash/MinHash/Jaccard/Levenshtein dedup, style-clone fingerprints, jitter/spacing solver (never `:00`), EWMA/z-score health math, verdict reducer.
- Offline advisory factuality claim-detector (routes to review, never hard-blocks autonomous).
- Golden-fixture + invariant tests encoding the two load-bearing guarantees: **never-post-raw (degrade-to-hold)** and **never-fire-on-`:00`**, with deterministic seed reproducibility.

**3. `@capx/credits` — the money ledger math (pure)**
- Branded integer money (uUSD/mcr), `ceilDiv`/`applyMarkupBps`, versioned `RateCard` + `PriceCatalog`, `estimate()`, `tierEntitlements()`, dedup-read decision.
- Property tests: no-float-drift, monotonic pricing, and the worked examples reproduced exactly (plain post ~2cr, link-post 32cr, read 0.65cr, packs 2000/5500/12000cr).

**Plus the supporting pure libs that make the above real:** `@capx/oauth-pkce` (S256, constant-time verify), `@capx/kms`/`@capx/token-crypto` (AES-256-GCM envelope with tenant-bound AAD), `@capx/audit` (**split-integrity** hash-chain: commitments in the immutable chain, shreddable per-subject plaintext side-storage — reconciling immutability with GDPR erasure from day one), `@capx/observability` (deny-by-default redaction), and `packages/authz` (`can()` with most-specific-grant resolution).

**Why this is the moat:** it proves — offline, deterministically, in the first session — that the anti-slop gauntlet cannot post raw, the scheduler cannot fire on the hour, the pricing reproduces to the credit, tenants cannot see each other, and the audit trail can be both tamper-evident and erasable. Every later phase is IO and vendors dropped into seams around this core.

---

## In simple words

This document is the final, corrected battle plan for building capx-culture — a careful tool that helps people run their Twitter/X and LinkedIn accounts, with an AI feature (LOOPS) that posts for them without embarrassing them.

The plan is split into ten stages (P0 to P9). The clever part: almost everything valuable — the "don't post junk" checker, the credit/pricing math, the privacy-safe record-keeping — gets built and fully tested **before** anyone needs a single password, paid key, cloud account, or lawyer. Those outside things are pushed to the last two stages so they can never hold up the real work.

A tough reviewer found problems in the earlier draft, and this version fixes them. The three biggest: (1) the rule that keeps our secret code out of the public "open" part is now enforced on **both** sides, not just one; (2) users' login tokens for X/LinkedIn now live in **one** place instead of two contradictory ones; and (3) we closed loopholes where content could sneak out **without** passing the quality check. Other fixes make sure we don't charge real customers before we know our real costs, that deleting someone's data doesn't break our tamper-proof logs, that money and posting stay in sync even if a server crashes, and that we do a security review and set up database backups before launch.

The headline: in the very first work session, we can ship the whole "moat" — the anti-junk engine, the credit ledger, and the tenant-isolated data model — all unit-tested and running offline, with zero external accounts needed.