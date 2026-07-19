---
name: til
description: Turn the one non-obvious thing you learned this session into a single sharp TIL post. You (the agent) write it from real session context; capx never writes, it ships it guarded.
argument-hint: "[optional: the lesson, or a hint like 'the caching bug' or 'keep it dry']"
version: 0.1.0
tools: [post_now, whoami]
---

Turn the genuinely non-obvious thing learned **this session** into ONE punchy "Today I learned" post for X.
**You write it** from the real work you and the user just did — capx never generates content; it only ships
(the post passes the casserole guardrail at send). User's steer, if any: "$ARGUMENTS"

Follow these steps:

1. **Mine the session for the real lesson.** Look back over what you actually did together this session — the
   bug that wasn't where you thought it was, the API that behaved differently than the docs implied, the
   one-liner that replaced twenty, the assumption that turned out wrong. If "$ARGUMENTS" names the lesson, use
   it. You're hunting for the **non-obvious** thing — the fact someone would screenshot, not "I wrote some
   code today."

2. **Apply the TIL bar.** Keep the candidate only if it passes all three:
   - **Genuinely useful** — a stranger doing similar work would be glad they read it. If it's obvious to
     anyone in the field, it's not a TIL.
   - **Not a humblebrag** — the value is the lesson, not "look how hard the thing I shipped was." Lead with
     what *you learned*, not what you built.
   - **Real** — it actually happened this session. Do NOT invent a lesson, a number, or a gotcha that didn't
     occur. If nothing this session clears the bar, say so and stop — don't manufacture one.

3. **Draft ONE post.** Write a single post that:
   - **States the concrete lesson** — the specific fact, tool, flag, or behavior. "TIL Postgres `NULL` breaks
     `NOT IN` because `x NOT IN (1, NULL)` is never true" beats "TIL SQL has gotchas." Specificity is what
     gets read *and* what clears the guard (it blocks vague hype, engagement-bait, hashtag-stuffing,
     duplicates).
   - **Earns the surprise** — one line of *why* it was non-obvious or what you'd have gotten wrong. That's the
     part people keep.
   - **Is self-contained** — no "as I mentioned earlier," no missing context. A reader with zero session
     history should get the whole insight.
   - **In the user's voice** — if the `voice-match` skill or a voice profile is available, match it;
     otherwise mirror the user's recent posts, or ask.
   - **Fits one post** — ≤ 280 weighted chars. A TIL is a single shot, not a thread; if it needs a thread it's
     probably two separate lessons — pick the sharper one.

4. **Show it and get approval.** Present the draft. Let the user tighten, swap the lesson, or kill it. Never
   post without showing them first.

5. **Ship it.** On approval, call `post_now` with `{ text }`. Ask whether to label it AI-assisted and set
   `aiGenerated` to the user's choice (default off — it's their call). Pass an `idempotencyKey` so a retry
   can't double-post.

6. **Handle the guard honestly.** If `post_now` comes back `blocked` or `held`, show the reason and fix the
   **content** — make the lesson more concrete, cut the bait, dedupe against a near-identical past post. Never
   try to route around the guard. On success, confirm it's live (`whoami` if you need the handle).

**Hard rules:** you draft, casserole decides. A TIL is only worth posting if it's true and non-obvious — never
fabricate the lesson, and never dress up an ordinary task as a revelation. One real insight beats ten
manufactured ones.
