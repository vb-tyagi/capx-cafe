# Launch Listings — ready-to-paste copy + where to submit

Everything you need to list capx café across the MCP ecosystem. Reuse the copy below verbatim.

- **Repo:** https://github.com/vb-tyagi/capx-cafe
- **npm:** `capx-cafe` · **install:** `npx -y capx-cafe`
- **Security page:** https://github.com/vb-tyagi/capx-cafe/blob/main/docs/SECURITY.md

---

## Reusable copy (paste these)

**Name:** capx café  ·  **package:** `capx-cafe`

**One-liner (≤ 80 chars):**
> The safe way to let your AI run your X — one MCP server, token never on the agent.

**Short (≤ 160):**
> Agent-native X posting as one MCP server (Claude Code / Cursor / Codex / Windsurf). Your token never touches the agent; every post clears a server-side guardrail.

**Medium (≤ 350 — matches the GitHub About):**
> Agent-native X poster — one MCP server for any coding agent (Claude Code / Cursor / Codex / Windsurf). Connect X once, then create/schedule/post from your agent session. Token + casserole guardrail + send are one server-side unit; your agent holds only a short-TTL handle, never the token. "The AI writes; casserole decides what ships."

**Long (paragraph):**
> capx café installs as one MCP server into any coding agent. A whitelisted user connects their X account
> once; after that they create, schedule, and post from inside their agent session. Its security thesis: the
> X token, the guardrail (casserole), and the send are one inseparable server-side unit — the agent on your
> laptop only ever holds a short-TTL session handle, never the token — so it structurally can't be
> prompt-injected into tweeting a scam. Skills turn your git log, PRs, and releases into posts, automatically,
> and every post rides the guardrail. "The AI writes; casserole decides what ships."

**Tags / keywords:** `mcp` `model-context-protocol` `x` `twitter` `social` `posting` `scheduling` `agent`
`ai-agent` `claude` `claude-code` `cursor` `codex` `windsurf` `security` `guardrail`

**Category:** Social / Communication (secondary: Developer Tools, Productivity)

**Config the listing should surface:** `CAPX_CHOKEPOINT_URL` (required), `CAPX_EMAIL` (required),
`CAPX_LANE` (optional: byo|capx-app), `X_CLIENT_ID` (BYO lane).

**License:** MIT (client) / AGPL-3.0 (server).

---

## Where to list — in fit order (verify each site's current submission flow)

1. **npm** — `capx-cafe`. Publishing *is* the listing (see the publish steps below). Highest intent.
2. **Official MCP registry** — `github.com/modelcontextprotocol/registry`. Add a `server.json` (name,
   description, `repository`, the `capx-cafe` npm package + the env config schema) and submit via their
   publish CLI / PR flow. This is the canonical index other tools pull from.
3. **Smithery** — `smithery.ai/new`. Connect the GitHub repo, define the config (the four env vars above),
   category Social, publish. Consider adding a `smithery.yaml` to the repo.
4. **Glama** — `glama.ai/mcp/servers`. Auto-indexes public MCP repos; the repo README + the `mcp` topic
   carry it. Add the `mcp` / `model-context-protocol` GitHub **topics** to the repo to help discovery.
5. **mcp.so** — submit the repo URL + short description.
6. **PulseMCP** — `pulsemcp.com` submit form; repo URL + description + category.
7. **awesome-mcp-servers** — PR to `github.com/punkpeye/awesome-mcp-servers` (and `wong2/awesome-mcp-servers`).
   Suggested entry under a Social/Communication section:
   > `- [capx café](https://github.com/vb-tyagi/capx-cafe) — agent-native X posting; the token never touches the agent and every post clears a server-side guardrail.`
8. **Cursor MCP directory** — provide an "Add to Cursor" deeplink + the config.

## Repo housekeeping that boosts discovery

- Add GitHub **topics**: `mcp`, `model-context-protocol`, `x`, `twitter`, `ai-agent`, `claude-code`, `cursor`,
  `codex`, `windsurf`, `security` (Settings → About → topics, or `gh` API).
- Ensure the README trust story + install are above the fold (done).

## The meta-launch (highest-leverage, costs nothing)

Post the launch thread **through capx itself** (GTM-PLAN §3): *"this thread was posted by my agent,
guardrailed, and my X token never touched my laptop — here's how."* Then **Show HN** with the security angle
("How we keep an X token out of reach of a co-resident AI agent"), Tue–Thu morning ET (GTM-PLAN §4). Product
Hunt after HN.

## Per-directory checklist

For each site: ☐ name ☐ one-liner ☐ description ☐ repo URL ☐ npm `capx-cafe` ☐ `npx -y capx-cafe`
☐ config/env schema ☐ category + tags ☐ license ☐ security-page link.
