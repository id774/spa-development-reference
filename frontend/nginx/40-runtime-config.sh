#!/bin/sh
# License: The GPL version 3, or LGPL version 3 (Dual License).
# Renders the browser-safe runtime configuration. A missing value fails the start-up.
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
