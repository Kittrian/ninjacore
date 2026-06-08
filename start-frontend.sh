#!/bin/bash
set -e

export PORT=3100
export NODE_ENV=production
export NINJACORE_API_ORIGIN=http://127.0.0.1:8080
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Free port 3100 if something is already using it
fuser -k 3100/tcp 2>/dev/null || true
sleep 1

cd /opt/ninjacore/apps/ninjacore-web
exec npm start
