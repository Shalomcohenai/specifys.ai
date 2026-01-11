#!/bin/bash

# Lemon Squeezy Integration Setup Script
# This script installs all required dependencies for the payment integration

echo "🚀 Setting up Lemon Squeezy Payment Integration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

echo "📦 Installing Node.js dependencies..."

# Install required packages
npm install express firebase-admin node-fetch joi dotenv

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Error installing dependencies. Please check your Node.js installation."
    exit 1
fi

echo "🔧 Setting up environment file..."

# Create .env file from template if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f "env-template.txt" ]; then
        cp env-template.txt .env
        echo "✅ Created .env file from template"
        echo "⚠️  Please update the .env file with your actual values"
    else
        echo "❌ env-template.txt not found. Please create .env manually."
    fi
else
    echo "✅ .env file already exists"
fi

echo "🔥 Setting up Firebase..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "⚠️  Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

echo "📋 Next steps:"
echo "1. Update your .env file with actual values"
echo "2. Get Firebase service account key (see docs/firebase-setup.md)"
echo "3. Deploy Firestore rules: firebase deploy --only firestore:rules"
echo "4. Set up Lemon Squeezy webhook URL"
echo "5. Start the server: npm start"

echo "🎉 Setup complete!"
