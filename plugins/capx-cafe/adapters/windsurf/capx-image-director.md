---
description: "Direct the user's OWN image-gen tool to a high-quality, on-brand image for a post: pick the model, engineer the prompt, generate, then upload + attach. capx runs no model — it orchestrates yours and ships the post guarded (caption only)."
---
<!-- GENERATED from skills/image-director/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Get a genuinely good image onto a post by driving the user's **own** connected image tool (higgsfield / fal /
kling / whatever they wired via `media-connect`). **capx generates nothing** — you use their tool to make the
image, then `upload_media` streams the file to the chokepoint and `post_now` attaches it. casserole guards the
**caption**; the image itself is not moderated, so honesty is on you and the user. The brief: "$ARGUMENTS"

Follow these steps:

1. **Check a media tool is connected.** If there's no image-generation tool in this session, stop and point
   the user at **`media-connect`** first — capx has nothing to generate with on its own.

2. **Pin the job.** From "$ARGUMENTS" and the post, get concrete: what must the image show, the mood, the
   aspect ratio (X favors 16:9 or 1:1 in-feed), any text/logo, and must-not-haves. If it's unclear, ask one
   sharp question rather than guessing.

3. **Pick the model.** Use **`model-guide`** to choose the right image model for the job (photoreal vs
   illustration vs product shot vs diagram). Different tools/models win at different things — pick deliberately.

4. **Engineer the prompt.** Use **`prompt-engine`** to turn the brief into a precise, model-shaped prompt
   (subject, style, lighting, composition, negatives, aspect ratio). Show the user the prompt before spending
   a generation.

5. **Generate with THEIR tool.** Call the user's connected image tool with that prompt. If the result misses,
   iterate the prompt (not the guard) — adjust and regenerate. Land on one image the user approves.

6. **Disclose if it's AI-made.** These images are AI-generated. Per X policy and the user's honesty, offer to
   note it — disclose in the caption and/or set `aiGenerated` on the post per the user's choice (Option C:
   their call). capx carries the label; it doesn't decide it for them.

7. **Upload and attach.** Call `upload_media` with the local file path → it returns a media id. Then draft/keep
   the caption and call `post_now` with `{ text, mediaIds: [thatId] }` (a distinct `idempotencyKey`). Show the
   user the caption first; casserole gates the caption text at send.

8. **Confirm.** Report the posted result (or the guardrail verdict on the caption, and fix the *caption* if
   held/blocked — never the guard).

**Hard rules:** capx never makes the image — the user's tool does; capx uploads + ships. The caption is
guarded; the media is the user's own and un-inspected, so keep it honest and disclose AI generation.
