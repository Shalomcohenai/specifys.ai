#!/bin/bash

# Start Specifys.ai backend server
echo "🚀 Starting Specifys.ai backend server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies in server directory if needed
if [ ! -d "../../backend/server/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd ../../backend/server && npm install && cd ../../scripts/backend
fi

# Start the server
echo "🌐 Server starting on port 3001..."
echo "📝 API endpoints:"
echo "  - GET  /api/status - Server status"
echo "  - GET  /api/specs/entitlements - Get user entitlements"
echo "  - POST /api/specs/create - Create spec"
echo "  - POST /api/chat/init - Initialize chat"
echo "  - POST /api/chat/message - Send chat message"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start server and log output
cd ../../backend
node server/server.js 2>&1 | tee server.log

