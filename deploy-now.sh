#!/bin/bash

SERVER="10.0.0.109"
SERVER_USER="drewdrew"
SERVER_PASSWORD="antioch777"
SERVER_PATH="/opt/ninjacore"

echo "🚀 DEPLOYING TO SERVER (skipping GitHub)..."
echo ""

SSH="sshpass -p '${SERVER_PASSWORD}' ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER}"

# Pull latest
$SSH "cd ${SERVER_PATH} && git pull origin \$(git rev-parse --abbrev-ref HEAD) && echo '✓ Code pulled'"

# Build frontend
$SSH "cd ${SERVER_PATH} && node build.mjs 2>&1 | tail -5"

# Restart
$SSH "systemctl restart ninjacore-frontend ninja-auth ninjacore && sleep 2"

# Status
$SSH "systemctl status ninjacore-frontend --no-pager | grep Active"

echo ""
echo "✅ DEPLOYED!"
echo "Live: https://ninjacore.ninjadispute.com"
