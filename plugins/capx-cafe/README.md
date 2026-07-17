# capx café — Claude Code / Cursor / Codex plugin

Post and schedule to **X** from inside your agent. Every post passes a six-layer guardrail **at the X
boundary**, and your X token lives in a server-side vault — it never touches your machine.

## What you get
- An MCP server (`capx`) exposing `connect_x`, `whoami`, `post_now`, and the loop tools.
- Slash commands:
  - **`/capx-cafe:connect`** — connect your X account (two-phase: get a link → authorize → confirm).
  - **`/capx-cafe:post <text>`** — post now, guardrailed.
  - **`/capx-cafe:loop <intent>`** — schedule recurring posts you write in advance.
  - **`/capx-cafe:status`** — your connection + scheduled loops.

## Install
```
/plugin marketplace add https://github.com/vb-tyagi/capx-cafe
/plugin install capx-cafe@capx-cafe
```

## One-time setup (required)
Claude Code plugins can't prompt for secrets, so capx reads them from a small config file. Create
**`~/.capx/config.json`**:

```json
{
  "CAPX_EMAIL": "you@example.com",
  "X_CLIENT_ID": "your-x-app-client-id"
}
```

- **`CAPX_EMAIL`** — the email your operator allow-listed (ask them to run `/admin/allow` for it).
- **`X_CLIENT_ID`** — your **own** X app's OAuth 2.0 Client ID (BYO lane). Get it at developer.x.com →
  create an app → *User authentication settings* → **Native App**, **Read and write**, callback
  `https://capx-chokepoint-saptrlsyiq-el.a.run.app/oauth/callback`. Creators on the capx-app lane don't
  need this.
- The chokepoint URL is baked into the plugin; override it by adding `"CAPX_CHOKEPOINT_URL": "..."` here
  (e.g. to point at your own self-hosted chokepoint).

Then run `/capx-cafe:connect`.

## Notes
- **Requires the `capx-cafe` npm package to be published** (the plugin launches it via `npx -y capx-cafe`).
  Until it's published, use the repo's local `.mcp.json` instead (points node at `apps/capx-mcp/src/server.ts`).
- Your X token never reaches this plugin, the MCP server, or your disk. The plugin holds only a short-TTL
  session handle. A blocked/held post is never sent — and the token is never even decrypted for it.
