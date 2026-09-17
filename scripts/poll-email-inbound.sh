#!/usr/bin/env bash
# Dispara manualmente un cron de correo contra el dev server local — en
# producción Vercel Cron los llama solo (ver vercel.json), pero next dev no
# ejecuta crons por su cuenta.
#
# Uso:
#   pnpm email:poll:imap              # email-inbound-imap-poll una vez
#   pnpm email:poll:imap:watch        # ídem, repite cada 30s (Ctrl+C para detener)
#   pnpm email:gmail-watch-renew      # gmail-watch-renew una vez (renovar watch + resync de respaldo)

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

CRON_PATH="${1:-email-inbound-imap-poll}"
INTERVAL_FLAG="${2:-}"

URL="${APP_URL:-http://localhost:3000}/api/cron/${CRON_PATH}"

run_once() {
  if [ -n "${CRON_SECRET:-}" ]; then
    curl -s -H "Authorization: Bearer ${CRON_SECRET}" "$URL"
  else
    curl -s "$URL"
  fi
  echo
}

if [ "$INTERVAL_FLAG" = "--watch" ]; then
  echo "Sondeando $URL cada 30s (Ctrl+C para detener)..."
  while true; do
    date "+[%H:%M:%S]"
    run_once
    sleep 30
  done
else
  run_once
fi
