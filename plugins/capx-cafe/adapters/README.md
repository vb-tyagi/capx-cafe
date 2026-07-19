# capx café — skills for every agent

capx skills are one canonical workflow per skill (`skills/<name>/SKILL.md` in the repo), generated into each
agent's native format by `pnpm gen:skills`. **Don't hand-edit these files — edit the source `SKILL.md` and
regenerate.**

Invocation name is consistent for muscle memory: **`capx-<skill>`** (e.g. `capx-build-in-public`).

## Install per agent

**Claude Code** — nothing to do. The skills ship inside the plugin (`plugins/capx-cafe/commands/`); install the
plugin (`/plugin install capx-cafe@capx-cafe`) and invoke `/capx-cafe:<skill>`.

**Cursor** — copy the rules into your project (or `~/.cursor/rules/`):
```
cp plugins/capx-cafe/adapters/cursor/*.mdc  <your-project>/.cursor/rules/
```
They're description-triggered; Cursor's agent picks them up by intent, or reference one with `@capx-<skill>`.

**Codex** — copy the prompts into your Codex prompts dir:
```
cp plugins/capx-cafe/adapters/codex/*.md  ~/.codex/prompts/
```
Invoke as `/capx-<skill>`.

**Windsurf** — copy the workflows into your project:
```
cp plugins/capx-cafe/adapters/windsurf/*.md  <your-project>/.windsurf/workflows/
```
Invoke as `/capx-<skill>`.

**Any other MCP agent** — the capx MCP tools (`post_now`, `create_loop`, …) work everywhere; the skill body
in each file is plain instructions you can paste into that agent's custom-command mechanism.

## Prerequisite
All skills call the `capx` MCP server — install it first (see the plugin README) and connect your X account
with `capx-connect`.
