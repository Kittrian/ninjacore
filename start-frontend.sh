#!/bin/bash
set -e

export PORT=3100
export NODE_ENV=production
export NINJACORE_API_ORIGIN=http://127.0.0.1:8080

cd /opt/ninjacore/apps/ninjacore-web

# Find npm in common install locations
NPM=""
for p in /usr/local/bin/npm /usr/bin/npm "$HOME/.nvm/versions/node/$(node --version 2>/dev/null)/bin/npm"; do
  if [ -x "$p" ]; then
    NPM="$p"
    break
  fi
done

if [ -z "$NPM" ]; then
  NPM=$(command -v npm)
fi

exec "$NPM" start
