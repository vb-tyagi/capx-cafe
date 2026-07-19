---
name: audit-trail
description: Show everything capx has posted or attempted on your behalf — most recent first, with delivery state and the AI-assist label. A read-only trust view of your own connected handle.
argument-hint: "[optional: how many to show, e.g. 'last 20']"
version: 0.1.0
tools: [audit, post_now]
---

Show the user a straight, honest record of what capx has actually done on their behalf: every post it sent or
attempted, newest first, with the delivery state and whether it was labelled AI-assisted. This is a **trust**
feature — read-only, the user's own connected handle only, and it cannot post anything. User's ask, if any: "$ARGUMENTS"

Follow these steps:

1. **Read the trail.** Call `audit` (pass `limit` if the user asked for a specific count, e.g. 20; default is
   the most recent 50). It returns the durable send history for the connected account.

2. **Show it clearly.** Present the entries as a readable list — for each: when, the delivery state
   (`SENT` / `SENDING` / `PENDING` / `PUBLISH_FAILED`), a snippet of the text, and an AI-assisted tag if it was
   labelled. If there's nothing yet, say so plainly.

3. **Explain what it does and doesn't cover.** Be honest: this is the record of what capx **sent or tried to
   send**. A post the guardrail **blocked or held never went out** — those verdicts are shown live at post time
   (or via the `draft-review` skill), not stored here. So a short trail means little has been posted, not that
   anything was hidden.

4. **Offer the next step.** If the user is checking on a failed send (`PUBLISH_FAILED`), offer to re-post that
   text with a fresh `post_now` — capx's idempotency means a genuine retry won't double-post.

**Hard rules:** `audit` is read-only and scoped to the caller's own handle — it can't see anyone else's posts
and can't send anything. It exists so the user can always verify, in their own words, exactly what capx did.
