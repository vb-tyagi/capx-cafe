# Launch Listings — verified submission runbook (2026-07-20)

Repo: https://github.com/vb-tyagi/capx-cafe · npm: **`capx-cafe`** (live) · install: `npx -y capx-cafe`

## Reusable copy
- **Name:** capx café · **package:** `capx-cafe` · **category:** Social / Communication
- **One-liner:** The safe way to let your AI run your X — one MCP server, token never on the agent.
- **Short:** Agent-native X (Twitter) posting as one MCP server for Claude Code / Cursor / Codex / Windsurf. Your X token never touches the agent; every post clears a server-side guardrail before it ships.
- **Config surfaced:** `CAPX_CHOKEPOINT_URL` (req), `CAPX_EMAIL` (req), `CAPX_LANE` (byo|capx-app), `X_CLIENT_ID` (BYO).
- **License:** MIT (client) / AGPL-3.0 (server).

## ✅ Done in the repo (machine-readable manifests the directories auto-read)
| File | For |
|---|---|
| `server.json` | Official MCP registry (schema 2025-12-11) |
| `smithery.yaml` | Smithery (stdio startCommand + config schema) |
| `glama.json` | Glama (claims ownership under `vb-tyagi`) |
| `mcp.json` | Cursor directory auto-detect |
| `build.mjs` + `package.json` | bumped to **0.1.1** + `mcpName` added (required for the MCP registry) |

---

## Submissions — grouped by who does it

### 🔑 Needs YOU (OAuth / web form / npm token) — I can't do these headlessly

**1. Official MCP registry** (`registry.modelcontextprotocol.io`) — CLI + GitHub OAuth
```sh
# a) republish npm at 0.1.1 (adds mcpName so the registry can verify ownership)
pnpm --filter @capx-cafe/mcp build && cd apps/capx-mcp/dist && npm publish --access public   # your granular token
# b) publish to the registry (server.json is already in the repo root)
brew install mcp-publisher
mcp-publisher login github        # opens browser — your GitHub (vb-tyagi)
mcp-publisher publish             # reads ./server.json
curl "https://registry.modelcontextprotocol.io/v0/servers?search=capx-cafe"   # verify
```
> PulseMCP + others ingest from this registry, so it's the highest-leverage one.

**2. Smithery** — https://smithery.ai/new → sign in with GitHub → select `vb-tyagi/capx-cafe` (it reads `smithery.yaml`) → Deploy. Goes live at `smithery.ai/server/@vb-tyagi/capx-cafe`.

**3. Glama** — https://glama.ai/mcp/servers/add → paste `https://github.com/vb-tyagi/capx-cafe` → GitHub OAuth (verifies you're a maintainer; `glama.json` already claims it).

**4. mcp.so** — https://mcp.so/submit?type=server → sign in → paste the repo URL → **Free submission** (queued review; it auto-reads the repo).

**5. PulseMCP** — https://www.pulsemcp.com/submit → choose *MCP Server* → paste the repo URL → submit (no account). Also auto-updates from #1.

**6. Cursor directory** — https://cursor.directory/plugins/new → sign in → paste the repo URL (it auto-detects `mcp.json`).

**7. wong2 list** — https://mcpservers.org/submit (web form; that list doesn't take PRs). Name: capx café · Link: repo URL.

### 🤝 I can do WITH your go-ahead (posts under your GitHub identity)

**awesome-mcp-servers PR** (punkpeye/awesome-mcp-servers) — add this line under `### 🌐 Social Media`, alphabetized under `v`:
```md
- [vb-tyagi/capx-cafe](https://github.com/vb-tyagi/capx-cafe) 📇 🏠 - Agent-native X (Twitter) posting as one MCP server for Claude Code / Cursor / Codex / Windsurf. Your X token never touches the agent; every post clears a server-side guardrail before it ships.
```
Fork → add line → PR. Say the word and I'll open it.

---

## Optional: "Add to Cursor" one-click badge (drop into README)
```md
[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-000?logo=cursor)](cursor://anysphere.cursor-deeplink/mcp/install?name=capx-cafe&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNhcHgtY2FmZSJdLCJlbnYiOnsiQ0FQWF9DSE9LRVBPSU5UX1VSTCI6IiIsIkNBUFhfRU1BSUwiOiIiLCJDQVBYX0xBTkUiOiJieW8iLCJYX0NMSUVOVF9JRCI6IiJ9fQ==)
```
