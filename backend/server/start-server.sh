#!/bin/bash

# Start Specifys.ai feedback server
echo "🚀 Starting Specifys.ai feedback server..."

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

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌐 Server starting on port 10000..."
echo "📝 Feedback endpoint: http://localhost:10000/api/feedback"
echo "🔧 Generate spec endpoint: http://localhost:10000/api/generate-spec"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.js
