#!/bin/bash

# ============================================
# Specifys.ai - Localhost Development Server
# ============================================
# סקריפט להרצת frontend (Jekyll) ו-backend (Node.js) יחד
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🚀 Specifys.ai - Localhost Development${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 בודק דרישות מוקדמות...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js לא מותקן. אנא התקן Node.js תחילה.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm לא מותקן. אנא התקן npm תחילה.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Check Ruby
if ! command -v ruby &> /dev/null; then
    echo -e "${RED}❌ Ruby לא מותקן. אנא התקן Ruby תחילה.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Ruby: $(ruby --version)${NC}"

# Check Bundler
if ! command -v bundle &> /dev/null; then
    echo -e "${YELLOW}⚠️  Bundler לא מותקן. מתקין...${NC}"
    gem install bundler
fi
echo -e "${GREEN}✅ Bundler: $(bundle --version)${NC}"

echo ""

# Install dependencies if needed
echo -e "${YELLOW}📦 בודק התקנות...${NC}"

# Install backend dependencies
if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
    echo -e "${YELLOW}📦 מתקין dependencies של backend...${NC}"
    cd "$PROJECT_ROOT/backend"
    npm install
fi

# Install Jekyll dependencies
if [ ! -d "$PROJECT_ROOT/vendor/bundle" ]; then
    echo -e "${YELLOW}📦 מתקין dependencies של Jekyll...${NC}"
    cd "$PROJECT_ROOT"
    bundle install
fi

echo -e "${GREEN}✅ כל ה-dependencies מותקנים${NC}"
echo ""

# Check for .env file
if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    echo -e "${YELLOW}⚠️  קובץ .env לא נמצא בתיקיית backend/${NC}"
    echo -e "${YELLOW}📝 יצירת קובץ .env מתוך template...${NC}"
    if [ -f "$PROJECT_ROOT/backend/env-template.txt" ]; then
        cp "$PROJECT_ROOT/backend/env-template.txt" "$PROJECT_ROOT/backend/.env"
        echo -e "${YELLOW}⚠️  אנא עדכן את קובץ .env עם הערכים הנכונים!${NC}"
        echo -e "${YELLOW}   קובץ: $PROJECT_ROOT/backend/.env${NC}"
    else
        echo -e "${RED}❌ קובץ env-template.txt לא נמצא!${NC}"
        exit 1
    fi
    echo ""
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 עוצר את השרתים...${NC}"
    kill $JEKYLL_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ השרתים נעצרו${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${BLUE}🔧 מפעיל backend server...${NC}"
cd "$PROJECT_ROOT/backend"
node server/server.js > /tmp/specifys-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${YELLOW}⏳ ממתין ל-backend להתחיל...${NC}"
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend server נכשל להתחיל${NC}"
    echo -e "${YELLOW}📋 לוגים:${NC}"
    cat /tmp/specifys-backend.log
    exit 1
fi

# Test backend
if curl -s http://localhost:10000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server רץ על http://localhost:10000${NC}"
else
    echo -e "${YELLOW}⚠️  Backend server לא מגיב. ייתכן שהוא עדיין מתחיל...${NC}"
fi

echo ""

# Start Jekyll server
echo -e "${BLUE}🌐 מפעיל Jekyll server...${NC}"
cd "$PROJECT_ROOT"
bundle exec jekyll serve --host 0.0.0.0 --port 4000 > /tmp/specifys-jekyll.log 2>&1 &
JEKYLL_PID=$!

# Wait for Jekyll to start
echo -e "${YELLOW}⏳ ממתין ל-Jekyll להתחיל...${NC}"
sleep 5

# Check if Jekyll is running
if ! kill -0 $JEKYLL_PID 2>/dev/null; then
    echo -e "${RED}❌ Jekyll server נכשל להתחיל${NC}"
    echo -e "${YELLOW}📋 לוגים:${NC}"
    cat /tmp/specifys-jekyll.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ כל השרתים רצים!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}🌐 Frontend (Jekyll):${NC} http://localhost:4000"
echo -e "${BLUE}🔧 Backend (Node.js):${NC}  http://localhost:10000"
echo ""
echo -e "${YELLOW}📋 לוגים:${NC}"
echo -e "   Backend:  tail -f /tmp/specifys-backend.log"
echo -e "   Jekyll:   tail -f /tmp/specifys-jekyll.log"
echo ""
echo -e "${YELLOW}💡 עצה: לחץ Ctrl+C כדי לעצור את כל השרתים${NC}"
echo ""

# Wait for both processes
wait $JEKYLL_PID $BACKEND_PID

