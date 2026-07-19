---
name: video-director
description: "Direct the user's OWN video-gen tool to a short, X-native clip — hook in the first second, right aspect ratio, length norms — then upload + attach. capx generates nothing; it orchestrates your tool and ships the post guarded (caption only)."
argument-hint: "what the clip should show, and the post it goes with"
version: 0.1.0
tools: [upload_media, post_now]
---

Get a short, scroll-stopping video onto a post by driving the user's **own** connected video tool (higgsfield /
kling / fal / whatever they wired via `media-connect`). **capx generates nothing** — you use their tool, then
`upload_media` streams the file and `post_now` attaches it (X processes video before it's ready; the chokepoint
waits for that). casserole guards the **caption**, not the clip. The brief: "$ARGUMENTS"

Follow these steps:

1. **Check a video tool is connected.** No video-generation tool in the session → stop and send the user to
   **`media-connect`**. capx has nothing to generate with.

2. **Pin the job for X.** Short wins: aim for a **tight clip (a few to ~30s)**, a **hook in the first second**
   (X autoplays muted — the first frame + on-screen motion must earn the stop), and an aspect ratio that fits
   feed (**9:16** for vertical, **1:1** or **16:9** otherwise). Get the subject, mood, and any on-screen text
   from "$ARGUMENTS" and the post.

3. **Pick the model.** Use **`model-guide`** to choose the right video model for the look and length; they
   differ a lot on motion, coherence, and max duration.

4. **Engineer the prompt.** Use **`prompt-engine`** for a video-shaped prompt: subject + action, camera move,
   pacing, style, the opening beat, aspect ratio, duration. Show it before generating — video costs more than
   images, so get the prompt right first.

5. **Generate with THEIR tool.** Call the user's connected video tool. Review the result against the hook and
   length; iterate the prompt if the opening is weak or it runs long. Land on one clip the user approves.

6. **Disclose if it's AI-made.** AI-generated video especially should be disclosed. Offer to note it in the
   caption and/or set `aiGenerated` per the user's choice (Option C). capx carries the label; it doesn't decide.

7. **Upload and attach.** Call `upload_media` with the file path — for video the chokepoint uploads in chunks
   and waits for X to finish processing, then returns a media id. Then `post_now` with `{ text, mediaIds:
   [thatId] }` and a distinct `idempotencyKey`. Show the caption first; casserole gates the caption at send.

8. **Confirm.** Report the posted result, or the caption's guardrail verdict (fix the *caption*, never the guard).

**Hard rules:** capx never makes the video — the user's tool does; capx uploads + ships. Guard the caption,
keep the clip honest, and disclose AI generation.
