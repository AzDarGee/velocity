#!/bin/sh
# Entrypoint: Start Node.js API server in background, then nginx in foreground
echo "[entrypoint] Starting Node.js API server on port 3000..."
node /app/dist/server.mjs &

echo "[entrypoint] Starting nginx on port 80..."
nginx -g "daemon off;"
