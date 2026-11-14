# Baseline Assessment - Specifys.ai Improvement Round (Pilot)

**Date:** November 12, 2026  
**Agent:** Cloud Agent Run (Cursor)  
**Repository:** https://github.com/specifys-ai/specifys.ai (assumed based on workspace)  
**Branch:** cursor/improvement-pilot-2026-11-8487  

## Executive Summary

This is the baseline assessment for the first (pilot) improvement round for Specifys.ai. The system is a Jekyll + Vite static frontend on Vercel with an Express backend on Render, Firebase Auth/Firestore, Lemon Squeezy payments, OpenAI integration, Resend emails, and GitHub Actions CI.

**Overall Health:** Functional but with technical debt and testing gaps.

---

## 1. Baseline Testing Results

### 1.1 Environment Setup
- ✅ Node.js v22.23.4 installed
- ✅ npm 10.9.9 installed  
- ✅ Ruby 3.2.3 installed
- ✅ Bundler 4.0.24 installed
- ✅ Jekyll dependencies installed (97 gems)
- ✅ npm dependencies installed (573 packages root, 472 backend)
- ✅ Playwright browsers installed (Chromium)

### 1.2 Build Results

#### CSS Build
- ✅ **PASSED** - CSS compiled successfully
- ⚠️ **WARNINGS:** 24+ SASS deprecation warnings (@import will be removed in Dart Sass 3.0.0)

#### Vite Build
- ❌ **FAILED** - Cannot resolve 'firebase/app' entry module
- **Root Cause:** Vite config attempts to bundle Firebase as manualChunk but Firebase is loaded via CDN
- **Impact:** Frontend JS bundling is broken, though site works because modules are loaded differently
- **File:** `vite.config.js:46` - `manualChunks: { 'vendor-firebase': ['firebase/app', ...] }`

#### Jekyll Build
- ✅ **PASSED** - Site built successfully in 4.1 seconds
- ✅ Output directory: `_site/` created with all assets

### 1.3 Unit Tests

All backend unit tests are run directly with Node.js (no test runner framework):

| Test File | Status | Notes |
|-----------|--------|-------|
| admin-activity-service.test.js | ✅ PASSED | All assertions passed |
| lemon-webhook-utils.test.js | ✅ PASSED | All assertions passed |
| openai-error-utils.test.js | ✅ PASSED | All assertions passed |
| overview-readiness.test.js | ✅ PASSED | 21/21 checks passed |
| prompts-fidelity.test.js | ✅ PASSED | All checks passed |
| sprint-b-activation.test.js | ✅ PASSED | 55/55 checks passed |

**Summary:** 6/6 unit test files passed (97 total assertions)

### 1.4 End-to-End Tests (Playwright)

| Test | Status | Details |
|------|--------|---------|
| spec-viewer.spec.js | ❌ FAILED | Timeout waiting for mermaid loads |

**Error:** `TimeoutError: page.waitForFunction: Timeout 10000ms exceeded`  
**Location:** `tests/e2e/spec-viewer.spec.js:139`  
**Root Cause:** Test mocks `mermaidManager.loadMermaid()` but the actual diagram engine may not call it as expected  
**Impact:** E2E test suite not passing, but this appears to be a test setup issue rather than production code bug

### 1.5 TypeScript/Linting
- ⚠️ **NOT RUN** - No ESLint or TypeScript configuration found
- ⚠️ **NOT RUN** - No `npm run lint` script configured
- ⚠️ **NOT RUN** - No `npm test` script (tests run directly via node)

### 1.6 Security Audit

#### npm audit (root)
- **45 vulnerabilities** (2 low, 16 moderate, 23 high, 4 critical)
- Detailed report: `/tmp/npm-audit-baseline.json` (87.8 KB, 2933 lines)
- Most vulnerabilities appear to be in development dependencies (Playwright, @vitejs, etc.)

#### npm audit (backend)
- **41 vulnerabilities** (1 low, 18 moderate, 18 high, 4 critical)
- Similar pattern: mostly dev dependencies

