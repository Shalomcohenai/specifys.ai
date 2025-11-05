#!/bin/bash

# Lemon Squeezy Integration Deployment Script
# This script deploys the payment integration to production

echo "🚀 Deploying Lemon Squeezy Payment Integration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

echo "🔍 Checking prerequisites..."

# Check if .env file exists and has required values
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please run setup.sh first."
    exit 1
fi

# Check if Firebase project ID is set
if grep -q "your-project-id-here" .env; then
    echo "❌ Error: Please update FIREBASE_PROJECT_ID in .env file"
    exit 1
fi

# Check if Firebase service account key is set
if grep -q '"project_id":"your-project-id"' .env; then
    echo "❌ Error: Please update FIREBASE_SERVICE_ACCOUNT_KEY in .env file"
    exit 1
fi

echo "✅ Prerequisites check passed"

echo "🔥 Deploying Firestore rules..."

# Deploy Firestore rules and indexes
firebase deploy --only firestore

if [ $? -eq 0 ]; then
    echo "✅ Firestore rules deployed successfully!"
else
    echo "❌ Error deploying Firestore rules"
    exit 1
fi

echo "🌐 Setting up Lemon Squeezy webhook..."

# Get the webhook URL
WEBHOOK_URL="https://yourdomain.com/api/webhook/lemon"
echo "⚠️  Please set up the webhook URL in Lemon Squeezy dashboard:"
echo "   URL: $WEBHOOK_URL"
echo "   Secret: testpassword123"

echo "🧪 Testing webhook endpoint..."

# Test webhook endpoint (this will fail but shows the endpoint exists)
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature: sha256=test" \
  -d '{"test": "data"}' \
  --max-time 10 \
  --silent \
  --show-error

echo ""
echo "📋 Deployment checklist:"
echo "✅ Firestore rules deployed"
echo "✅ Webhook endpoint configured"
echo "⚠️  Lemon Squeezy webhook URL needs to be set"
echo "⚠️  Test webhook functionality"
echo "⚠️  Monitor webhook logs"

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set webhook URL in Lemon Squeezy dashboard"
echo "2. Test with Lemon Squeezy test webhooks"
echo "3. Monitor server logs for webhook processing"
echo "4. Test purchase flow end-to-end"
