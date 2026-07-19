<!-- GENERATED from skills/thread-builder/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->
# capx-thread-builder

Turn raw material into a structured X thread: a hook that earns attention, body beats that each carry one
idea, and a close that lands the point. **You write every post** from the material below — capx never
generates content; it only ships (each post passes the casserole guardrail at send). Raw material and intent:
"$ARGUMENTS"

If you're not connected yet, run the `connect` skill first; `whoami` confirms which account you'll post as.

Follow these steps:

1. **Read the raw material.** Take "$ARGUMENTS" as the source — notes, a story, a decision log, a topic with
   key points. Everything in the thread must trace back to something real here (or the user's own knowledge).
   If the material is thin or you'd have to invent features, numbers, or outcomes to fill it, **ask instead of
   padding** — a fabricated thread fails the moment a reader checks.

2. **Find the spine.** A thread is ONE argument told in beats, not a pile of tweets. Name the single takeaway
   the reader should leave with. If the material actually holds two unrelated ideas, that's two threads — say
   so rather than forcing them together.

3. **Write the hook (post 1).** The first post earns the rest. Lead with a concrete claim, number, or tension
   pulled straight from the material — the guard blocks vague hype and engagement-bait ("a 🧵 you NEED to
   read"), and readers scroll past it anyway. Substance is the hook. A light "here's how it went" at the end is
   fine to pull them down; bait is not.

4. **Break the body into beats — one idea per post.** Each body post makes a single point that stands on its
   own and advances the argument. No post should depend on the next one to finish a thought. Ground every claim
   in the material; don't invent a metric or a feature to make a beat punchier.

5. **Write the close (last post).** Land the takeaway in one line, then one clear CTA — follow, reply, try the
   thing, read the repo. One ask, concrete. No hashtag stuffing (the guard blocks it, and it reads as spam).

6. **Number and length-check every post.** Number them (`1/N`, `2/N`, … or your own convention). Each post
   ≤ 280 weighted chars — if one runs long, **split the idea into two beats** rather than truncating a
   sentence. Keep every post distinct; the guard blocks near-duplicates, so don't restate the same line twice.

7. **Show the full thread and get approval.** Present it as the numbered list, in order. Let the user edit,
   cut, reorder, or merge beats before anything is sent. Never post without showing them first.

8. **Ship it in order — sequence or queue.** Ask which the user wants:
   - **Post now as an ordered sequence** — call `post_now` for each post in order, 1…N, chained into a native
     thread: post 1 first, then pass its returned `platformPostId` as the next post's `inReplyToId`, and so on.
     Give each a stable `idempotencyKey` so a retry can't double-send, and set `aiGenerated` to the user's
     labelling choice (default off — the user decides). Each post passes casserole at send.
   - **Queue it** — call `create_loop` with `{ time, daysOfWeek (0=Sun..6=Sat), posts: [...], timezone }` to
     drip one post per fire, in order. A loop needs a **verified X account at least 30 days old** — if
     create_loop rejects it for that, explain the requirement instead of retrying.

9. **If a post comes back `blocked` or `held` mid-thread, stop.** Don't keep firing the rest on top of a gap —
   an ordered thread with a hole in it is broken. Show the reason, fix *that post's content* (be more specific,
   drop the bait, cut the hashtags or the duplicate line), get re-approval, then continue from where it stalled
   so the sequence stays coherent. Never route around the guard.

10. **Confirm.** For a live sequence, show what posted, in order. For a queue, call `list_loops` and show the
    loop, its schedule, and the queued posts.

**Hard rules:** you draft, casserole decides — fix the *content* on a block, never bypass the guard. One idea
per post, and every post honest — a thread only works if each beat is true and stands on its own.
