<!-- GENERATED from skills/ship-note/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->
# capx-ship-note

Turn a thing you just shipped — a merged PR or a tagged release — into an announcement post that tells people
what changed and why they should care. **You write the post** from the real diff and notes; capx never
generates content, it only ships (each post passes the casserole guardrail at send). What to announce, if
named: "$ARGUMENTS"

If the account isn't connected yet, run the `connect` skill first, then come back.

Follow these steps:

1. **Find the source.** From "$ARGUMENTS", identify the merged PR or release. If nothing's named, default to
   the most recent merge on this branch.
   - PR: `gh pr view <n-or-url> --json title,body,mergedAt,files,url` — and skim the actual change with
     `gh pr diff <n>` for anything non-obvious.
   - Release: `gh release view <tag> --json name,body,tagName,url`.
   - No `gh` / no URL? Fall back to `git log --oneline -10` and `git show <sha>` for the merge commit.
   Confirm it's actually **merged / published** — don't announce something still open or a draft tag.

2. **Extract the user-facing change.** Read past the internal churn (refactors, test scaffolding, bumps) to
   the *one thing a user or fellow dev actually gets*: a new capability, a fixed pain, a faster path, a
   breaking change they must act on. That — not the commit count — is the story.

3. **Draft the announcement.** Write ONE post (or a short thread if it genuinely needs it) that is:
   - **"We shipped X → here's what it means for you"** — lead with the change, then the payoff. "Merged
     streaming exports so a 2GB report downloads without timing out" beats "big PR landed today 🚀".
   - **Concrete and specific** — name the real feature, the real fix, the real before/after. The guardrail
     blocks vague hype, engagement-bait, hashtag-stuffing, and duplicates — specificity is what gets through
     *and* what people read.
   - **Grounded in the diff/notes** — do NOT invent features, numbers, benchmarks, or outcomes that aren't in
     the PR or release. If a claim isn't backed by what you read, cut it or ask.
   - **Honest about breaking changes** — if users must migrate or something's deprecated, say so plainly; that
     post is more valuable than the feature brag.
   - **In the user's voice** — if the `voice-match` skill is available, match it; otherwise mirror their
     recent posts, or ask. Link the PR/release only if the user wants it public.
   - **Within X's length** — one post ≤ 280 weighted chars; if the change needs setup + payoff + migration,
     make it a short thread and say so.

4. **Show the draft and get approval.** Present the post (or thread) as text the user can edit, trim, or
   reject. Never ship without showing them first.

5. **Now or scheduled?** Ask — or use what "$ARGUMENTS" already said. A ship-note is usually a **post now**
   moment; do that with `post_now`. If they'd rather line it up for a launch window, get local time (HH:MM),
   days, and timezone for `create_loop` instead.

6. **Ship it.**
   - Post now: `post_now { text }`. For a thread, post the lead first, then the follow-ups in order.
   - Scheduled: `create_loop { time, daysOfWeek (0=Sun..6=Sat), posts: [...], timezone }`. Note a loop needs a
     **verified X account at least 30 days old** — if create_loop rejects it for that, explain the requirement
     instead of retrying.

7. **Confirm.** Report the sent post's result, or call `list_loops` and show the queued announcement with its
   schedule.

**Hard rules:** you draft, casserole decides — if the post comes back `blocked` or `held`, show the reason and
fix the *content* (be more specific, drop the bait, dedupe against your last ship-note); never route around the
guard. And never fabricate what shipped — an announcement is only worth posting if it's true and already
merged.
