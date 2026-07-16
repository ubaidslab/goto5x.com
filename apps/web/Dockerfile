# Built with the repo root as build context (see docker-compose.yml).

FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS dev
WORKDIR /repo
COPY apps/web apps/web
WORKDIR /repo/apps/web
CMD ["pnpm", "dev"]

FROM base AS build
WORKDIR /repo
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/package.json ./
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
