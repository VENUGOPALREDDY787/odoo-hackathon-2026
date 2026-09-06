#!/bin/sh
# nginx LB entrypoint:
#  1. writes the initial backend upstream from tasks.backend DNS
#  2. starts the resolver refresh loop in background (picks up scaled replicas)
#  3. execs nginx in the foreground
set -e

TEMPLATE=/etc/nginx/templates/backend.conf.template
OUTPUT=/etc/nginx/conf.d/backend.conf
PORT="${BACKEND_PORT:-3000}"
INTERVAL="${RESOLVE_INTERVAL:-5}"

# Render the static site config (frontend + socket.io routing).
envsubst '${BACKEND_SERVICE} ${BACKEND_PORT}' \
  < /etc/nginx/templates/site.conf.template \
  > /etc/nginx/conf.d/site.conf 2>/dev/null \
  || cp /etc/nginx/templates/site.conf.template /etc/nginx/conf.d/site.conf

# Block until at least one backend replica exists so nginx can start cleanly.
until getent hosts "tasks.${BACKEND_SERVICE:-backend}" | grep -q .; do
  echo "waiting for ${BACKEND_SERVICE:-backend} replicas..."
  sleep 1
done

# First render synchronously so the upstream exists before nginx starts.
/app/resolve-upstreams.sh "${BACKEND_SERVICE:-backend}" "$TEMPLATE" "$OUTPUT" "$PORT" once

# Then refresh in the background to pick up scale-up/scale-down events.
/app/resolve-upstreams.sh "${BACKEND_SERVICE:-backend}" "$TEMPLATE" "$OUTPUT" "$PORT" "$INTERVAL" &
echo $! > /var/run/resolver.pid

exec nginx -g "daemon off;"
