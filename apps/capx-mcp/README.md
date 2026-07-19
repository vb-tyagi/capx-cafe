# capx café — `capx-cafe`

**The safe way to let your AI run your X.** An [MCP](https://modelcontextprotocol.io) server for **Claude
Code / Cursor / Codex / Windsurf**: connect your X (Twitter) account once, then create, schedule, and post
from inside your agent — with your **token never on your machine** and **every post cleared by a server-side
guardrail** before it ships.

> **Full docs, architecture & security model → https://github.com/vb-tyagi/capx-cafe**

## Why

To let an agent post, other tools have you paste your X token into a config **next to an autonomous agent
that reads untrusted web pages, issues, and code** — one prompt-injection and it tweets a scam. capx café
structurally can't be: OAuth completes on a hosted callback, the token lives in a **server-side vault**, and
your agent holds only a short-TTL session handle. A deterministic guardrail (**casserole**) runs at the only
door to X and checks every post — a blocked post never even decrypts the token.

## Install

```bash
npx -y capx-cafe
```

Add it to your agent's MCP config:

```json
{
  "mcpServers": {
    "capx": {
      "command": "npx",
      "args": ["-y", "capx-cafe"],
      "env": {
        "CAPX_CHOKEPOINT_URL": "https://your-chokepoint.example",
        "CAPX_EMAIL": "you@example.com",
        "X_CLIENT_ID": "your-x-app-client-id"
      }
    }
  }
}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.capx]
command = "npx"
args = ["-y", "capx-cafe"]
env = { CAPX_CHOKEPOINT_URL = "https://your-chokepoint.example", CAPX_EMAIL = "you@example.com", X_CLIENT_ID = "your-x-app-client-id" }
```

Claude Code users can skip the manual config: `/plugin marketplace add vb-tyagi/capx-cafe` →
`/plugin install capx-cafe` (bundles the server + slash commands + skills).

## Config

| Var | Required | Meaning |
|---|---|---|
| `CAPX_CHOKEPOINT_URL` | yes | the chokepoint to use — capx provides yours when you're whitelisted (alpha); self-hosters set their own |
| `CAPX_EMAIL` | yes | your whitelisted email (hashed locally to an identity key; the raw email is never sent) |
| `CAPX_LANE` | no | `byo` (default) or `capx-app` |
| `X_CLIENT_ID` | BYO lane | your **own** X app OAuth2 Client ID (non-secret) |

No secret ever lands on disk — the client holds a revocable session handle, never a token.

## Tools your agent gets

`connect_x` · `whoami` · `post_now` (reply-chains + media) · `preview` (dry-run the guardrail, no send) ·
`audit` · `create_loop` / `list_loops` / `pause_loop` / `top_up_loop` / `delete_loop` · `upload_media`

Plus **skills** that turn your git log / PRs / releases into posts — `build-in-public`, `ship-note`,
`repurpose`, `thread-builder`, and more — one canonical source, generated for every agent.

## Security & self-host

The token, the guardrail, and the send are **one inseparable server-side unit**. Self-host the identical
open-source chokepoint with your own keys — the guarantee is per-operator. Threat model + the "what we
can/can't see" table: **https://github.com/vb-tyagi/capx-cafe/blob/main/docs/SECURITY.md**

## License

**MIT** (this client). The server-side chokepoint is **AGPL-3.0**. Map:
https://github.com/vb-tyagi/capx-cafe/blob/main/LICENSING.md
