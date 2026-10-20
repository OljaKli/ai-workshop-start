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

# Chromium for `npm run test:browser`.
log "installing Playwright chromium-headless-shell ..."
npx playwright install chromium-headless-shell
log "Playwright browser installed"
SHELL_BIN="$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | sort -V | tail -1)"

# Its system libraries are not in the image and sudo is unavailable, so download the Ubuntu
# packages with a userspace apt state and extract them; a wrapper puts them on the library path
# for Chromium only, and the tests launch it through CHROMIUM_PATH.
DEPS="$HOME/.local/chromium-deps"
WRAPPER="$HOME/.local/bin/chromium-headless-shell"
deps_env() { env LD_LIBRARY_PATH="$DEPS/usr/lib/x86_64-linux-gnu:$DEPS/lib/x86_64-linux-gnu" "$@"; }
if deps_env ldd "$SHELL_BIN" | grep -q 'not found'; then
  log "fetching Chromium system libraries into $DEPS ..."
  APT="$HOME/.cache/air-apt"
  mkdir -p "$APT/lists/partial" "$APT/archives/partial" "$APT/debs" "$DEPS"
  O=(-o Dir::State::Lists="$APT/lists" -o Dir::Cache="$APT" -o Dir::Cache::Archives="$APT/archives" -o Debug::NoLocking=1)
  apt-get "${O[@]}" -q update
  # Playwright's Chromium dependencies on Ubuntu 24.04; the simulation adds the missing transitive ones.
  PKGS="libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3
    libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1
    libxext6 libxfixes3 libxkbcommon0 libxrandr2"
  # shellcheck disable=SC2086
  need="$(apt-get "${O[@]}" -s install --no-install-recommends $PKGS | awk '/^Inst /{print $2}')"
  log "packages: $(echo $need)"
  # shellcheck disable=SC2086
  (cd "$APT/debs" && apt-get "${O[@]}" -q download $need && for f in *.deb; do dpkg-deb -x "$f" "$DEPS"; done)
  rm -rf "$APT/debs"
  if deps_env ldd "$SHELL_BIN" | grep 'not found'; then
    log "ERROR: Chromium still misses the libraries above"
    exit 1
  fi
  log "Chromium system libraries ready"
fi
cat >"$DEPS/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/usr/share/fonts</dir>
  <dir>$DEPS/usr/share/fonts</dir>
  <cachedir>$HOME/.cache/fontconfig</cachedir>
  <include ignore_missing="yes">$DEPS/etc/fonts/conf.d</include>
</fontconfig>
EOF
mkdir -p "$(dirname "$WRAPPER")"
cat >"$WRAPPER" <<EOF
#!/bin/sh
export LD_LIBRARY_PATH="$DEPS/usr/lib/x86_64-linux-gnu:$DEPS/lib/x86_64-linux-gnu\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$DEPS/fonts.conf"
exec "$SHELL_BIN" "\$@"
EOF
chmod +x "$WRAPPER"
export CHROMIUM_PATH="$WRAPPER"

# CHROMIUM_PATH for the agent's shells: a file of our own, sourced from the login profile and .bashrc.
ENV_FILE="$HOME/.skill-atlas-env.sh"
echo "export CHROMIUM_PATH=\"$WRAPPER\"" >"$ENV_FILE"
MARKER="# skill-atlas env (air startup)"
for p in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -f "$p" ]; then PROFILE="$p"; break; fi
done
PROFILE="${PROFILE:-$HOME/.profile}"
for rc in "$PROFILE" "$HOME/.bashrc"; do
  grep -qF "$MARKER" "$rc" 2>/dev/null || printf '\n%s\n[ -f "%s" ] && . "%s"\n' "$MARKER" "$ENV_FILE" "$ENV_FILE" >>"$rc"
done
log "CHROMIUM_PATH=$WRAPPER (via $ENV_FILE)"

# The web client, in the background; it listens on all interfaces and accepts any Host.
if curl -fsS -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
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
