FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter @odyssey/web build

FROM nginx:1.29-alpine
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

