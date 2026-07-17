---
description: "Post to X now via capx (guardrailed). Usage: /capx-cafe:post <your message>"
argument-hint: <the text to post>
---

Post the following text to X using the capx `post_now` MCP tool:

"$ARGUMENTS"

Rules:
- Pass the text **exactly** as the user wrote it. Do not embellish, shorten, or add hashtags.
- Set `aiGenerated: true` only if YOU wrote or materially edited the text; set it `false` when the user supplied it verbatim.
- After posting, report the outcome the tool returns (published / blocked / held / needs re-auth). If it was **blocked or held**, show the guardrail's reasons plainly and do NOT retry with altered text unless the user explicitly asks — the guardrail is intentional.
- If the user hasn't connected an account yet, tell them to run `/capx-cafe:connect` first.
