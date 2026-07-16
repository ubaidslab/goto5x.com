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

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/package.json ./
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
