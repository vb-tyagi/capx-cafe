# capx café — installation guide for AI assistants

This file tells an AI assistant (Cline, Claude Code, Cursor, …) how to install and configure
**capx café** for a user, end to end. Written for the assistant, not the human.

## What this server is

capx café posts and schedules to X (Twitter) from inside a coding agent. Its defining property:
**the X token is never placed in the user's config or on their machine.** OAuth completes on a hosted
callback and the token is sealed in a server-side vault; the agent holds only a short-lived, revocable
session handle. Every post passes a deterministic six-layer guardrail (**casserole**) server-side,
at the only code path to X — so a blocked post never even decrypts the token.

**Do not ask the user for an X password, an X API key, or an X access token. There is none to collect.**

## Step 1 — add the MCP server

```json
{
  "mcpServers": {
    "capx-cafe": {
      "command": "npx",
      "args": ["-y", "capx-cafe"],
      "env": {
        "CAPX_CHOKEPOINT_URL": "<chokepoint URL>",
        "CAPX_EMAIL": "<the user's whitelisted email>",
        "CAPX_LANE": "byo",
        "X_CLIENT_ID": "<the user's own X app client id — BYO lane only>"
      }
    }
  }
}
```

Requires **Node >= 22.6**. The server boots without configuration (so `tools/list` always works); an
unconfigured tool call returns a clear error rather than crashing.

## Step 2 — collect the two required values from the user

| Variable | What to ask for | Required |
|---|---|---|
| `CAPX_CHOKEPOINT_URL` | The capx chokepoint they connect to — the hosted service, or their own if self-hosting | yes |
| `CAPX_EMAIL` | The email on the access whitelist (capx has no user database; this is the identity key) | yes |
| `CAPX_LANE` | `byo` (their own X developer app) or `capx-app` (capx's shared app) — default `byo` | no |
| `X_CLIENT_ID` | Their X app's OAuth client id — **BYO lane only** | BYO only |

**BYO lane cost note, state it plainly:** X removed its free API tier for new developer apps in Feb 2026.
On the BYO lane the user is X's customer and pays X directly — roughly **$0.015 per post, and $0.20 if the
post contains a link**, after pre-loading credits in X's developer console. capx charges nothing for this lane.

## Step 3 — connect the X account

Call the `connect_x` tool and give the user the URL it returns. They authorize in a browser; X redirects to
the **chokepoint's** callback and the token lands in the vault. It never transits the user's machine — no
keychain entry, no local file, no loopback port. Confirm with `whoami`.

## Step 4 — verify

- `whoami` → the connected handle and its status
- `preview` with a draft → a dry-run guardrail verdict (pass / hold / block) **without sending**
- `post_now` → posts for real, after clearing the guardrail

Prefer `preview` before the user's first real post: it shows the guardrail working and costs nothing.

## The tools

`connect_x` · `post_now` (supports reply-chains + media) · `preview` (dry run) · `audit` (durable send
history) · `create_loop` / `list_loops` / `pause_loop` / `delete_loop` / `top_up_loop` (scheduled posting
that runs with the laptop closed) · `upload_media` · `whoami`

## Behaviour to respect

- **capx café generates no content.** The user's own agent writes the text; capx transports what clears
  the guardrail. Never imply the service writes posts.
- **Replies chain only onto the user's own posts.** Replying to third parties is blocked by design
  (it is what the app's registered use case with X states).
- **A thread is at most 10 posts**, and thread posts may not contain links.
- **Anti-spam velocity caps**: 10 posts/hour and 40/day per account, to protect the account from X's
  spam enforcement. These are safety ceilings, not billing limits.
- If a post is blocked, show the user the guardrail's stated reasons — do not retry it verbatim, and do
  not attempt to route around the guardrail.

## Links

Repository <https://github.com/vb-tyagi/capx-cafe> · Landing <https://capx-cafe.vercel.app> ·
Security model <https://github.com/vb-tyagi/capx-cafe/blob/main/docs/SECURITY.md> ·
npm <https://www.npmjs.com/package/capx-cafe>
