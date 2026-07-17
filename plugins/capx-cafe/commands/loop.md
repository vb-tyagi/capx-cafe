---
description: Schedule recurring X posts (a loop). You write the posts; capx ships them on schedule.
argument-hint: <schedule intent, e.g. "weekdays 9am, build updates">
---

Help the user set up a scheduled posting loop using the capx `create_loop` MCP tool.

The user's intent: "$ARGUMENTS"

Do this in order:
1. **Confirm the schedule** with the user: local time as `HH:MM`, which days (0=Sun .. 6=Sat), and the timezone (default to their machine's).
2. **Write the posts yourself.** capx never generates content — a loop is a schedule plus a queue of text YOU wrote. Draft the posts that match the user's intent, show them, and get approval before creating anything.
3. Call `create_loop` with `{ time, daysOfWeek, posts: [...], timezone }`. One post is sent per fire, in order.
4. A loop requires a **verified X account at least 30 days old**. If create_loop rejects it for that, explain the requirement rather than retrying.
5. Finally call `list_loops` and show the created loop, its schedule, and its queued posts.

When a loop runs out of queued posts it pauses and asks for more — use `/capx-cafe:status` to check, and top it up later.
