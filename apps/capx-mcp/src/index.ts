// @capx-cafe/mcp — the agent-co-resident MCP server (STUB, S0 scaffold).
//
// TRUST POSTURE: assume this process is fully compromised. It holds NO X token and NO secret —
// only a short-TTL session handle + non-secret ~/.capx/config.json. Its entire capability is
// "call the gated chokepoint with a revocable handle." Every tool is a thin authenticated call
// to services/chokepoint; it renders the returned verdict so the agent can explain
// blocked/held WITHOUT re-running or being able to skip the guard.
//
// Tools (grown via @capx-cafe/platform-client's ChokepointClient — S5):
//   connect_x { lane?, x_client_id? } -> { consent_url, pending_id, expires_at, instructions }
//   whoami    {}                      -> { connected, username?, lane?, standing?, killed?, session }
//   post_now  { text, ai_generated?, type? } + idempotency key -> discriminated PublishOutcome
//
// Capability detection: desktop auto-opens the consent URL; headless prints it.
// The MCP SDK + stdio transport wiring lands in S5 — not imported yet (S0 scaffold).

export const CAPX_MCP_SCAFFOLD = 'p1-s0' as const;

export const P1_TOOLS = ['connect_x', 'whoami', 'post_now'] as const;
export type P1Tool = (typeof P1_TOOLS)[number];
