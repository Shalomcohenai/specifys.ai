# Scripts Directory

This directory contains all utility scripts for the project.

## Structure

- `blog/` - Scripts for blog post management
- `backend/` - Scripts for backend server management

## Usage

### Blog Scripts

To create a new blog post:
```bash
cd scripts/blog
./create-post.sh  # or create-post.bat on Windows
```

### Backend Scripts

To start the backend server:
```bash
cd scripts/backend
./start-server.sh
```

To restart the backend server:
```bash
cd scripts/backend
./restart-server.sh
```

To deploy:
```bash
cd scripts/backend
./deploy.sh
```

To set up the backend:
```bash
cd scripts/backend
./setup.sh
```

To test API:
```bash
cd scripts/backend
./test-api.sh
```

To test wakeup:
```bash
cd scripts/backend
./test-wakeup.sh
```

To test prompts worker:
```bash
node scripts/test-prompts-worker.js
# Or with minimal payload:
node scripts/test-prompts-worker.js --minimal
```

