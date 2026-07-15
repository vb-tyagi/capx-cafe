# capx-cafe — project guide (read this FIRST)

**capx-cafe** is the umbrella for the **agent-native track**: re-engineer the social-posting product into a
**Claude Code / Codex / Cursor plugin** (a portable MCP server) with a *minimal* login UI and **no central
user database** — a whitelisted user connects their **own** X account, then creates / schedules / manages
posts from inside their agent session. **Core decisions are LOCKED (2026-07-14)** — read the decision log in
`docs/STATE.md` §5 before building; do not re-litigate them.

This repo is the monorepo (formerly `capx-culture`, renamed). **Sibling repos:**
- `../capx-conductor` — the open **Postiz fork** (the posting engine). Its own repo, AGPL, Docker-based, runs separately.
- `../culture` — a **separate, independent product**. Do NOT touch it from here; it shares nothing at runtime.

## Read next
1. `docs/STATE.md` — full handoff: state, naming rotation, the open decisions, the fork's handling, risks.
2. `docs/PLUGIN-ARCHITECTURE.md` — the Track-2 direction (**Option B decided** — thin hosted chokepoint; all §8 items resolved).
3. `docs/PRODUCT-MAP.md` — the named products + boundaries.

## Naming (current — after the rotation)
- **`capx-cafe`** = this umbrella monorepo.
- **`@capx/captain`** = identity/whitelist engine (was `conductor`).
- **`capx-conductor`** = the Postiz fork / posting engine (was the folder `capx-cafe`).
- Unchanged packages: `casserole` (guardrail), `canteen` (loops), `counter` (credits), `chef` (content), `config`, `core`, `platform-client`.

## Dev
Node ≥ 22.6. `pnpm run verify` = AGPL boundary-guard + 64 unit tests + guard self-tests + typecheck (all green).
The fork runs from `../capx-conductor` (see `docs/GO-LIVE.md`); its Docker Compose project is pinned to `capx-cafe`.
