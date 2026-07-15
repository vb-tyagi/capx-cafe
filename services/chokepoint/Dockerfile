# capx chokepoint — ONE self-hostable image (hosted-capx and self-hosters run the identical image;
# the only difference is configuration — CAPX_DEPLOY_MODE + the env secrets). See docs/P1-CHOKEPOINT.md §8.
#
# S0 scaffold: the build steps are intentionally minimal until the service has real entrypoints (S3+).
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# Monorepo-aware install: copy the workspace manifests, then the sources.
# (Filled in properly at S3/S4 when the service actually boots.)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY services/chokepoint ./services/chokepoint
RUN pnpm install --frozen-lockfile --filter @capx/chokepoint...

EXPOSE 4477
# S3/S4: replace with the real server entrypoint.
CMD ["node", "--experimental-strip-types", "services/chokepoint/src/server.ts"]
