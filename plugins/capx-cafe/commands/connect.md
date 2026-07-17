---
description: Connect your X account to capx (or confirm after authorizing in the browser).
---

Connect the user's X account using the capx `connect_x` MCP tool. It is a two-phase flow.

- If the user has NOT authorized yet (or "$ARGUMENTS" is empty): call `connect_x` with no arguments. Show them the returned consent URL verbatim and tell them to open it, click **Authorize**, then come back and run this command again.
- If the user says they have authorized (or "$ARGUMENTS" contains the word `confirm`): call `connect_x` with `{ "confirm": true }`, then call `whoami` and tell them which **@handle** is now connected.

Never ask the user for their X password or tokens — connect_x handles auth in the browser, and the token is stored server-side, never on this machine.
