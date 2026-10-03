# License: The GPL version 3, or LGPL version 3 (Dual License).
# Build context: the repository root.
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
