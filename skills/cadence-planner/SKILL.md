---
name: cadence-planner
description: "Turn a backlog of drafts or a content goal into a non-robotic posting cadence — how many a week, which days and times — then create the loop(s). You draft; capx only ships."
argument-hint: "[optional: a content goal, how many drafts you have, or a target like '4 a week, weekday mornings']"
version: 0.1.0
tools: [create_loop, list_loops, top_up_loop, post_now]
---

Take a pile of drafts (or a content goal) and turn it into a **sensible, human-looking posting rhythm** — how
many a week, which days, what times, spread so it never reads as a bot — then create the loop(s). **You do the
drafting** when drafting is needed; capx never generates content, it only ships (every post clears the
casserole guardrail at send). User's material or target, if any: "$ARGUMENTS"

If you're not connected to X yet, run the **connect** skill first — loops can't be created without it.

Follow these steps:

1. **Get the material.** Two cases. (a) The user hands you a **backlog of drafts** — those are theirs; use
   them as-is (only polish if asked). (b) They give only a **goal or theme** — then *you* write the posts,
   grounded in real things (their actual work, product, or experience). Never fabricate features, numbers, or
   outcomes. Count how many posts you have — that number drives everything below.

2. **Pick a sustainable rate.** A healthy build-in-public rhythm is **~3–5 posts/week**. Resist dumping the
   whole backlog in one week — more than roughly one a day reads as spam, and the guard blocks near-duplicates
   and low-effort filler anyway. Compute the **runway**: posts ÷ per-week = how many weeks the queue lasts.
   Name the tradeoff out loud (post more often → run dry sooner).

3. **Spread it so it's not robotic.** Pick days *across* the week rather than clustered, and **vary the
   time-of-day** instead of firing the same minute every day. Anchor to when their audience is awake and to
   their own timezone. A little irregularity is the point — it's what a real person's feed looks like.

4. **Decide one loop or several.** One `create_loop` = one recurring schedule (fixed days + time) that sends
   **one queued post per fire, in order**. Use **multiple loops** when the plan naturally splits — e.g. a
   Tue/Thu 09:00 loop for substantive updates plus a Sat 11:00 loop for lighter posts, or different content
   buckets on different rhythms. Assign specific drafts to each loop in send order.

5. **Show the plan and get approval.** Present it as a clear map: each loop's days / time / timezone, exactly
   which posts land in which loop and in what order, and the runway (weeks until it empties). Let the user move
   posts between loops, shift times, or cut before anything is created. Never create a loop without showing the
   plan first.

6. **Create the loop(s).** For each, call `create_loop` with `{ time (HH:MM local), daysOfWeek
   (0=Sun..6=Sat), posts: [...], timezone }`. Note: a loop needs a **verified X account at least 30 days
   old** — if `create_loop` rejects it for that reason, explain the requirement instead of retrying. If a draft
   comes back `blocked` or `held` by casserole, show the reason and fix the **content** (make it more specific,
   drop the hype or bait) — never route around the guard.

7. **Confirm.** Call `list_loops` and show every loop you created — schedule, timezone, and the queued posts in
   order — so the whole cadence is visible in one place.

**When a loop later runs low** it pauses and asks for more — top it up with `top_up_loop {id, posts}`, or
re-run a drafting skill (`build-in-public` / `loop`) to refill it from newer work. If the user would
rather fire a single post now than schedule anything, that's `post_now`.

**Hard rules:** you draft, casserole decides — on `blocked`/`held`, fix the content, never bypass the guard.
Never fabricate to fill a slot; a sparse-but-true cadence beats a dense fake one. And keep it human — a
schedule that's too dense or too mechanical is worse than a lighter, well-spread one.
