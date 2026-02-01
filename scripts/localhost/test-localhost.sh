#!/bin/bash

# ============================================
# Specifys.ai - Localhost Test Script
# ============================================
# בודק שהשרתים רצים ופועלים נכון
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🧪 Specifys.ai - Localhost Test${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3
    
    echo -e "${YELLOW}🔍 בודק: ${name}...${NC}"
    
    if response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "$expected_status" ]; then
            echo -e "${GREEN}✅ ${name}: עבר (HTTP ${http_code})${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}❌ ${name}: נכשל (ציפה ל-HTTP ${expected_status}, קיבל ${http_code})${NC}"
            ((FAILED++))
            return 1
        fi
    else
        echo -e "${RED}❌ ${name}: נכשל (לא ניתן להתחבר)${NC}"
        ((FAILED++))
        return 1
    fi
}

# Test Backend Health
echo -e "${BLUE}📋 בודק Backend Server...${NC}"
test_endpoint "Backend Health" "http://localhost:10000/api/health" "200"

# Test Backend Status
test_endpoint "Backend Status" "http://localhost:10000/api/status" "200"

echo ""

# Test Frontend
echo -e "${BLUE}📋 בודק Frontend Server...${NC}"
test_endpoint "Frontend Home" "http://localhost:4000" "200"
test_endpoint "Frontend Auth Page" "http://localhost:4000/pages/auth.html" "200"

echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}📊 סיכום בדיקות${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✅ עבר: ${PASSED}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ נכשל: ${FAILED}${NC}"
    echo ""
    echo -e "${YELLOW}💡 טיפים:${NC}"
    echo -e "   1. ודא ש-Backend רץ: cd backend && node server/server.js"
    echo -e "   2. ודא ש-Jekyll רץ: bundle exec jekyll serve"
    echo -e "   3. או השתמש ב: ./start-localhost.sh"
    exit 1
else
    echo -e "${GREEN}🎉 כל הבדיקות עברו בהצלחה!${NC}"
    exit 0
fi

