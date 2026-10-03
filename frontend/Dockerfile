# frontend/Dockerfile: container image of the frontend
#
# Description:
# Builds the SPA and serves it with an unprivileged nginx image. The runtime
# configuration is rendered at start-up by frontend/nginx/40-runtime-config.sh
# as the non-root user, so one image serves every environment.
#
# The build context is the repository root. The container listens on port
# 8080.
#
# Author: id774 (More info: https://id774.net)
# Source Code: https://github.com/id774/spa-reference
# License: The GPL version 3, or LGPL version 3 (Dual License).
# Contact: idnanashi@gmail.com
#
# Build / Run:
#     docker build -f frontend/Dockerfile .
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
COPY packages packages
COPY frontend frontend
RUN npm run build -w @spa-ref/frontend

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
USER root
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY frontend/nginx/config.json.template /usr/share/nginx/html/config.json.template
COPY frontend/nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
# The runtime configuration is rendered at start-up as the non-root user.
RUN chmod 0755 /docker-entrypoint.d/40-runtime-config.sh \
  && rm -f /usr/share/nginx/html/config.json \
  && chown -R 101:0 /usr/share/nginx/html \
  && chmod -R g+w /usr/share/nginx/html
USER 101
EXPOSE 8080
