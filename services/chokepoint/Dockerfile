# capx chokepoint — ONE self-hostable image. Hosted-capx and self-hosters run the IDENTICAL image;
# the only difference is configuration (CAPX_DEPLOY_MODE + the env secrets). See docs/P1-CHOKEPOINT.md §8.
#
# TypeScript runs directly via --experimental-strip-types: no build step, no dist/, nothing to compile.
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

# EVERY workspace manifest must be present or `pnpm install --frozen-lockfile` rejects the lockfile
# (pnpm-workspace.yaml covers packages/*, services/*, apps/*). .dockerignore keeps host node_modules out.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY services/chokepoint ./services/chokepoint

# `@capx/chokepoint...` = the chokepoint plus its workspace deps only (not the MCP's deps).
RUN pnpm install --frozen-lockfile --filter @capx/chokepoint...

ENV NODE_ENV=production

# Cloud Run (and most PaaS) inject $PORT and route to it; serve.ts honours $PORT and falls back to
# CHOKEPOINT_PORT/4477 locally. EXPOSE is documentation only — the runtime port comes from the env.
EXPOSE 4477

CMD ["node", "--experimental-strip-types", "services/chokepoint/src/serve.ts"]
