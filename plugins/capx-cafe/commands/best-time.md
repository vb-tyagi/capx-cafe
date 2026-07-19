---
description: "Suggest good X post times — a v1 heuristic (audience timezone + known-good windows), honest it's not your data yet. Outputs slots you feed straight to create_loop."
argument-hint: "[optional: your audience's timezone/region, posts per week, or days you want to post]"
---
<!-- GENERATED from skills/best-time/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Recommend *when* to post on X and hand back concrete time slots the user can drop into `create_loop`. **Be
honest about what this is:** v1 is a heuristic — general rules of thumb for a tech/dev audience, not a
data-driven answer from the user's own post performance. capx doesn't measure their reach yet, so treat these
windows as a hypothesis to test, not a fact. User's extra intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Get the audience's clock.** Time-of-day only matters relative to where the *readers* are. Ask for the
   audience's timezone/region (or use "$ARGUMENTS"); if unknown, default to the connected account's own
   timezone via `whoami` and say that's what you assumed. If their followers are split (dev/B2B usually skews
   US + Europe), pick the timezone where most followers are — not where the user happens to sit.

2. **Say the honest part up front.** These are general priors, not "your best times." capx does not yet track
   the user's own post performance, so nothing here comes from their analytics. It's a sensible starting slot
   to try and then adjust from real results.

3. **Known-good windows (audience-local):**
   - Weekday mid-morning **~9:00–11:00** — people catching up at the desk / end of commute.
   - Around lunch **~12:00–13:00** — a scroll break.
   - Early evening **~17:00–18:00** — commute home / wind-down.
   Tue–Thu tend to beat Mon and Fri for dev/B2B content.

4. **Dead hours to avoid:**
   - Overnight in the audience timezone (**~22:00–06:00**) — the feed is asleep.
   - Late Friday afternoon through the weekend for B2B/developer content — reach usually drops. (Weekends are
     fine for lighter/personal posts, and later in the morning.)
   Don't push a slot into the dead zone just to hit a round number of posts.

5. **Turn windows into loop slots.** `create_loop` fires **once per day** at a single `time` on the
   `daysOfWeek` you give it. So a "slot" = one time-of-day + a day set. Pick a *specific minute* inside a good
   window (e.g. `09:30`, not "morning") and choose days (weekdays = `[1,2,3,4,5]`, 0=Sun..6=Sat). If they want
   two posts a day, that's **two loops** (e.g. one at 09:30, one at 12:30) — say so explicitly.

6. **Space things out.** Call `list_loops` and check what's already scheduled. Don't stack a new slot on top
   of an existing one — offset by an hour or more so posts don't fire on top of each other and the same window
   isn't overloaded.

7. **Present the slots.** Give a short numbered list, each slot as concrete, ready-to-use values: `time`
   (HH:MM), `daysOfWeek`, and `timezone` — the **audience** timezone, since that's what makes the fire time
   land where the readers are. Add a one-line reason per slot. Let the user adjust before anything is
   scheduled.

8. **Hand off.** If the user wants, call `create_loop` with the chosen slot(s) and their already-approved
   posts (`time`, `daysOfWeek`, `posts`, `timezone`) — otherwise just hand the values back for them to use in
   another skill (like `build-in-public` or `loop`). Note: a loop needs a **verified X account at least
   30 days old**; if `create_loop` rejects it for that, explain the requirement instead of retrying.

**Hard rules:** this is v1 and it's a guess, not gospel — the real best time is whatever the user's *own*
audience shows over a few weeks, so tell them to try a slot, watch what lands, and shift it. Never present
these windows as if they came from the user's analytics, and never cite engagement numbers you don't have.
capx never writes the posts and it doesn't invent a magic best time — you're picking a sensible starting slot
from public rules of thumb, and the content itself still passes the casserole guardrail at send.
