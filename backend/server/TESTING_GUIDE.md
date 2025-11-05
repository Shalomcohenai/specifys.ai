# Testing Guide - OpenAI Storage Integration

## Overview

This guide provides step-by-step instructions for testing the OpenAI Storage integration across all phases.

## Prerequisites

1. **Setup Environment**
   ```bash
   cd backend/server
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Local Server**
   ```bash
   npm start
   ```

## Phase 1 Testing: Manual Upload

### Step 1: Create a Test Spec

1. Open your browser to `http://localhost:3001` (or your local URL)
2. Log in with a test account
3. Create a new specification through the normal flow
4. Note the spec ID from the URL or browser console

### Step 2: Test Manual Upload Endpoint

Using curl or Postman:

```bash
curl -X POST http://localhost:3001/api/specs/YOUR_SPEC_ID/upload-to-openai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "fileId": "file-abc123xyz",
  "message": "Spec uploaded to OpenAI successfully"
}
```

### Step 3: Verify in Firebase

1. Go to Firebase Console
2. Navigate to Firestore → specs collection
3. Find your spec document
4. Verify these fields exist:
   - `openaiFileId`: Should have a value like "file-abc123xyz"
   - `uploadedToOpenAI`: Should be `true`
   - `openaiUploadTimestamp`: Should have a timestamp

### Step 4: Verify in OpenAI Dashboard

1. Go to https://platform.openai.com/files
2. You should see a file named `spec-YOUR_SPEC_ID.json`
3. Click on it to verify the content matches your spec

## Phase 2 Testing: Automatic Upload

### Step 1: Enable Automatic Upload

Edit `.env`:
```bash
ENABLE_OPENAI_STORAGE=true
```

Restart the server:
```bash
npm start
```

### Step 2: Create a New Spec

1. Go through the normal spec creation flow
2. Create a new specification
3. The spec should be created immediately (no delay)

### Step 3: Check Background Upload

Within 2-3 seconds, check:

**In Firebase Console:**
- The spec should have `uploadedToOpenAI: true`
- Check `openaiFileId` is populated

**In Server Logs:**
You should see:
```
[Background] Uploading spec ABC123 to OpenAI...
[Background] ✓ Successfully uploaded spec ABC123 to OpenAI (file ID: file-xyz)
```

**In OpenAI Dashboard:**
- New file should appear for this spec

### Step 4: Test Multiple Updates

1. Go to spec viewer for an existing spec
2. Approve the overview (triggers technical/market/design generation)
3. After each section is generated, wait 2-3 seconds
4. Check OpenAI dashboard - the file should be updated
5. Check Firebase - `openaiUploadTimestamp` should be updated

## Phase 3 Testing: Migration Script

### Step 1: Prepare for Migration

Make sure you have some existing specs that haven't been uploaded:
- Specs without `uploadedToOpenAI` field
- Or `uploadedToOpenAI: false`

### Step 2: Run Migration

```bash
cd backend/server
npm run migrate-to-openai
```

**Expected Output:**
```
🚀 Starting migration of specs to OpenAI...
📊 Found 10 specs to migrate

[1/10] Migrating spec ABC123...
  ✓ Success (file ID: file-xyz)

...

=== Migration Summary ===
Total specs processed: 10
✅ Successful: 9
❌ Failed: 1
Success rate: 90.00%
```

### Step 3: Verify Migration Results

**In Firebase:**
- All specs should have `uploadedToOpenAI: true`
- Check for any `openaiUploadError` fields (indicates failures)

**In OpenAI Dashboard:**
- Should see files for all migrated specs
- Count should match the number of successful uploads

## Testing Status Endpoint

### Endpoint: GET /api/specs/openai-status

```bash
curl http://localhost:3001/api/specs/openai-status \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "total": 50,
  "uploaded": 48,
  "failed": 1,
  "notUploaded": 2,
  "percentage": "96.00",
  "enabled": true
}
```

## Common Issues & Solutions

### Issue: "OpenAI storage not configured"

**Solution:**
```bash
# Make sure .env file exists and has:
OPENAI_API_KEY=sk-your-key-here
```

### Issue: "Unauthorized"

**Solution:**
- Make sure you're logged in
- Get a valid Firebase auth token
- Use the token in Authorization header

### Issue: Upload fails with 400 error

**Possible causes:**
1. Spec data is too large (> 512 MB per file in OpenAI)
2. Invalid JSON format in spec data
3. Rate limiting

**Solutions:**
- Check spec data size
- Verify JSON is valid
- Wait a few minutes if rate limited

### Issue: Background upload doesn't trigger

**Check:**
1. `ENABLE_OPENAI_STORAGE` is set to `true` in .env
2. Server logs for error messages
3. Firebase for `openaiUploadError` field

### Issue: Rate limiting (429 errors)

**Solution:**
- The migration script has built-in 1-second delays
- If still hitting limits, increase delay in migration script
- Check OpenAI usage dashboard

## Performance Testing

### Test 1: Concurrent Uploads

1. Create multiple specs quickly
2. Verify all upload successfully
3. Check for rate limiting errors

### Test 2: Large Specs

1. Create a spec with very detailed content
2. Verify upload succeeds (OpenAI has file size limits)
3. Check download/retrieval works

### Test 3: Network Failures

1. Disconnect internet during upload
2. Reconnect
3. Verify error is logged in Firebase
4. Retry upload

## Integration Testing

### Test 1: Full Workflow

1. Create new spec → Should auto-upload to OpenAI
2. Approve overview → Should update OpenAI file
3. Generate technical → Should update OpenAI file
4. Generate market → Should update OpenAI file
5. Generate design → Should update OpenAI file

### Test 2: Existing Specs

1. Load existing spec (already uploaded)
2. Make edits
3. Save changes
4. Verify OpenAI file is updated

### Test 3: Multiple Users

1. Log in as User A
2. Create spec
3. Verify upload works
4. Log in as User B
5. Try to upload User A's spec → Should fail with 403

## Test Checklist

- [ ] Manual upload works
- [ ] Firebase gets updated with file ID
- [ ] OpenAI dashboard shows file
- [ ] Automatic upload works
- [ ] Background upload doesn't block UI
- [ ] Status endpoint returns correct data
- [ ] Migration script works
- [ ] Retry on failure works
- [ ] Unauthorized access is blocked
- [ ] Errors are logged properly

## Next Steps

After completing all tests:
1. Document any issues found
2. Fix bugs
3. Re-test
4. Deploy to production with feature flags OFF
5. Gradually enable features in production

