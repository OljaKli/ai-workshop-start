#!/usr/bin/env bash
# Air cloud environment startup: dependencies, headless Chromium for the browser tests,
# and the Skill Atlas web client (./skill-atlas serve) on port 3000.
set -euo pipefail

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi

cd "$(dirname "$0")/../.."
REPO="$(pwd)"
PORT=3000
SERVER_LOG=/tmp/skill-atlas-serve.log

log() { echo "[startup] $*"; }

# Node >= 24 (package.json engines); the base image ships it.
log "node $(node -v), npm $(npm -v)"
major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 24 ]; then
  log "ERROR: Node >= 24 is required, found $(node -v)"
  exit 1
fi

log "npm ci ..."
npm ci --no-audit --no-fund
log "npm ci done"

# Chromium for `npm run test:browser` (no sudo: the image already has the system libraries).
log "installing Playwright chromium-headless-shell ..."
npx playwright install chromium-headless-shell
log "Playwright browser installed"

# The web client, in the background; it listens on all interfaces and accepts any Host.
if curl -fsS -o /dev/null "http://localhost:$PORT/"; then
  log "something already answers on port $PORT; not starting another server"
else
  log "starting ./skill-atlas serve $PORT (log: $SERVER_LOG)"
  nohup "$REPO/skill-atlas" serve "$PORT" >"$SERVER_LOG" 2>&1 &
fi

healthcheck() {
  log "healthcheck: typecheck"
  npm run typecheck
  log "healthcheck: offline tests"
  npm test
  log "healthcheck: browser tests"
  npm run test:browser
  log "healthcheck: CLI smoke"
  ./skill-atlas help >/dev/null
  ./skill-atlas scan ./fixture

  log "healthcheck: waiting for the web client on port $PORT"
  local n=0
  until body="$(curl -fsS -H "Host: skill-atlas.example.com" "http://localhost:$PORT/" 2>/dev/null)" \
      && grep -q '<title>Skill Atlas</title>' <<<"$body"; do
    n=$((n + 1))
    if [ $((n % 10)) -eq 0 ]; then
      log "still waiting for port $PORT; server log tail:"
      tail -5 "$SERVER_LOG" || true
    fi
    sleep 1
  done
  log "healthcheck: web client answers on port $PORT"
}

if [ -n "$WARMUP" ]; then healthcheck; fi
log "done"
