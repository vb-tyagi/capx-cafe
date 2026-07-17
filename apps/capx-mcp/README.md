# @capx-cafe/mcp

The agent-co-resident **MCP server** (stdio) for Claude Code / Codex / Cursor. Exposes `connect_x`,
`whoami`, `post_now`. Design: [`docs/P1-CHOKEPOINT.md`](../../docs/P1-CHOKEPOINT.md).

**Status:** S5 — wired. Tools run over the `@modelcontextprotocol/sdk` stdio transport; all tool logic
is `CapxMcp` (unit-tested end-to-end against the real chokepoint service).

## Security posture
Holds **no X token and no secret** — only a short-TTL **session handle** + non-secret `~/.capx/config.json`.
Assume-compromised: its only capability is to call the gated chokepoint. The X token never touches this
process or the machine it runs on. Every post passes casserole **at the chokepoint**; a blocked/held post is
never sent and the token is never even decrypted.

## Config (host-agnostic)
Resolved `env → ~/.capx/config.json → chokepoint session` (first-defined wins; absent file tolerated;
**no secret on disk**).

| Var | Required | Meaning |
|---|---|---|
| `CAPX_CHOKEPOINT_URL` | yes | points the server at any chokepoint (hosted or self-hosted) |
| `CAPX_EMAIL` | yes | your allowlisted email (hashed locally to the identity key; raw email never sent) |
| `CAPX_LANE` | no | `byo` (default) or `capx-app` |
| `X_CLIENT_ID` | BYO lane | your **own** X app Client ID (non-secret) |

## Tools
- **`connect_x`** `{ confirm?, lane?, clientId? }` — two-phase. First call returns a consent URL; authorize
  in any browser, then call again with `{ confirm: true }`. The token lands in the chokepoint vault, never here.
- **`whoami`** `{}` — the connected account + status (incl. `needs-reauth`).
- **`post_now`** `{ text, aiGenerated?, idempotencyKey? }` — posts via the guardrail; renders the verdict
  (`published` / `blocked` / `held` / …). A stable idempotency key makes a retried call at-most-once.

## Install into your agent

**Claude Code / Cursor** (`.mcp.json` / `~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "capx": {
      "command": "npx",
      "args": ["-y", "@capx-cafe/mcp"],
      "env": {
        "CAPX_CHOKEPOINT_URL": "https://your-chokepoint.example",
        "CAPX_EMAIL": "you@example.com",
        "X_CLIENT_ID": "your-x-app-client-id"
      }
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):
```toml
[mcp_servers.capx]
command = "npx"
args = ["-y", "@capx-cafe/mcp"]
env = { CAPX_CHOKEPOINT_URL = "https://your-chokepoint.example", CAPX_EMAIL = "you@example.com", X_CLIENT_ID = "your-x-app-client-id" }
```

**Local dev** (before the package is published) — point `command`/`args` at the source entry:
```json
{ "command": "node", "args": ["--experimental-strip-types", "/abs/path/to/apps/capx-mcp/src/server.ts"] }
```

Headless/SSH (no system browser): `connect_x` prints the consent URL for you to open anywhere — no loopback,
no keychain, no pinned port (hosted-callback OAuth). Same tool surface on every harness.
