# Public Stats Update Instructions

## Problem
The homepage was trying to query the `specs` collection directly from Firebase, which requires authentication. This caused a "Missing or insufficient permissions" error.

## Solution
A new `public_stats` collection was created with public read access that stores only the counts (no sensitive data).

## Changes Made

### 1. Firestore Rules (`backend/public/firestore.rules`)
- Added a new `public_stats` collection with public read access
- Only admins can write to this collection

### 2. Frontend (`assets/js/index.js`)
- Changed from querying `specs` collection to querying `public_stats` collection
- Reads from `public_stats/counts` document

### 3. Backend Server
- Created `backend/server/stats-routes.js` with two endpoints:
  - `POST /api/stats/update` - Updates stats (admin only)
  - `GET /api/stats` - Gets current stats (public)
- Added initialization script: `backend/server/scripts/init-public-stats.js`

## Deployment Steps

### Step 1: Deploy Firestore Rules
```bash
cd backend
firebase deploy --only firestore:rules
```

### Step 2: Initialize Public Stats Document
```bash
cd backend/server
node scripts/init-public-stats.js
```

### Step 3: Deploy Updated Frontend
```bash
# Build and deploy your site
bundle exec jekyll build
firebase deploy --only hosting
```

## Keeping Stats Updated

The stats should be updated periodically. You can:

1. **Manual update via API:**
   ```bash
   # Get Firebase auth token and call:
   curl -X POST http://localhost:3000/api/stats/update \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Automatic update (recommended):**
   - Create a cron job to call the update endpoint daily
   - Or update stats whenever a new spec is created

## Testing

After deployment, the error should be gone and the homepage should load without Firebase permission errors.

