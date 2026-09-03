# capx café — the MCP CLIENT image (the `capx-cafe` npm binary): for directory introspection (Glama builds
# this to run initialize + tools/list) and for running the client anywhere. The SERVER (chokepoint) image lives
# at services/chokepoint/Dockerfile.
FROM node:22-alpine

# Pin bumps with each release — keep in step with apps/capx-mcp/package.json + server.json.
RUN npm install -g capx-cafe@0.1.3

# No env vars are needed to START: the server boots and answers initialize / tools/list unconfigured. Only a
# tool call needs CAPX_CHOKEPOINT_URL + CAPX_EMAIL (pass them with `docker run -e ...` for real use).
ENTRYPOINT ["capx-cafe"]
