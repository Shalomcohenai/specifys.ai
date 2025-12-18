#!/bin/bash
# Test script for server wake-up functionality
# Usage: ./test-wakeup.sh [base-url]

BASE_URL=${1:-"https://specifys-ai-development.onrender.com"}

echo "🧪 Testing Server Wake-Up Functionality"
echo "========================================"
echo ""

# Test 1: Health endpoint is accessible
echo "1. Testing /api/health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Health endpoint is accessible (200)"
  echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE" | head -1
else
  echo "   ❌ Health endpoint failed (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# Test 2: Response time measurement
echo "2. Measuring response time..."
START_TIME=$(date +%s%N)
curl -s "$BASE_URL/api/health" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$((($END_TIME - $START_TIME) / 1000000))
echo "   Response time: ${RESPONSE_TIME}ms"
if [ $RESPONSE_TIME -lt 5000 ]; then
  echo "   ✅ Response time is acceptable (< 5s)"
else
  echo "   ⚠️  Response time is slow (> 5s)"
fi
echo ""

# Test 3: Multiple rapid requests (simulating page loads)
echo "3. Testing multiple rapid requests..."
SUCCESS_COUNT=0
for i in {1..5}; do
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/health")
  if [ "$HTTP_CODE" = "200" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
  sleep 0.5
done
echo "   Successful requests: $SUCCESS_COUNT/5"
if [ $SUCCESS_COUNT -eq 5 ]; then
  echo "   ✅ All requests succeeded"
else
  echo "   ⚠️  Some requests failed"
fi
echo ""

echo "========================================"
echo "✅ Wake-up functionality tests completed"




