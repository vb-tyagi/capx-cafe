---
name: build-in-public
description: Turn recent git activity into build-in-public X posts, queued to a schedule. You (the agent) draft from the real commits — capx never writes; it ships them guarded.
argument-hint: "[optional: how many posts, a time range, or a schedule like 'weekdays 9am']"
version: 0.1.0
tools: [post_now, create_loop, list_loops]
---

Turn what the developer has actually been building into a queue of build-in-public X posts. **You write the
posts** from the real git history — capx never generates content; it only ships (each post passes the
casserole guardrail at send). User's extra intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Read the real work.** Run `git log --oneline -30` (or a range the user named). Skim the diffs of the
   substantive commits if needed. **Skip the noise** — merges, `wip`, `fix typo`, formatting, dependency
   bumps. You want the *shippable, interesting* changes: new features, fixes users would care about,
   milestones, hard problems solved.

2. **Group into themes.** Cluster related commits into a handful of "this is worth a post" stories. A week
   is usually 3–5 posts, not one-per-commit.

3. **Draft the posts.** For each theme write ONE post that is:
   - **Concrete and specific** — name the actual thing you built and why it matters. "Shipped X so users can
     now Y" beats "made great progress today!". (The guardrail actively blocks vague hype, engagement-bait,
     hashtag stuffing, and duplicates — specificity is what gets through *and* what people actually read.)
   - **Grounded in the commits** — do NOT invent features, numbers, or outcomes that aren't real. If you're
     unsure a claim is true, leave it out or ask.
   - **In the user's voice** — if a voice profile is available (the `capx-voice-match` skill), match it;
     otherwise mirror the tone of their recent posts, or ask.
   - **Within X's length** — one post ≤ 280 weighted chars; if a story needs more, make it a short thread and
     say so.

4. **Show the drafts and get approval.** Present the posts as a numbered list. Let the user edit, cut, or
   reorder before anything is scheduled. Never post without showing them first.

5. **Get the schedule.** Ask for local time (HH:MM), which days (e.g. weekdays), and timezone — or use what
   the user gave in "$ARGUMENTS". If they'd rather post one right now instead of scheduling, do that with
   `post_now`.

6. **Queue it.** Call `create_loop` with `{ time, daysOfWeek (0=Sun..6=Sat), posts: [...], timezone }`. One
   post is sent per fire, in order. Note: a loop needs a **verified X account at least 30 days old** — if
   create_loop rejects it for that, explain the requirement instead of retrying.

7. **Confirm.** Call `list_loops` and show the created loop, its schedule, and the queued posts.

**When the queue later runs low** it pauses and asks for more — re-run this skill (or `capx-loop`) to top it
up from the newer commits. Your normal work keeps the queue full.

**Hard rules:** you draft, casserole decides — if a post comes back `blocked` or `held`, show the reason and
fix the *content* (be more specific, drop the bait); never try to route around the guard. And never fabricate
progress — build-in-public only works if it's true.
