// @capx/chokepoint — barrel.
//
// The chokepoint is the ONLY process that can decrypt an X token or reach X.
// It is stateless-per-request: every request re-derives state from one Postgres.
// Component layout (each folder lands in a specific P1 build slice — docs/P1-CHOKEPOINT.md §7):
//
//   src/server.ts    — HTTP shell + worker host (S3/S4)
//   src/config/      — server env schema (S1)
//   src/vault/       — KMS-envelope-encrypted X-token store (S2)
//   src/admission/   — hashed-email allowlist + short-TTL session + kill-list (S2)
//   src/oauth/       — hosted-callback PKCE handler, both lanes (S4)
//   src/xclient/     — INTERNAL vault-backed X v2 adapter; sole path to POST /2/tweets (S4)
//   src/gate/        — server-side port of canteen.runLoopTick; THE unbypassable boundary (S3)
//   src/outbox/      — durable at-least-once send + idempotency + per-handle lock (S2 primitive, S7 poller)
//
// Nothing here is wired yet — this is the S0 scaffold. Do not import external deps
// (fastify, pg, libsodium, kms) until the slice that introduces them.

export const CHOKEPOINT_SCAFFOLD = 'p1-s0' as const;
