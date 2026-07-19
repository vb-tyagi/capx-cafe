<!-- GENERATED from skills/draft-review/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->
# capx-draft-review

Check a draft against the casserole guardrail **before** posting or scheduling it — a linter, not a send.
`preview` runs the exact same admission + guardrail a real post would, but sends nothing, records nothing, and
never touches the token. Use it to catch a block or a hold early and fix the wording. Draft / intent: "$ARGUMENTS"

Follow these steps:

1. **Get the draft.** Take the text from "$ARGUMENTS", or the post you just wrote with the user. If there are
   several (a thread), preview them one at a time.

2. **Preview it.** Call `preview` with `{ text }` (add `aiGenerated` only if the user wants it labelled
   AI-assisted — their choice, default off; it doesn't change a text verdict). Read the result back plainly:
   - **Would post ✓** — it passes; you can `post_now` or `create_loop` it as-is.
   - **Would be held** — casserole would hold it for human review; show the reasons.
   - **Would be blocked / rewritten** — it would not go as-is; show exactly why.

3. **Fix the content, not the guard.** If it wouldn't pass, work the *words* with the user — be more specific,
   drop vague hype or engagement-bait, cut hashtag stuffing, de-duplicate against a near-identical past post.
   Then preview again. Never try to route around the guard: `preview` runs the same rules as the real gate at
   send, so a draft that previews clean is exactly the one that ships.

4. **Hand off.** Once it previews clean, offer to post it now (`post_now`) or queue it (`create_loop`), or hand
   back to whichever skill asked for the review.

**Hard rules:** `preview` never posts and is never a way to bypass the guard — it just shows the verdict early.
The fix for a block is always the content. capx writes nothing; you draft, casserole decides.
