#!/bin/sh
# frontend/nginx/40-runtime-config.sh: runtime configuration rendering at container start-up
#
# Description:
# Renders the browser-safe runtime configuration /config.json from the
# template using the container environment. It runs as part of the nginx
# entrypoint.
#
# A missing required value fails the start-up instead of serving a half
# configured application, and nothing secret is rendered.
#
# Author: id774 (More info: https://id774.net)
# Source Code: https://github.com/id774/spa-development-reference
# License: The GPL version 3, or LGPL version 3 (Dual License).
# Contact: idnanashi@gmail.com
#
# Usage:
#     Run by the nginx image entrypoint (/docker-entrypoint.d); not run by hand.
#
# Requirements:
# - POSIX sh and envsubst (provided by the nginx image)
#
# Version History:
# v1.0 2026-10-03
#      Initial release.

set -eu
: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID is required}"
: "${COGNITO_AUTHORIZATION_ENDPOINT:?COGNITO_AUTHORIZATION_ENDPOINT is required}"
: "${COGNITO_TOKEN_ENDPOINT:?COGNITO_TOKEN_ENDPOINT is required}"
: "${COGNITO_LOGOUT_ENDPOINT:?COGNITO_LOGOUT_ENDPOINT is required}"
: "${APP_REDIRECT_URI:?APP_REDIRECT_URI is required}"
: "${APP_POST_LOGOUT_URI:?APP_POST_LOGOUT_URI is required}"
envsubst '${COGNITO_CLIENT_ID} ${COGNITO_AUTHORIZATION_ENDPOINT} ${COGNITO_TOKEN_ENDPOINT} ${COGNITO_LOGOUT_ENDPOINT} ${APP_REDIRECT_URI} ${APP_POST_LOGOUT_URI}' \
  < /usr/share/nginx/html/config.json.template \
  > /usr/share/nginx/html/config.json
