---
name: voice-match
description: Learn the developer's own X voice from their recent posts — tone, length, emoji/hashtag habits, rhythm — so other capx skills draft in it. A read-only look at their own timeline; capx never writes.
argument-hint: "[optional: how many posts to sample, or paste a few if capx can't read them]"
version: 0.1.0
tools: [whoami]
---

Build a reusable **voice profile** from the developer's *own* recent X posts so other capx skills
(`build-in-public`, `thread-builder`, …) draft in their actual voice. capx never generates a voice — this only
**reads** what the user already wrote and characterizes it. It's a **READ of your own timeline only** — nothing
is posted, scheduled, or edited here. User's extra intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Confirm the connection and get the handle.** Call `whoami`. If `connected` is false, stop and point the
   user at the `connect` skill — you can't profile a voice with no account. Otherwise note `username` —
   that's whose voice you're profiling. Reading your own recent posts sits **inside the `tweet.read` scope you
   already granted at connect**, so there's no new consent screen.

2. **Pull the corpus.** Read the user's recent authored posts — aim for **20–30**, or the count named in
   "$ARGUMENTS". These come from your own timeline under that already-granted `tweet.read` scope. Skip pure
   retweets and bare one-word replies; you want *their* writing. **If the running capx build doesn't surface a
   posts read, do not guess** — ask the user to paste 15–30 recent posts (or point at their `@handle`). A voice
   profile built from nothing is a fabrication, and capx doesn't fabricate.

3. **Extract the signal.** From the real posts, characterize each trait and **pin a real example to every one**:
   - **Tone & register** — casual / technical / dry / playful; first-person "I" vs "we"; how they frame wins vs
     problems.
   - **Length & shape** — typical char count; one-liners vs multi-line; singles vs threads; where they break lines.
   - **Emoji habits** — which ones, how many, where — or never.
   - **Hashtags & mentions** — do they use hashtags at all, how many, or none.
   - **Punctuation & casing** — all-lowercase? em dashes? ellipses? Oxford commas?
   - **Openers & rhythm** — how a post usually starts (a claim, a number, a question) and its cadence.
   - **Vocabulary tics** — recurring phrases, how they name things, jargon level.
   Ground every observation in a post you actually read. **Don't invent a trait you can't point to.**

4. **Summarize the profile.** Present it tight and skimmable — one line per trait, each with a real quoted
   example — then a 2–3 line **"voice in a nutshell"** the other skills can apply directly. Keep it concrete:
   "1–2 lines, lowercase, no emoji, opens with the thing shipped" beats "casual and authentic".

5. **Confirm and keep it for the session.** Show the profile and ask the user to correct anything that feels
   off — they know their voice better than any sample. Once they're happy, **hold the profile in this working
   session** so `build-in-public` and other draft-skills match it; if they want it to persist, save it to a file
   they name. It's a session snapshot — re-run this skill to refresh after their style drifts.

**Hard rules:** This skill is **read-only** — it never posts, schedules, or edits; it reads your own timeline and
describes it. Every trait must trace to a real post — if the sample's too thin to be sure, say so and ask for
more rather than guessing. And matching a voice is **not** a licence to bypass the guard: when another skill
drafts in this profile, casserole still gates at send — sounding like the user never means vague hype, bait, or
hashtag-stuffing gets through.
