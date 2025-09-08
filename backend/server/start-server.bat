@echo off
echo 🚀 Starting Specifys.ai feedback server...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Start the server
echo 🌐 Server starting on port 10000...
echo 📝 Feedback endpoint: http://localhost:10000/api/feedback
echo 🔧 Generate spec endpoint: http://localhost:10000/api/generate-spec
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js
pause
