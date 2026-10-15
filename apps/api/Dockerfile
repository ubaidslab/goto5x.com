# Built with the repo root as build context (see docker-compose.yml) so pnpm
# workspace files are reachable. `dev` target is used locally
# (docker-compose.override.yml); `production` is what actually ships.

FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install
COPY apps/api/prisma apps/api/prisma
WORKDIR /repo/apps/api
RUN pnpm prisma:generate

FROM base AS dev
WORKDIR /repo
COPY apps/api apps/api
WORKDIR /repo/apps/api
CMD ["pnpm", "start:dev"]

FROM base AS build
WORKDIR /repo
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN pnpm build

# Security P0 (Risk #48, S12) - node:20-alpine already ships a non-root
# `node` user/group (uid/gid 1000); running as root in the shipped image
# was the one piece this control was still missing (Actions were already
# SHA-pinned, D94/A5). --chown on every COPY (not a separate `RUN chown
# -R`) so ownership is set as each layer is created, not fixed up after -
# cheaper and avoids a surprise if a later COPY re-roots a subtree.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/apps/api/package.json ./
COPY --from=build --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./prisma
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
