# Launch Listings — verified submission runbook

> **STATUS 2026-09-03 — ✅ OFFICIAL MCP REGISTRY: PUBLISHED.** `io.github.vb-tyagi/capx-cafe` v0.1.3,
> status `active`, website `https://capx-cafe.vercel.app`. Verify:
> `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=capx-cafe"`.
> Registry metadata is IMMUTABLE + CC0 — changes require publishing a new version.
> Glama, PulseMCP, GitHub/VS Code and others ingest from the registry automatically.
>
> **Verdicts locked by the founder after a full re-investigation (2026-09-03):**
> - **mcp.so — SKIP the site.** Not just the $39: every one of 60 listings created since 2026-07-26 is
>   `paidSubmission:true`, and 0 of 20 aged free GitHub-issue submissions ever went live. Do NOT hand-craft
>   the `plan:'free'` API call — that circumvents their paywall.
> - **Smithery — DON'T.** URL/hosted listings proxy through Smithery's gateway (breaks the "our vault, our
>   guardrail, only door" thesis); the safe local-MCPB path is broken (no description/homepage/repo, "No
>   capabilities found"), distributes a frozen copy of our binary from their storage, has ~zero traffic, and
>   Smithery was acquired 2026-08-05 by Arcade.dev — a direct competitor. Revisit only if the MCPB metadata
>   pipeline is fixed.
> - **cursor.directory — list ALL 25 components** (1 MCP server + 24 skills).
> - **Anything paid — skip.** Every remaining target below is free.
>
> **SUBMITTED 2026-09-03:**
> - **Glama** — submitted via Add Server (name `capx café`, repo URL, locked short description). Awaiting
>   their review ("Public submissions are reviewed before becoming publicly visible"); the page 404s until
>   it clears. NOTE: no explicit receipt page was shown — the dialog closing cleanly was the only signal.
>   FOLLOW-UPS once live: claim ownership (glama.json already lists `vb-tyagi`, should auto-link) + set
>   category **Social Media**. punkpeye/awesome-mcp-servers is gated on a Glama score, so it waits on this.
> - **cursor.directory** — ✅ PUBLISHED to https://cursor.directory/plugins/capx-cafe (ghost logo, homepage +
>   source links, keywords from `.plugin/plugin.json`). Detected **25 components = 1 MCP server + 24 skills**,
>   exactly the locked shape. Currently "Scanning your plugin… it will appear publicly once the security agent
>   finishes" — a `safe` verdict auto-publishes it. The MCP-server component was ONLY detectable because the
>   sanitized root `.mcp.json` was committed the same day; before that the scan would have found skills only.
>   NOTE: cursor.directory sits behind a Vercel anti-bot wall — curl gets 429; check it in a real browser.
>
> **Free targets still to do (ranked by reach):** Docker MCP Registry (ships inside Docker Desktop) ·
> LobeHub (94k servers) · Glama (81k; also auto-ingests the registry) · cursor.directory ·
> Cline marketplace · mcpservers.org (free is the DEFAULT — see the WebMCP warning below) ·
> mcp.directory (+ /submit-skill) · appcypher/awesome-mcp-servers · punkpeye/awesome-mcp-servers
> (gated on a Glama score). PulseMCP + GitHub/VS Code arrive free via registry propagation.
>
> ⚠️ **mcpservers.org safety note:** that page ships a live Chrome WebMCP origin trial with
> `toolautosubmit` enabled — an attached agent can submit with NO human click. Open it in a plain browser
> tab with no agent connected so the founder's click stays the founder's.
>
> ⚠️ **Blocker before cursor.directory:** the root `.mcp.json` scanners look for is gitignored (it holds a
> real email, client id and machine path) and 404s on GitHub — a sanitized one must be committed, or the
> scan finds skills only. Founder decision pending.


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
