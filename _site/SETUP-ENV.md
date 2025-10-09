# Setup Environment Variables

## Create `.env` file in backend directory

Create a file: `/Users/shalom/Desktop/new/specifys-dark-mode/backend/.env`

With the following content:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here

# API Keys (if you have Grok API)
API_KEY=your_grok_api_key_here
```

## Commands to create it:

```bash
cd /Users/shalom/Desktop/new/specifys-dark-mode/backend

# Create .env file
cat > .env << 'EOF'
GITHUB_TOKEN=your_github_token_here
API_KEY=your_grok_api_key_here
EOF

# Verify it was created
cat .env
```

**Important:** The `.env` file is in `.gitignore` so it won't be committed to GitHub. This is for security!

