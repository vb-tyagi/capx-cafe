// @capx/chokepoint — HTTP shell + worker host (STUB, S0 scaffold).
//
// S3/S4 grow this into a stateless-per-request Fastify app mounting:
//   /connect/x/start   POST  — license gate FIRST, then mint PKCE material server-side (S4)
//   /oauth/callback    GET   — state-validate, token exchange, account-binding confirm, vault write (S4)
//   /whoami            POST  — connection metadata only, never a token (S4/S5)
//   /post              POST  — the publish gate: admission -> lane -> kill-list -> normalize ->
//                             per-handle lock -> runGauntlet -> x-adapter iff PASS (S3)
//   /admin/revoke      POST  — set global or per-handle kill (S2)
//   /webhooks/mor      POST  — MoR -> hashed-allowlist ingest (STUBBED in P1 per the ship-gate)
//   /health            GET
//
// A session-handle auth middleware runs before every handler (resolve handle -> allowlist + grace).
// Default HTTP port: 4477 (CHOKEPOINT_PORT). Confirm free before first bind.

export const CHOKEPOINT_DEFAULT_PORT = 4477 as const;

export function describe(): string {
  return 'capx chokepoint (scaffold) — see docs/P1-CHOKEPOINT.md §1';
}
