# Production image for Railway: one service serves the web app, API and MCP on one origin.
# bookworm-slim, not Alpine: the DuckDB native binary needs glibc.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Node 22 images may ship a newer npm 10. npm 10.9.9+ crashes in Arborist during
# `mastra build`'s isolated .mastra/output install:
# Cannot read properties of null (reading 'edgesOut').
# Emergency Railway image used these two lines before the app builds.
RUN npm install -g npm@10.9.2
ENV npm_config_legacy_peer_deps=true
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN npm ci
COPY . .
RUN npm run build --workspace=apps/web && npm run build --workspace=apps/api

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV MASTRA_HOST=0.0.0.0
# node_modules stays: tsx runs migrate, seed, users:create and rules:refresh from source.
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4111
# Migrations and the official-list seed are idempotent and need the volume, which
# Railway mounts only at runtime, so they run here and not in a pre-deploy step.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed:official && exec node .mastra/output/index.mjs"]
