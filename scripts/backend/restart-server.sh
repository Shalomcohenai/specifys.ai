#!/bin/bash

echo "Stopping all Node.js processes..."
pkill -9 -f "node.*server.js" || true

echo "Waiting 2 seconds..."
sleep 2

echo "Checking if ports are free..."
TARGET_PORT=${PORT:-10000}
lsof -ti:${TARGET_PORT} && echo "Port ${TARGET_PORT} is still in use" || echo "Port ${TARGET_PORT} is free"

echo "Starting server (PORT from env, default ${TARGET_PORT}) in background with logging..."
cd "$(dirname "$0")/../../backend"
nohup node server/server.js > server.log 2>&1 &
echo $! > server.pid
echo "Server started with PID $(cat server.pid). Logs: backend/server.log"
