#!/bin/bash

# Watch Webhooks Script
# Monitors webhook logs in real-time

echo "🔍 Starting webhook monitoring..."
echo "Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Watch the server log file for webhook-related entries
tail -f backend/server.log | grep --line-buffered "WEBHOOK\|ORDER_CREATED\|POLLING\|grantCredits" | while read line; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $line"
done