### 1.7 Server Health
- ✅ Jekyll dev server: Running successfully on port 4000
- ✅ Backend server syntax: Valid (no syntax errors)
- ⚠️ Backend not started for baseline (requires env vars)

---

## 2. Code Exploration Findings

### 2.1 Project Structure

```
specifys.ai/
├── assets/               # Static assets (CSS, JS, images, data)
│   ├── css/             # SASS source files  
│   ├── js/              # Frontend JavaScript (modular)
│   ├── images/          # Static images
│   └── data/            # JSON data files
├── backend/             # Express.js backend
│   └── server/          # Server code (100+ files)
├── _includes/           # Jekyll includes (head, header, footer, etc.)
├── _layouts/            # Jekyll layouts (default, post, dashboard, etc.)
├── _posts/              # Blog posts (170+ markdown files)
├── _site/               # Jekyll build output (generated)
├── docs/                # Documentation
│   ├── architecture/    # ARCHITECTURE.md (comprehensive)
│   ├── guides/          # Development guides
│   └── references/      # API docs, site map
├── pages/               # Jekyll pages
├── tests/               # Test files
│   └── e2e/             # Playwright E2E tests
├── packages/            # Monorepo packages (api-client, ui, etc.)
├── mcp-server/          # MCP server (separate Node.js app)
└── scripts/             # Build and automation scripts
```

### 2.2 Architecture Overview

Based on `docs/architecture/ARCHITECTURE.md`:

**Frontend:**
- Jekyll static site generator
- Firebase Auth (client SDK via CDN)
- Vite for JS bundling (but currently broken)
- SASS for CSS compilation
- Hosted on Vercel

**Backend:**
- Express.js on Node.js 18+
- Hosted on Render
- ~100 server files (routes, services, utilities)
- Firebase Admin SDK for auth verification
- OpenAI API integration (3 patterns):
  1. Chat Completions + Structured Outputs (spec generation)
  2. Assistants API (chat, brain dump)
  3. Auxiliary API (mockups, prompts, mindmap)

**Data Layer:**
- Firestore (primary database)
- Collections: users, specs, specs_v2, user_credits_v3, etc.

**Third-Party Services:**
- Lemon Squeezy (payments)
- Resend (email)
- Google Analytics 4
- OpenAI GPT-4

### 2.3 Key Backend Files

| File | Lines | Purpose | Notes |
|------|-------|---------|-------|
| server.js | 1231 | Main entry point | Complex, handles routes, middleware, static serving |
| admin-routes.js | 3541 | Admin dashboard API | Very large file, multiple responsibilities |
| spec-generation-service-v2.js | ~500 | Spec generation engine | Core business logic |
| credits-v3-service.js | 1470 | Credits system | Critical for billing |
| email-service.js | 1553 | Email sending (Resend) | Lifecycle emails, templates |
| chat-service.js | 353 | OpenAI Assistants API | Chat and Brain Dump |

### 2.4 Test Coverage Analysis

**What's Tested:**
- Admin activity service (subscription events)
- Lemon webhook utilities
- OpenAI error handling utilities
- Overview readiness gating logic
- Prompts fidelity checks
- Sprint B feature activation checks
- Spec viewer modular smoke (E2E - but failing)

**What's NOT Tested:**
- ❌ Spec generation v2 (core feature)
- ❌ Credits consumption logic
- ❌ Payment webhook processing (Lemon Squeezy)
- ❌ Email sending (Resend)
- ❌ Firebase auth flows
- ❌ Chat and Brain Dump features
- ❌ API endpoint integration tests
- ❌ Frontend component tests

---

## 3. Issues Identified During Baseline

### P0 - Critical Issues

None identified that block core functionality.

### P1 - Significant Issues

1. **Vite Build Broken**
   - **File:** `vite.config.js:46`
   - **Issue:** Cannot resolve 'firebase/app' - Firebase is CDN-loaded but config tries to bundle it
   - **Impact:** JS bundling fails, potentially affecting production deploys
   - **Fix:** Remove firebase from manualChunks or install firebase npm packages

