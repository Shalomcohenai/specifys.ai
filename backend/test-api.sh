#!/bin/bash
# API Testing Script
# Usage: ./test-api.sh [base-url]

BASE_URL=${1:-"http://localhost:3000"}

echo "🧪 Testing API endpoints at $BASE_URL"
echo "=================================="
echo ""

# Health check
echo "1. Testing /api/health..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Health check passed (200)"
else
  echo "   ❌ Health check failed (HTTP $HTTP_CODE)"
fi
echo ""

# Stats
echo "2. Testing /api/stats..."
STATS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/stats")
HTTP_CODE=$(echo "$STATS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Stats endpoint passed (200)"
else
  echo "   ❌ Stats endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

echo "=================================="
echo "✅ Basic API tests completed"
echo ""
echo "Note: For authenticated endpoints, you'll need to provide a token."
echo "Example: curl -H 'Authorization: Bearer YOUR_TOKEN' $BASE_URL/api/users/initialize"

