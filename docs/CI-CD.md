# CI/CD Pipeline - Specifys.ai

## Overview

The CI/CD pipeline for Specifys.ai uses GitHub Actions to automate testing, building, and deployment.

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
1. **Lint** - Runs linting (if configured)
2. **Build** - Builds CSS, Vite bundles, and Jekyll site
3. **Test** - Runs tests (if configured)

### Deploy Frontend (`.github/workflows/deploy-frontend.yml`)

Runs on pushes to `main` branch when frontend files change.

**Steps:**
1. Checkout code
2. Setup Node.js and Ruby
3. Install dependencies
4. Build CSS (minified)
5. Build with Vite
6. Build Jekyll site
7. Deploy to production

**Deployment Options:**
- GitHub Pages
- Netlify
- Vercel
- Custom server (SSH/rsync)

### Deploy Backend (`.github/workflows/deploy-backend.yml`)

Runs on pushes to `main` branch when backend files change.

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Run tests (if configured)
5. Deploy to production

**Deployment Options:**
- Render.com (via webhook or API)
- Custom server (SSH/rsync)
- Docker (build and push to registry)

## Setup

### Required Secrets

For backend deployment to Render.com:
- `RENDER_API_KEY` - Render API key (optional, if using API instead of webhook)

### Environment Variables

No environment variables are required for CI/CD workflows. The workflows use:
- `NODE_ENV=production` for production builds
- Default Node.js version: 18
- Default Ruby version: 3.2

## Usage

### Manual Trigger

Workflows can be manually triggered from the GitHub Actions tab:
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"

### Automatic Trigger

Workflows run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Scheduled runs (for sitemap updates)

## Customization

### Adding Linting

1. Install ESLint: `npm install --save-dev eslint`
2. Create `.eslintrc.js` or `eslint.config.js`
3. Add lint script to `package.json`:
   ```json
   "scripts": {
     "lint": "eslint ."
   }
   ```

### Adding Tests

1. Install test framework (Jest, Mocha, etc.)
2. Add test script to `package.json`:
   ```json
   "scripts": {
     "test": "jest"
   }
   ```
3. Create test files (e.g., `*.test.js`)

### Custom Deployment

To customize deployment, edit the workflow files:
- `.github/workflows/deploy-frontend.yml` - Frontend deployment
- `.github/workflows/deploy-backend.yml` - Backend deployment

Example: Deploy to custom server via SSH
```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_KEY }}
    script: |
      cd /path/to/app
      git pull
      npm install
      npm run build
```

## Monitoring

### Workflow Status

Check workflow status:
- GitHub Actions tab
- Status badges (can be added to README)

### Notifications

Configure notifications in GitHub:
- Settings → Notifications → Actions
- Email notifications for workflow failures

## Troubleshooting

### Build Failures

1. Check workflow logs in GitHub Actions
2. Verify Node.js and Ruby versions
3. Check dependency installation
4. Verify build scripts in `package.json`

### Deployment Failures

1. Verify secrets are set correctly
2. Check deployment target configuration
3. Verify network connectivity
4. Check deployment logs

## Future Improvements

- [ ] Add automated testing
- [ ] Add code coverage reporting
- [ ] Add performance monitoring
- [ ] Add security scanning
- [ ] Add automated rollback on failure
- [ ] Add deployment notifications (Slack, email)


