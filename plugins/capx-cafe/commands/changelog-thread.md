---
description: "Turn a commit range or version bump into a 'what shipped in vX' X thread — you (the agent) read the range and write each post; capx never writes, it ships them guarded."
argument-hint: "[optional: a range like v1.2.0..HEAD, a version/tag, or 'since last tag']"
---
<!-- GENERATED from skills/changelog-thread/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Turn a release into a "what shipped in vX" X thread — a hook post plus one post per notable change. **You
read the range and write every post** from the real diff; capx never generates content, it only ships (each
post passes the casserole guardrail at send). User's range / intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Resolve the range.** From "$ARGUMENTS": if it's a range (`v1.2.0..HEAD`, `abc123..def456`), use it as-is;
   if it's a version or tag, use `<previous-tag>..<that-tag>` (find the prior tag with
   `git describe --tags --abbrev=0 <tag>^`); if it's empty, default to since the last release:
   `git log $(git describe --tags --abbrev=0)..HEAD`. Confirm the **version label** the thread will announce —
   and only use a real one (an actual tag or bump). Never invent a version number.

2. **Read the real work.** Run `git log --oneline <range>` and skim the diffs of the substantive commits.
   **Skip the noise** — merges, `wip`, formatting, dependency bumps, internal refactors with no user-visible
   effect. You want what a user or downstream dev would actually notice.

3. **Group by user-facing change.** Cluster the commits into a handful of notable items: new features, fixed
   behavior, breaking changes, performance wins, new config/flags. Ten commits behind one feature = one item,
   not ten. Internal churn gets no post.

4. **Draft the thread.** Write it as an ordered sequence:
   - **Post 1 is the hook** — lead with the single most compelling shipped thing (or the version headline).
     Concrete beats "big update is here!". This is the tweet that earns the scroll.
   - **One post per notable item** after it. Each is: **concrete and specific** (name the actual change and
     what it lets someone do — the guard blocks vague hype, engagement-bait, hashtag-stuffing, and
     duplicates); **grounded in the diff** (do not invent features, numbers, or outcomes — if a commit didn't
     land it, it isn't in the thread); **flagged if breaking** (say so plainly, with the migration line if the
     diff shows one); **in the user's voice** (match the `voice-match` profile if present, else mirror
     their recent posts or ask); and **≤ 280 weighted chars** each.
   - Optional closing post with a real upgrade/install line (`npm i pkg@1.3.0`, a link) — only if it's true.

5. **Show the thread and get approval.** Present it as a numbered list in reading order. Let the user edit,
   cut, reorder, or drop the version label before anything ships. Never post without showing them first.

6. **Ship it — post now or queue.** Ask which the user wants:
   - **Thread it now** (default): call `post_now` for each post **in order**, hook first, so they land as a
     sequence. Pass a distinct `idempotencyKey` per post so a retry can't double-send. capx ships each post
     individually through the guard — it does not stitch a reply chain for you, so send them close together.
   - **Queue it** (drip on a schedule): call `create_loop` with
     `{ time, daysOfWeek (0=Sun..6=Sat), posts: [...in order], timezone }` — one post per fire. A loop needs a
     **verified X account at least 30 days old**; if create_loop rejects it for that, explain the requirement
     instead of retrying.

7. **Confirm.** For a live thread, confirm each post went through and stop if one is `blocked`/`held`. For a
   queue, call `list_loops` and show the loop, its schedule, and the queued posts.

**Hard rules:** you draft, casserole decides — if a post comes back `blocked` or `held`, show the reason and
fix the *content* of that post (be more specific, drop the bait, split it), never route around the guard. And
the changelog must match the diff: every claim traces to a real commit, every number is one you can point to,
the version is one that actually exists. A "what shipped" thread only works if it all shipped.
