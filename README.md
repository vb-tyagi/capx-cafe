# capx café

> **The safe way to let your AI run your X.**
> One MCP server. Your X token never touches the agent, and every post passes an enforced guardrail before it ships.

![license: MIT client / AGPL-3.0 server](https://img.shields.io/badge/license-MIT%20client%20%2F%20AGPL--3.0%20server-blue)
![node ≥ 22.6](https://img.shields.io/badge/node-%E2%89%A5%2022.6-informational)
![status: private alpha](https://img.shields.io/badge/status-private%20alpha-orange)

capx café installs as a single **[MCP](https://modelcontextprotocol.io) server** into your coding agent —
**Claude Code, Cursor, Codex, Windsurf**, or anything MCP-compatible — and lets it create, schedule, and
manage your **X (Twitter)** posts from inside the session you're already in.

Every other "let your AI post" tool has the same flaw: to let an agent post, you paste your X token into a
plaintext config **right next to an autonomous agent that reads untrusted web pages, issues, and code.** One
prompt-injection and your account tweets a scam. **capx café is the only one that structurally can't be.**

---

## Why it's different (the 30-second version)

- 🔒 **Your X token never touches your machine.** OAuth completes on capx's hosted callback; the token lives
  **encrypted in a server-side vault**. Your agent holds only a short-TTL session handle — never the token.
- 🛡️ **casserole** — a *deterministic (non-AI)* six-layer guardrail — runs **server-side at the only door to
  X** and checks **every** post. A blocked post never even decrypts your token (proven by an adversarial
  test suite).
- 🔗 **The token, the guard, and the send are one inseparable unit.** Call the server directly, skip the
  plugin entirely — you still hit the guard. The plugin's checks are cosmetic; the server's are load-bearing.
- ✍️ **capx generates nothing.** *Your* agent's model writes; capx ships what clears the guard.
  **"The AI writes; casserole decides what ships."**

→ Full threat model, architecture, and "what we can/can't see": **[docs/SECURITY.md](docs/SECURITY.md)**

---

## 60-second quickstart

```bash
# 1. Install (once published to npm)
npx -y capx-cafe            # runs the MCP server; add it to your agent's MCP config

# 2. In your agent, connect X (opens a browser once — the token stays on the server)
#    "connect my X account"      → connect_x
# 3. Post
#    "post: shipping the thing today"   → post_now  (clears casserole, or tells you why not)
```

Set two values in `~/.capx/config.json` (or your agent's MCP env): `CAPX_EMAIL` (your whitelisted email) and,
for the BYO lane, `X_CLIENT_ID` (your own X app's OAuth 2.0 Client ID — a [guided setup page](#) walks you
through it). That's it.

### Per-agent install

| Agent | How to add it |
|---|---|
| **Claude Code** | `/plugin marketplace add vb-tyagi/capx-cafe` → `/plugin install capx-cafe` (bundles the MCP server + slash commands + skills) |
| **Cursor** | Add to `.cursor/mcp.json`; skill templates ship in `plugins/capx-cafe/adapters/cursor/` |
| **Codex** | Add to your MCP config; prompt pack in `plugins/capx-cafe/adapters/codex/` |
| **Windsurf** | Add to MCP config; workflows in `plugins/capx-cafe/adapters/windsurf/` |
| **Any MCP agent** | Point it at `npx -y capx-cafe` |

---

## What your agent can do

| Tool | What it does |
|---|---|
| `connect_x` | One-time browser OAuth — the token lands in the server vault, never on your machine |
| `post_now` | Post now; clears casserole first. Supports **reply-chains** (`inReplyToId`) and **media** (`mediaIds`) |
| `preview` | **Dry-run** a draft through the guardrail without sending — see pass/hold/block + why |
| `audit` | The durable record of what capx posted or attempted on your behalf, and its state |
| `create_loop` / `list_loops` / … | **Scheduled posting** — a queue of posts you wrote, sent on a schedule, **laptop-off** |
| `upload_media` | Stream a local image/video to X and attach it (media you made with your own tools) |
| `whoami` | The connected account + its status |

---

## Skills — your work becomes your content

capx lives inside a *coding* agent, so it has what no social scheduler does: your **repo, commits, PRs,
releases.** Skills turn that into posts — automatically, and always through the guardrail:

- 🏆 **build-in-public** — reads your recent `git log`, drafts a week of posts, queues them as a loop.
- **ship-note** · **changelog-thread** · **repurpose** (blog/README → thread) · **launch-thread** · **til** · **fix-note**
- **voice-match** (match your own past posts) · **draft-review** (lint against the guard) · **thread-builder** · **hook-rewrite**
- **best-time** · **cadence-planner** · **gap-alert** (tops up a loop from new commits — the self-refilling engine)
- **audit-trail** · **connection-health** · **quickstart** · **self-host-guide**
- **Media directors** — `image-director`, `video-director`, `prompt-engine`, `model-guide`: capx runs no models;
  it guides *your* image/video tools (higgsfield, fal, kling, …) and uploads the result. casserole guards your
  **caption**; you own the media.

Every skill is authored once and generated for all four agents. capx never writes the content — it makes
*good* content easy and stops *bad* content regardless of which skill produced it.

---

## Two lanes

- **BYO** — you bring your own X developer app. You're X's customer; you pay X; capx just transports + guards.
- **capx-app** (creator lane) — post through capx's X app, no developer account needed. Metered + capped.

## Self-host

The chokepoint is open source (AGPL-3.0). Run the **identical image** with your own X app, keys, database, and
domain — `CAPX_DEPLOY_MODE=self-host`, zero telemetry to capx. See the `self-host-guide` skill and
[docs/HANDOFF.md](docs/HANDOFF.md).

## Architecture

```
your machine (untrusted)          ── trust boundary ──          the chokepoint (hosted · AGPL)      X
agent · skills · MCP client   ──  only a session handle  ──►  admission → casserole → vault →   ──►  /2/tweets
(holds no token)                     crosses, not the token     x-adapter · outbox · scheduler
```

Deterministic guardrail, encrypted token vault (AES-256-GCM + KMS), hosted-callback PKCE OAuth, durable
idempotent outbox, one Postgres — **no multi-tenant user database.** Details: [docs/SECURITY.md](docs/SECURITY.md),
[docs/P1-CHOKEPOINT.md](docs/P1-CHOKEPOINT.md).

## Licensing

**MIT** for the client and everything it bundles (`apps/capx-mcp`, `core`, `config`, `platform-client`) plus
skills & docs. **AGPL-3.0** for the server half (the chokepoint + `casserole`/`captain`/`counter`/`canteen`/
`chef`). Full map: [LICENSING.md](LICENSING.md).

## Status

**Private alpha, whitelist-only.** The first real post shipped 2026-07-19. Not yet open for public signups.

## Dev

Node ≥ 22.6 (TypeScript runs natively via `--experimental-strip-types` — no build step). `pnpm run verify` =
unit tests across packages/services/apps + `tsc`. Contributions accepted under the project CLA.