2. **E2E Test Failing**
   - **File:** `tests/e2e/spec-viewer.spec.js:139`
   - **Issue:** Mermaid loading timeout - test mock doesn't match actual implementation
   - **Impact:** No automated testing of spec viewer functionality
   - **Fix:** Update test to match actual mermaid loading pattern

3. **45 npm Security Vulnerabilities**
   - **Severity:** 4 critical, 23 high, 16 moderate, 2 low
   - **Impact:** Potential security risks, supply chain vulnerabilities
   - **Fix:** Review and update dependencies, prioritize critical vulnerabilities

### P2 - Meaningful Improvements

4. **24+ SASS Deprecation Warnings**
   - **File:** All SASS imports in `assets/css/`
   - **Issue:** Using deprecated `@import` syntax
   - **Impact:** Will break when Dart Sass 3.0.0 is released
   - **Fix:** Migrate to `@use` and `@forward` syntax

5. **No Linting or TypeScript**
   - **Issue:** No static analysis configured
   - **Impact:** Code quality inconsistencies, potential bugs
   - **Fix:** Add ESLint configuration and/or TypeScript

6. **Large Backend Files**
   - **File:** `admin-routes.js` (3541 lines), `server.js` (1231 lines)
   - **Issue:** Multiple responsibilities, hard to maintain
   - **Impact:** Code maintainability
   - **Fix:** Refactor into smaller, focused modules

### P3 - Nice to Have

7. **No Test Runner Framework**
   - **Issue:** Tests run directly with `node`, no test runner (Jest, Mocha, etc.)
   - **Impact:** Limited test features (no coverage, watch mode, etc.)
   - **Fix:** Integrate a test runner

8. **Inconsistent Logging**
   - **Issue:** Mix of console.log and pino logger
   - **Impact:** Inconsistent log format, harder to debug
   - **Fix:** Standardize on pino logger throughout

---

## 4. What Could Not Be Tested

1. **Backend API Endpoints** - Require Firebase credentials and environment variables
2. **Payment Flow** - Requires Lemon Squeezy integration and real/test API keys
3. **Email Sending** - Requires Resend API key
4. **OpenAI Integration** - Requires OpenAI API key
5. **Production Deployment** - Cannot test Vercel/Render deployment process
6. **Firestore Operations** - Require Firebase Admin credentials

---

## 5. Next Steps

### Immediate Priorities
1. ✅ Fix Vite build (remove firebase from manualChunks)
2. ✅ Fix E2E test (update mermaid loading test)
3. ⚠️ Review critical npm vulnerabilities
4. ✅ Migrate SASS @import to @use

### Architecture Review
- Deep dive into backend services
- Identify code duplication
- Review error handling patterns
- Assess auth and authorization security

### UX Review
- Test key user flows with headless browser
- Check mobile responsiveness
- Verify accessibility (keyboard, aria)
- Test error states and loading indicators

---

## Appendix

### Build Commands Reference

```bash
# Frontend
npm run build:css          # Compile SASS
npm run build:vite         # Build JS bundles (currently broken)
npm run build:vercel       # Full Vercel build (CSS + Vite + Jekyll)
bundle exec jekyll build   # Build Jekyll site
bundle exec jekyll serve   # Dev server (port 4000)

# Backend
cd backend && npm start    # Start backend server
cd backend && npm run dev  # Start with nodemon

# Tests
node backend/server/*.test.js                # Run backend unit tests
E2E_BASE_URL=http://127.0.0.1:4000 npx playwright test  # E2E tests
```

### Environment Variables Required

See `backend/server/env-check.js` for full list. Key variables:
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, etc. (Firebase Admin)
- `OPENAI_API_KEY` (OpenAI)
- `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_SIGNING_SECRET` (Payments)
- `RESEND_API_KEY` (Email)

---

**Report Generated:** 2026-11-12 19:06 UTC  
**Assessment Duration:** ~15 minutes  
**Files Analyzed:** 50+  
**Tests Run:** 6 unit test files, 1 E2E test file
