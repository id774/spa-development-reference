# backend/Dockerfile: container image of the backend
#
# Description:
# Builds the backend image in two stages: a build stage that installs the
# workspaces and compiles the backend, and a runtime stage that installs only
# the production dependencies of the backend workspace and runs as the
# non-root node user.
#
# The build context is the repository root. Normal startup never runs
# migrations; they use the separate migrate:deploy command. The container
# listens on port 3000.
#
# Author: id774 (More info: https://id774.net)
# Source Code: https://github.com/id774/spa-reference
# License: The GPL version 3, or LGPL version 3 (Dual License).
# Contact: idnanashi@gmail.com
#
# Build / Run:
#     docker build -f backend/Dockerfile .
#
# Requirements:
# - Docker
# - Build context: the repository root
#
# Version History:
# v1.0 2026-10-03
#      Initial release.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY infra/package.json infra/
RUN npm ci
COPY backend backend
# Generates the Prisma client and compiles TypeScript.
RUN npm run build -w @spa-ref/backend

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY infra/package.json infra/
RUN npm ci --omit=dev --workspace @spa-ref/backend --include-workspace-root=false \
  && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
USER node
EXPOSE 3000
# Normal startup never runs migrations; they use the separate `migrate:deploy` command.
CMD ["node", "backend/dist/main.js"]
