# 🛠️ Required Tools & Setup - Specifys.ai

## 📦 Development Environment Setup

### 1. Node.js & Package Manager
```bash
# Install Node.js (v18 or higher)
# Download from: https://nodejs.org/

# Verify installation
node --version
npm --version

# Install yarn (alternative package manager)
npm install -g yarn
```

### 2. Project Dependencies
```bash
# Install development dependencies
npm install --save-dev @rollup/plugin-terser
npm install --save-dev postcss postcss-cli autoprefixer cssnano
npm install --save-dev rollup @rollup/plugin-node-resolve
npm install --save-dev imagemin imagemin-webp imagemin-pngquant
npm install --save-dev jest cypress lighthouse-ci
npm install --save-dev eslint @eslint/js
npm install --save-dev dotenv

# Install production dependencies
npm install express-rate-limit
npm install dompurify
npm install zustand
npm install compression
npm install helmet
```

---

## 🔧 Build Tools Configuration

### 3. PostCSS Configuration
Create `postcss.config.js`:
```javascript
module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: 'default'
    })
  ]
}
```

### 4. Rollup Configuration
Create `rollup.config.js`:
```javascript
import { terser } from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/js/app.js',
  output: {
    file: 'dist/js/app.min.js',
    format: 'iife',
    name: 'SpecifysApp'
  },
  plugins: [
    nodeResolve(),
    terser({
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    })
  ]
};
```

### 5. ESLint Configuration
Create `.eslintrc.js`:
```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error'
  }
};
```

---

## 🧪 Testing Tools Setup

### 6. Jest Configuration
Create `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**'
  ]
};
```

### 7. Cypress Configuration
Create `cypress.config.js`:
```javascript
module.exports = {
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js'
  }
};
```

### 8. Lighthouse CI Configuration
Create `lighthouserc.js`:
```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', {minScore: 0.9}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.9}],
        'categories:seo': ['warn', {minScore: 0.9}]
      }
    }
  }
};
```

---

## 🔒 Security Tools

### 9. Environment Variables Setup
Create `.env.example`:
```bash
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Server Configuration
NODE_ENV=development
PORT=3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
SESSION_SECRET=your_session_secret_here
CORS_ORIGIN=http://localhost:3000
```

Create `.env` (copy from .env.example and fill real values):
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 10. Security Headers Configuration
Create `security.js`:
```javascript
const helmet = require('helmet');

const securityConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://www.gstatic.com", "https://www.googletagmanager.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.google-analytics.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

module.exports = securityConfig;
```

---

## 📊 Monitoring & Analytics Tools

### 11. Google Analytics 4 Setup
Add to `index.html`:
```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RWBT69JCM7"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-RWBT69JCM7', {
    page_title: document.title,
    page_location: window.location.href
  });
</script>
```

### 12. Error Monitoring Setup (Sentry)
```bash
npm install @sentry/browser @sentry/node
```

Create `sentry.js`:
```javascript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE',
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 1.0,
});

export default Sentry;
```

### 13. Performance Monitoring
Create `performance.js`:
```javascript
// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to Google Analytics
  gtag('event', metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_category: 'Web Vitals',
    event_label: metric.id,
    non_interaction: true,
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## 🚀 Deployment Tools

### 14. GitHub Actions Setup
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        NODE_ENV: production
    
    - name: Run tests
      run: npm test
    
    - name: Run Lighthouse CI
      run: npm run lighthouse
    
    - name: Deploy to server
      run: |
        # Add your deployment script here
        echo "Deploying to production..."
```

### 15. Docker Configuration (Optional)
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - .:/app
      - /app/node_modules
```

---

## 📁 Project Structure Setup

### 16. Recommended Directory Structure
```
specifys-ai/
├── src/
│   ├── css/
│   │   ├── critical.css
│   │   ├── main.css
│   │   ├── components/
│   │   └── utilities/
│   ├── js/
│   │   ├── core/
│   │   ├── components/
│   │   ├── services/
│   │   └── utils/
│   ├── images/
│   └── tests/
├── dist/
│   ├── css/
│   ├── js/
│   └── images/
├── cypress/
│   ├── e2e/
│   └── support/
├── .github/
│   └── workflows/
├── config/
├── docs/
└── tools/
```

### 17. Package.json Scripts
```json
{
  "scripts": {
    "dev": "npm run build:css:watch & npm run build:js:watch & npm run serve",
    "build": "npm run clean && npm run build:css && npm run build:js && npm run build:images",
    "build:css": "postcss src/css/main.css -o dist/css/main.min.css",
    "build:js": "rollup -c",
    "build:images": "imagemin src/images/* --out-dir=dist/images",
    "build:css:watch": "postcss src/css/main.css -o dist/css/main.min.css --watch",
    "build:js:watch": "rollup -c --watch",
    "clean": "rimraf dist",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "lighthouse": "lighthouse-ci",
    "lint": "eslint src/js/**/*.js",
    "lint:fix": "eslint src/js/**/*.js --fix",
    "serve": "python3 -m http.server 3000",
    "start": "node server.js"
  }
}
```

---

## 🔍 Quality Assurance Tools

### 18. Code Quality Tools
```bash
# Install additional linting tools
npm install --save-dev @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier
npm install --save-dev husky lint-staged
```

### 19. Pre-commit Hooks Setup
```bash
# Setup husky for git hooks
npx husky install
npx husky add .husky/pre-commit "npm run lint-staged"
```

Create `.lintstagedrc.js`:
```javascript
module.exports = {
  'src/**/*.js': ['eslint --fix', 'prettier --write'],
  'src/**/*.css': ['prettier --write'],
  '*.md': ['prettier --write']
};
```

### 20. Accessibility Testing
```bash
# Install accessibility testing tools
npm install --save-dev axe-core
npm install --save-dev @axe-core/cli
```

Create `accessibility-test.js`:
```javascript
const axe = require('axe-core');
const puppeteer = require('puppeteer');

async function testAccessibility(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  
  const results = await page.evaluate(async () => {
    const axe = require('axe-core');
    return await axe.run();
  });
  
  console.log('Accessibility violations:', results.violations.length);
  
  await browser.close();
  return results;
}
```

---

## 📋 Installation Checklist

### Development Environment
- [ ] Node.js v18+ installed
- [ ] npm/yarn installed
- [ ] Git configured
- [ ] Code editor (VS Code recommended)
- [ ] Browser dev tools

### Project Setup
- [ ] Clone repository
- [ ] Install dependencies (`npm install`)
- [ ] Copy `.env.example` to `.env`
- [ ] Configure environment variables
- [ ] Run initial build (`npm run build`)

### Testing Setup
- [ ] Jest configured and running
- [ ] Cypress installed and configured
- [ ] Lighthouse CI setup
- [ ] Accessibility testing tools installed

### Security Setup
- [ ] Firebase keys moved to environment variables
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] Input validation added

### Monitoring Setup
- [ ] Google Analytics configured
- [ ] Error monitoring (Sentry) setup
- [ ] Performance monitoring active
- [ ] Uptime monitoring configured

---

## 💰 Cost Breakdown

### Free Tools
- Node.js, npm, yarn
- Jest, Cypress
- Lighthouse CI
- ESLint, Prettier
- GitHub Actions (free tier)

### Paid Tools
- Sentry (Error monitoring): $26/month
- Domain & Hosting: ~$10/month
- SSL Certificate: Free (Let's Encrypt)

### Total Monthly Cost: ~$36/month

---

**Setup Time Estimate**: 4-6 hours
**Maintenance Time**: 2-4 hours/month
