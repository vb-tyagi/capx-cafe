---
name: media-connect
description: "Guide the user to connect their OWN media-generation MCP servers (higgsfield, fal, kling, ...) to their agent, so capx can attach the images/videos those tools produce. capx generates nothing — it orchestrates your tools and ships the result."
argument-hint: "[optional: which tool — higgsfield / fal / kling — or 'what are my options']"
version: 0.1.0
tools: []
---

Help the user wire up their **own** image/video generation into the agent, so the capx director skills can
drive it and then attach the output to a post. **capx runs no models and integrates no provider** — you use
whatever media tools *you* connect; capx only uploads the finished asset and ships the post (the caption is
guarded by casserole; the media is not). User's steer, if any: "$ARGUMENTS"

Follow these steps:

1. **Explain the split, briefly.** capx = the guarded pipe to X. Media *generation* is a separate tool the
   user brings — an MCP server like **higgsfield**, **fal**, or **kling** (or any image/video MCP). Once it's
   connected to the same agent, the director skills (`image-director`, `video-director`) can call it, and
   `upload_media` attaches the result. Nothing about the user's media tool touches capx's servers.

2. **Point at the connection method for their agent.** Connecting an MCP server is per-agent:
   - **Claude Code** — add it to `.mcp.json` (or `claude mcp add`); it appears as tools next to capx.
   - **Cursor** — add it under MCP settings / `.cursor/mcp.json`.
   - **Codex / Windsurf / others** — add it to that agent's MCP config file.
   Have the user follow their provider's install snippet (higgsfield/fal/kling each publish one). Don't paste
   the user's API keys yourself — they go in that tool's own config, on the user's machine.

3. **Confirm it's live.** Ask the user to confirm the media tool's tools now show up in this session (e.g. an
   image-generate or video-generate tool). If they don't, it's a config/restart issue on the media tool's
   side — point them back to that provider's setup, not capx.

4. **Hand off.** Once a media tool is connected, point the user at **`image-director`** or **`video-director`**
   to actually make something, and **`model-guide`** to choose which model fits the job.

**Hard rules:** capx never generates media and never sees the user's media-tool keys. This skill only helps
connect *their* tools; the making happens in those tools, and capx attaches + ships the result.
