#!/bin/bash

echo "Stopping all Node.js processes..."
pkill -9 -f "node.*server.js" || true

echo "Waiting 2 seconds..."
sleep 2

echo "Checking if ports are free..."
lsof -ti:3001 && echo "Port 3001 is still in use" || echo "Port 3001 is free"
lsof -ti:3002 && echo "Port 3002 is still in use" || echo "Port 3002 is free"

echo "Starting server on port 3002 (background with logging)..."
cd /Users/shalom/Desktop/new/specifys-dark-mode/backend
nohup node server/server.js > server.log 2>&1 &
echo $! > server.pid
echo "Server started with PID $(cat server.pid). Logs: backend/server.log"
