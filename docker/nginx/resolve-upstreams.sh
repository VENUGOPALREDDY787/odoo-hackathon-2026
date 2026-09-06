#!/bin/sh
# Resolves all IPs of a Docker service name and writes them into an nginx
# upstream template. Docker's embedded DNS returns only ONE ip for a service
# name, but the tasks.<service> DNS entry returns every replica — so we query
# it on boot (and on each refresh) to rebuild the upstream block.
#
# Usage: resolve-upstreams.sh <service-name> <template> <output> [port] [interval]
set -e

SERVICE="$1"
TEMPLATE="$2"
OUTPUT="$3"
PORT="${4:-3000}"
INTERVAL="${5:-5}"

if [ -z "$SERVICE" ] || [ -z "$TEMPLATE" ] || [ -z "$OUTPUT" ]; then
  echo "usage: resolve-upstreams.sh <service> <template> <output> [port] [interval|once]" >&2
  exit 1
fi

while true; do
  # `tasks.<service>` resolves to ALL healthy replica IPs of the service.
  RESOLVED=$(getent hosts "tasks.$SERVICE" | awk '{print $1}' | sort -u)

  if [ -n "$RESOLVED" ]; then
    SERVERS=$(echo "$RESOLVED" | awk -v port="$PORT" '{ printf "        server %s:%s;\n", $1, port }')
    TMP="$OUTPUT.tmp"
    awk -v servers="$SERVERS" '{ gsub(/__SERVERS__/, servers); print }' "$TEMPLATE" > "$TMP" && mv "$TMP" "$OUTPUT"
    if [ -f /var/run/nginx.pid ]; then
      # Only signal reload once the master is running (first pass happens pre-start).
      nginx -s reload 2>/dev/null || true
    fi
    echo "$(date -u +%FT%TZ) upstream refreshed: $(echo $RESOLVED | tr '\n' ' ')"
  else
    echo "$(date -u +%FT%TZ) WARN: no replicas resolved for tasks.$SERVICE yet" >&2
  fi

  if [ "$INTERVAL" = "once" ]; then
    exit 0
  fi
  sleep "$INTERVAL"
done
