---
description: "Turn a blog post, README, or long doc (a file path or URL) into an X thread. You (the agent) read it and write the posts; capx never generates — it ships them guarded. Post now or queue."
argument-hint: "a file path or URL to repurpose (blog post, README, changelog, or long doc)"
---
<!-- GENERATED from skills/repurpose/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Take one long piece — a blog post, README, changelog, or design doc — and turn it into an X thread. **You
read the source and write every post** from what it actually says; capx never generates content, it only
ships (each post clears the casserole guardrail at send). The thing to repurpose: "$ARGUMENTS"

Follow these steps:

1. **Read the actual source.** "$ARGUMENTS" is a file path or a URL. If it's a path, open the file; if it's a
   URL, fetch it with your web tool. Work from the **real text**, not the title or your memory of the topic.
   If you can't reach a URL, say so and ask the user to paste it or give a local path — don't guess at the
   contents.

2. **Pull the load-bearing points.** Find the **3–6 things that actually carry the piece** — the core claim,
   the key decision and why, the concrete result, the counterintuitive bit, the how. Skip the intro throat-
   clearing, SEO filler, and anything the source doesn't really commit to. If a point isn't supported by the
   text in front of you, it doesn't go in the thread.

3. **Shape the thread — hook + one post per point + close.**
   - **Hook (post 1):** lead with the single sharpest, most specific thing the reader gets — the result or
     the surprising claim. Not "🧵 a thread on X" and not vague hype; the guardrail blocks bait, and it reads
     as filler anyway. Make post 1 earn the scroll.
   - **Body (one post per point):** each post carries exactly one point, concrete and self-contained, in the
     source's own facts. Number them (`2/`, `3/`, …) so the sequence reads as a thread.
   - **Close (last post):** the takeaway, and — if the source is public — link back to the full piece.
   - **Grounded:** no invented features, numbers, or outcomes. If the doc says "cut p95 by ~30%," say that;
     don't round it into a bigger story. When unsure a claim is true to the source, cut it or ask.
   - **Within X's length:** each post ≤ 280 weighted chars.
   - **Voice:** if a voice profile exists (the `voice-match` skill), match it; else mirror the user's
     recent posts, or ask.

4. **Show the whole thread and get approval.** Present it as a numbered list, in order, so the user sees the
   arc. Let them edit, cut, reorder, or retitle the hook before anything ships. Never post without showing it.

5. **Pick the delivery — thread now, or drip queue.** Ask which the user wants (or use what "$ARGUMENTS"
   already said):
   - **Post the thread now** → call `post_now` once per post, **in order, first post first**. Set
     `aiGenerated: true` since you drafted the text, and pass a distinct `idempotencyKey` per post so a retry
     never double-ships. Keep the numbering so it reads as one thread.
   - **Drip it as a queue** → call `create_loop` with `{ time, daysOfWeek (0=Sun..6=Sat), posts: [...],
     timezone }` to release the points one-per-fire over a schedule instead of all at once. A loop needs a
     **verified X account at least 30 days old** — if create_loop rejects it for that, explain the requirement
     rather than retrying. Then `list_loops` to confirm.

6. **When a post comes back `blocked` or `held`, fix the content.** Casserole decides at send. Show the user
   the exact reason, then make that post more specific / drop the bait / de-duplicate it and resend — never
   try to route around the guard.

7. **Confirm.** Report what shipped: the posted thread (in order), or the created loop with its schedule and
   queued posts.

**Hard rules:** you write, casserole ships. Repurposing is compression, not invention — the thread must say
only what the source actually says. If the piece won't yield 3 solid points, tell the user it's better as a
single post than a padded thread.
