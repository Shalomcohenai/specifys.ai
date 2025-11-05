#!/bin/bash

# Script to create a Pull Request via GitHub API
# Usage: ./create-pr.sh [GITHUB_TOKEN]

GITHUB_TOKEN="${1:-$GITHUB_TOKEN}"
REPO_OWNER="Shalomcohenai"
REPO_NAME="specifys.ai"
BASE_BRANCH="main"
HEAD_BRANCH="basic-buy"
TITLE="Basic Buy Branch"
BODY="This PR contains the current version pushed to the basic-buy branch."

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GitHub token is required"
    echo ""
    echo "Usage:"
    echo "  ./create-pr.sh YOUR_GITHUB_TOKEN"
    echo ""
    echo "Or set GITHUB_TOKEN environment variable:"
    echo "  export GITHUB_TOKEN=your_token_here"
    echo "  ./create-pr.sh"
    echo ""
    echo "To create a GitHub token:"
    echo "  1. Go to https://github.com/settings/tokens"
    echo "  2. Click 'Generate new token (classic)'"
    echo "  3. Give it a name and select 'repo' scope"
    echo "  4. Copy the token and use it with this script"
    exit 1
fi

echo "Creating Pull Request..."
echo "Base: $BASE_BRANCH"
echo "Head: $HEAD_BRANCH"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/pulls" \
  -d "{
    \"title\": \"$TITLE\",
    \"body\": \"$BODY\",
    \"head\": \"$HEAD_BRANCH\",
    \"base\": \"$BASE_BRANCH\"
  }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 201 ]; then
    pr_url=$(echo "$body" | grep -o '"html_url":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Pull Request created successfully!"
    echo "🔗 URL: $pr_url"
elif [ "$http_code" -eq 422 ]; then
    echo "❌ Error: Pull Request might already exist or branches are not compatible"
    echo "Response: $body"
elif [ "$http_code" -eq 401 ]; then
    echo "❌ Error: Authentication failed. Please check your GitHub token."
    echo "Response: $body"
else
    echo "❌ Error: Failed to create Pull Request (HTTP $http_code)"
    echo "Response: $body"
fi

