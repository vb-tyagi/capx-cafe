---
description: "Check the capx connection and self-heal it — whoami reports your @handle, lane, and needs-reauth; if it's stale or nothing's connected, it routes you to connect."
---
<!-- GENERATED from skills/connection-health/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Check the capx connection in one call and self-heal it if it's broken. This is a **read-and-route** skill — it
reports state and hands off; it never posts and never writes content. If the user named an account they expect
to be posting as, it's here: "$ARGUMENTS".

Follow these steps:

1. **Call `whoami`.** One call. It returns `{ connected, username, lane, needsReauth }` — that's the whole
   ground truth. Don't infer the connection from anything else, and don't fabricate a handle or lane you didn't
   get back.

2. **Nothing connected** (`connected: false`) — say so plainly and point them to the **connect** skill to
   link their X account. Stop here; there's nothing to heal until they connect.

3. **Connected and healthy** (`needsReauth: false`) — report it in a line: the **@handle** (`username`), the
   **lane** (`byo` = your own X developer app / `capx-app` = capx's shared app), and that it's good to post.
   Done.

4. **Connected but needs re-auth** (`needsReauth: true`) — the stored token has expired or been revoked, so
   posts and loops will fail until it's refreshed. Say that in one line, then walk them through **connect**
   to re-authorize the **same** @handle. Don't re-run `whoami` hoping the flag clears — re-auth is the only fix.

5. **Cross-check the handle.** If "$ARGUMENTS" named an expected account and the connected `username` doesn't
   match, flag the mismatch (you're connected as @X, not @Y) so nothing goes out from the wrong account — then
   reconnect via connect if it's the wrong one.

**Keep it short** — this is a status check, not a report: a line or two per case. Never ask the user for their
X password or tokens; connect handles auth in the browser and the token lives server-side, never on this
machine.
