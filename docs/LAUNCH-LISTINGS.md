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
> **SUBMITTED/LIVE 2026-09-03..04 (second wave):**
> - **mcpservers.org** — ✅ submitted by the founder in a plain tab (free path; ≤12h review).
> - **mcp.directory** — ✅ submitted (repo + npm `capx-cafe` + 93-char description + founder email); publishes within 24h.
> - **Cline marketplace** — ✅ issue https://github.com/cline/mcp-marketplace/issues/2421 (repo, 400x400 logo at
>   docs/assets/logo-400.png, both testing boxes ticked after the founder tested the Cline setup). `llms-install.md`
>   added to the repo root for this.
> - **LobeHub** — ✅ PUBLISHED https://lobehub.com/mcp/vb-tyagi-capx-cafe (`vb-tyagi-capx-cafe@0.1.3`, display name
>   "capx café", category Social Media, all 11 tools). Flow: `lhm login` (OIDC) -> `lhm github connect` (OAuth) ->
>   `lhm plugin init --stdio "capx-cafe"` -> `lhm plugin publish <repo>` -> `lhm plugin update`. NOTES: (a) their
>   GitHub OAuth app demands gist RW + workflow write + ALL repos public/private — far beyond the documented
>   "repository access checks"; founder granted it deliberately and should REVOKE at GitHub > Settings >
>   Applications > Authorized OAuth Apps (the listing survives revocation). (b) `plugin init` needs the binary on
>   PATH (npx cold-start exceeds their inspector timeout) -> `npm i -g capx-cafe`. (c) Their auth backend failed
>   once mid-handshake and the Refresh-Metadata dialog would not submit — expect flakiness. (d) The page header
>   still shows a phantom crawler version 1.0.0 + "Unvalidated" + repo-level AGPL, while the API correctly reports
>   latestVersion 0.1.3; enrichment is async.
> - **appcypher/awesome-mcp-servers** — ❌ **DEAD, DO NOT RETRY.** The repo was ARCHIVED by its owner on
>   2026-08-01: read-only, "An owner of this repository has disabled the ability to open pull requests", last
>   push 2026-05-06. This is the real cause of the `gh pr create` 404 (an earlier note in this session wrongly
>   blamed CLI token scopes). The 2026-09-03 research brief listing it as "still accepts PRs" was also wrong.
>   Fork + branch discarded. **Use punkpeye/awesome-mcp-servers instead** — active (pushed 2026-09-01) and 94k
>   stars vs appcypher's 5.7k — but its CI requires a Glama badge + quality score first, so it waits on Glama.
>
> - **Docker Desktop (MCP Toolkit)** — ✅ **LIVE via a custom catalog**, not docker/mcp-registry.
>   `ghcr.io/vb-tyagi/capx-catalog:latest` + `ghcr.io/vb-tyagi/capx-cafe:0.1.3`, both PUBLIC. Users run
>   `docker mcp catalog pull ghcr.io/vb-tyagi/capx-catalog:latest` -> MCP Toolkit -> enable capx café.
>   Verified fully anonymously (logged out of ghcr, deleted the local image, re-pulled, ran it: 11 tools).
>   The official docker/mcp-registry is deliberately SKIPPED — see tools/docker-catalog/README.md for the
>   two reasons (an automated agpl-prefix licence gate we cannot pass without weakening the moat, and a
>   registry that has merged no new server since 2026-04-30). The watchdog's `docker-ghcr` check will flag
>   it if either package ever flips back to private.
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
