# Licensing — capx café

This repository is **dual-licensed by half**, per the locked decision in `docs/STATE.md` §5.9–5.10. Read this
before copying, redistributing, or self-hosting any part of it.

- **Root `LICENSE` is AGPL-3.0** — the repository as a network service is AGPL-3.0. The MIT-licensed
  components listed below are exceptions and carry their own `LICENSE` file + `license` field.

## MIT (permissive) — the client and everything it bundles, plus skills & docs

Copyright (c) 2026 Vaibhav Tyagi. Licensed under the MIT License (see each directory's `LICENSE`).

| Component | Path | Why MIT |
|---|---|---|
| The published client | `apps/capx-mcp` (npm: `capx-cafe`) | Max adoption; holds no credentials |
| Core types/constants | `packages/core` | **Bundled into the MIT client — a copyleft dep here is legally impossible** |
| Config resolver | `packages/config` | Bundled into the MIT client |
| Platform client seam | `packages/platform-client` | Bundled into the MIT client |
| Skills | `skills/` + generated `plugins/capx-cafe/` | Content/workflows, meant to be reused freely |
| Docs | `docs/` | Meant to be read and reused |

**Hard constraint:** `core`, `config`, and `platform-client` are inlined into the MIT `capx-cafe` bundle by
`apps/capx-mcp/build.mjs`, so they **must** stay permissive — they can never import an AGPL package.

## AGPL-3.0 (copyleft) — the server half / the moat

The hosted chokepoint and the server-only packages it compiles in. A network-service user must offer their
modified source. (The copyright holder is never bound by their own license — dual-licensing stays available to the holder.)

| Component | Path |
|---|---|
| The chokepoint service | `services/chokepoint` |
| casserole (the guardrail) | `packages/casserole` |
| captain (identity/allowlist) | `packages/captain` |
| counter (metering) | `packages/counter` |
| canteen (loops orchestrator) | `packages/canteen` |
| chef (AI-gen abstraction/mock) | `packages/chef` |

Full AGPL-3.0 text: root `LICENSE` (and each AGPL directory's `LICENSE`) — the verbatim GNU Affero General
Public License v3.0.

## Notes

- The project is operated by an individual developer (see `docs/legal/` for operator details); the
  copyright-holder line is being finalized to the individual's name.
- Trademark: the "capx café" name and logo are **not** granted by either license; they identify the Service
  and may not be used to imply endorsement or affiliation. No registration is claimed.
- Contributions are accepted under the project CLA (keeps relicensing possible).
