---
description: Show your capx connection and any scheduled loops.
---

Report the user's capx status concisely:

1. Call the `whoami` MCP tool. Show the connected **@handle**, the lane (byo / capx-app), and flag it if the connection **needs re-auth**.
2. Call the `list_loops` MCP tool. For each loop, summarize: the schedule (time + days + timezone), how many posts are queued, and whether it is paused (and why).

If nothing is connected, say so and point the user to `/capx-cafe:connect`. Keep the whole report short.
