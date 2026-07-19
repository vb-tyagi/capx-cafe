---
description: "Reshape a draft you already wrote — long post to a thread, a thread to one tight post, or fit it to X's norms. You reshape; the meaning stays; capx ships it guarded."
---
<!-- GENERATED from skills/reformat/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Reshape a draft the user already wrote into a better shape for X — a long post into a thread, a thread into
one tight post, or any draft trimmed to X's length and format norms. **You do the reshaping** by moving the
user's own words around; capx never generates content and this skill never rewrites the substance. The one
rule under everything: **meaning in must equal meaning out.** Each post still passes the casserole guardrail
at send. What the user gave you: "$ARGUMENTS"

Follow these steps:

1. **Get the draft and the target shape.** From "$ARGUMENTS", take the draft — the pasted text, or read the
   file / link they pointed at. Identify the target shape: long post → thread, thread → single post, or "fit
   to X." If they didn't say, infer the obvious move from length (a 600-char block wants to be a thread; a
   5-tweet thread they want tightened wants to be one post) and **confirm before reshaping**.

2. **Read what's actually there.** Understand the point, the claims, and the voice. List the **load-bearing
   bits you must not lose** — every concrete fact, number, name, and specific. You're rearranging and
   trimming, not rewriting; if you can't keep a specific in the new shape, that's a conversation, not a cut
   you make silently.

3. **Reshape.** Do the transform the shape calls for:
   - **Long → thread:** split at natural seams, one idea per tweet. The lead tweet earns the read with the
     sharpest concrete point — *not* "a thread 🧵" bait. Each tweet stands on its own and is ≤ 280 weighted
     chars. Number them 1/n.
   - **Thread → single:** keep the single strongest idea, cut the throat-clearing and the connective filler
     between tweets, land it in ≤ 280 weighted chars.
   - **Fit to X:** trim to ≤ 280 weighted, unpack link/hashtag clutter, and strip the vague hype and
     engagement-bait — the guard blocks those anyway, so this is what actually gets it through.
   Across all three: **do not add a feature, number, or claim the draft didn't make**, and don't sand off the
   specifics — specificity is what passes the guard *and* what people read. Keep the user's voice.

4. **Show before / after.** Present the original and the reshaped version clearly labeled (a numbered list for
   a thread). Call out exactly what you changed and why — what you split, cut, or tightened — and confirm in
   one line that the meaning is unchanged. Never hand back or post a version they haven't seen.

5. **Get approval or edits.** Let the user edit, reorder, cut, or reject. If they want a different shape, go
   back to step 3. Nothing ships until they say so.

6. **Hand back or post.** Default: hand the approved text back for them to use.
   - **Single post, live now:** call `post_now { text }` — casserole guards it at send.
   - **Thread, live as a reply-chain:** hand back the numbered tweets for the user to publish (capx ships
     single posts, not reply-chains — don't pretend otherwise). If they'd rather the tweets go out as
     standalone posts dripped over days, schedule them with `create_loop { time, daysOfWeek (0=Sun..6=Sat),
     posts: [...], timezone }` — note a loop needs a **verified X account at least 30 days old**; if it's
     rejected for that, explain the requirement instead of retrying.
   - Not connected yet? Run the `connect` skill first, then continue.

7. **If the guard holds or blocks it.** Show the exact reason and **fix the content** — tighten it, drop the
   bait, cut the duplicate, restore a specific — then send again. Never route around the guard, and never
   re-send the same text to dodge a duplicate flag.

**Hard rules:** you reshape, you don't rewrite — the meaning that goes in is the meaning that comes out, and
you never invent a claim the draft didn't make. casserole decides at send; when it says no, fix the content,
never the guard.
