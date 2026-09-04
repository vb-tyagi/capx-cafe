# Docker MCP Toolkit — custom catalog

capx café ships to Docker Desktop's **MCP Toolkit** through a *custom catalog*, not through
`docker/mcp-registry`.

## Why not the official Docker registry

Two independent reasons, both verified 2026-09-04:

1. **An automated licence gate rejects us.** `internal/licenses/check.go` in `docker/mcp-registry`
   hard-fails any project whose GitHub licence key starts with `gpl`/`agpl`/`npl`. GitHub reports this
   repo as `agpl-3.0` (it reads the ROOT `LICENSE` only and never recurses into subdirectories), so CI
   fails deterministically — even though the containerised artifact is 100% MIT. `source.directory`
   does not help: the check reads `source.project`, not the subdirectory. There is no `license` field in
   `server.yaml` to override it, and `source.upstream` is checked too.
2. **The registry is effectively frozen.** Last new server merged to `main`: 2026-04-30, against ~1,040
   open PRs. A flawless MIT submission today has the same expected outcome as an AGPL one.

Deliberately NOT done: re-rooting the LICENSE to MIT (would make the badge over-permissive and weaken
AGPL protection on the chokepoint moat), and deleting the root LICENSE to slip past the `license != nil`
guard (licence laundering).

**Revisit trigger:** if new servers start merging to `docker/mcp-registry` again, split
`apps/capx-mcp` + `packages/{core,config,platform-client}` into a standalone MIT-rooted repo and submit
that with **no `upstream` field** — the `grafana/mcp-grafana` pattern (Apache-2.0 client catalogued while
AGPL Grafana is not).

## Build and publish

```sh
# 1. build the client image (installs the published npm package — MIT only)
docker build -t capx-cafe:0.1.3 -f Dockerfile .

# 2. verify it speaks MCP over stdio with no configuration
#    (expect serverInfo capx-cafe 0.1.3 and 11 tools)

# 3. create the catalog
docker mcp catalog create vb-tyagi/capx-catalog:latest --title "capx café" \
  --server file://./tools/docker-catalog/capx-cafe.yaml

# 4. publish (needs a registry login; push the IMAGE first, then the catalog)
docker tag capx-cafe:0.1.3 <registry>/capx-cafe:0.1.3
docker push <registry>/capx-cafe:0.1.3
docker mcp catalog push <registry>/capx-catalog:latest
```

Bump the image tag in `capx-cafe.yaml` with each npm release.

## What users run

```sh
docker mcp catalog pull <registry>/capx-catalog:latest
```

Then Docker Desktop → **MCP Toolkit** → Catalog → the imported catalog → enable **capx café**.
