# @capx/mcp

The agent-co-resident **MCP server** (stdio) for Claude Code / Codex / Cursor. Exposes `connect_x`,
`whoami`, `post_now`. Design: [`docs/P1-CHOKEPOINT.md`](../../docs/P1-CHOKEPOINT.md).

**Status:** S0 scaffold (structure only; MCP wiring lands in S5).

## Security posture
Holds **no X token and no secret** — only a short-TTL **session handle** + non-secret `~/.capx/config.json`.
Assume-compromised: its only capability is to call the gated chokepoint. The X token never touches this
process or the machine it runs on.

## Config resolution (host-agnostic)
`env → ~/.capx/config.json → chokepoint session` (first-defined wins; absent file tolerated on first run;
**no secret on disk**). One knob points at any chokepoint: `CAPX_CHOKEPOINT_URL`.

## Run (once wired — S5)
```sh
npx @capx/mcp    # stdio server; add to your agent's MCP config
```
