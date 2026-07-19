---
description: "A loop is running low — refill it from your newest commits. list_loops finds the near-empty one; you draft fresh grounded posts; capx ships them guarded via top_up_loop."
---
<!-- GENERATED from skills/gap-alert/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

A scheduled loop is draining faster than you've been refilling it. Top it up from the work you've **actually
shipped since it was last filled** — capx never generates content; you write the posts from the real git
history, and each one passes the casserole guardrail at send. This is the back half of `build-in-public`:
together they turn a queue into a self-refilling engine. User's extra intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Find the loop that's low.** Call `list_loops`. Each loop reports how many posts remain and its schedule.
   Pick the one running low — the loop named/id'd in "$ARGUMENTS" if given, otherwise the loop with the
   fewest posts left (a loop at 0–2 remaining is the one to refill). If nothing is actually low, say so and
   stop — don't manufacture posts to pad a healthy queue.

2. **Find where you left off.** You're refilling from *new* work only, not re-posting old news. Establish the
   waterline: check what that loop already has queued/sent so you don't repeat it, then read the commits since
   then — `git log --oneline -30` (or the range in "$ARGUMENTS"), skimming diffs of the substantive ones.
   **Skip the noise** — merges, `wip`, `fix typo`, formatting, dep bumps. You want the shippable, interesting
   changes: new features, real fixes, milestones, hard problems solved.

3. **Check there's genuinely something new to say.** If the only commits since the last fill are noise, don't
   force it — tell the user the loop is low but there's no fresh, postable work yet, and let them decide
   (write something manually, pause the loop, or come back after more commits). A refill with nothing real
   behind it is exactly what the guard blocks and what readers tune out.

4. **Draft the top-up posts.** Cluster related new commits into a handful of stories and write ONE post each
   that is:
   - **Concrete and specific** — name the actual thing you shipped and why it matters. "Fixed X so Y now
     works" beats "more progress!". (The guard blocks vague hype, engagement-bait, hashtag-stuffing, and
     duplicates — specificity is what gets through *and* what people read.)
   - **Grounded in the commits** — don't invent features, numbers, or outcomes that aren't real. Unsure a
     claim is true? Leave it out or ask.
   - **Not a repeat** — distinct from what this loop already queued or sent in step 2.
   - **In the user's voice** — match the `voice-match` profile if available, else mirror the tone of the
     posts already in this loop.
   - **Within X's length** — one post ≤ 280 weighted chars.

5. **Show the drafts and get approval.** Present the new posts as a numbered list, note how many the loop had
   left and how many you're adding. Let the user edit, cut, or reorder before anything is queued. Never top
   up without showing them first.

6. **Top it up.** Call `top_up_loop` with `{ id, posts: [...] }` for the loop from step 1. The new posts
   append to the existing queue and fire on the loop's current schedule — you're extending the runway, not
   changing the cadence.

7. **Confirm.** Call `list_loops` again and show the refilled loop with its new remaining count and schedule,
   so the user can see the runway is restored.

**Hard rules:** you draft, casserole decides — if a post comes back `blocked` or `held`, show the reason and
fix the *content* (be more specific, drop the bait); never route around the guard. Never fabricate progress to
fill a gap — an empty loop is better than a false one. And refill from *new* work only, so the timeline stays
honest and non-repetitive.

**Make it automatic:** run this whenever a loop pauses for being low, or on your own cadence (e.g. after a big
push). Paired with `build-in-public` creating the loop, `gap-alert` keeps it alive — your normal commits
become the fuel that never lets the queue hit zero.
