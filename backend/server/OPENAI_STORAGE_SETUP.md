# OpenAI Storage Integration - Setup Guide

This guide explains how to set up and test the OpenAI Storage integration for storing specifications.

## Overview

The OpenAI Storage feature allows you to store specifications in OpenAI's Files API, enabling future use of File Search capabilities and reducing token costs by referencing stored files instead of sending full content.

## Initial Setup

### 1. Environment Variables

Copy `env.example` to `.env` if it doesn't exist:

```bash
cd backend/server
cp env.example .env
```

Edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
ENABLE_OPENAI_STORAGE=false  # Start with false for testing
```

**Important:** Keep `ENABLE_OPENAI_STORAGE=false` initially until you've completed manual testing.

### 2. Install Dependencies

```bash
cd backend/server
npm install
```

The `form-data` package is already included in package.json and will be installed automatically.

## Phase 1: Manual Testing

### Testing the Upload Endpoint

1. Start the server:

```bash
npm start
```

2. Create a test specification through your normal flow.

3. Get your Firebase auth token (from browser console or your auth system).

4. Call the manual upload endpoint:

```bash
curl -X POST http://localhost:3001/api/specs/YOUR_SPEC_ID/upload-to-openai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_AUTH_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "fileId": "file-abc123xyz",
  "message": "Spec uploaded to OpenAI successfully"
}
```

5. Verify in Firebase:
   - The spec document should now have:
     - `openaiFileId`: "file-abc123xyz"
     - `uploadedToOpenAI`: true
     - `openaiUploadTimestamp`: timestamp

6. Verify in OpenAI Dashboard:
   - Go to https://platform.openai.com/files
   - You should see a file named `spec-YOUR_SPEC_ID.json`

### Testing the Status Endpoint

```bash
curl http://localhost:3001/api/specs/openai-status \
  -H "Authorization: Bearer YOUR_FIREBASE_AUTH_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "total": 10,
  "uploaded": 1,
  "failed": 0,
  "notUploaded": 9,
  "percentage": "10.00",
  "enabled": false
}
```

## Phase 2: Automatic Upload (Background)

Once manual testing is successful:

1. Enable automatic uploads:

```bash
# In .env file
ENABLE_OPENAI_STORAGE=true
```

2. Restart the server:

```bash
npm start
```

3. Create a new specification through the normal flow.

4. Wait 2-3 seconds and check Firebase - the spec should now have `uploadedToOpenAI: true`.

5. Check server logs for:

```
[Background] Uploading spec ABC123 to OpenAI...
[Background] ✓ Successfully uploaded spec ABC123 to OpenAI (file ID: file-xyz)
```

## Phase 3: Migration of Existing Specs

To upload all existing specs to OpenAI:

1. Make sure `ENABLE_OPENAI_STORAGE=true` is set (optional, but recommended for consistency).

2. Run the migration script:

```bash
cd backend/server
npm run migrate-to-openai
```

Expected output:
```
🚀 Starting migration of specs to OpenAI...
📊 Found 50 specs to migrate

[1/50] Migrating spec ABC123...
  ✓ Success (file ID: file-xyz)

...

=== Migration Summary ===
Total specs processed: 50
✅ Successful: 48
❌ Failed: 2
Success rate: 96.00%
```

3. Verify:
   - Check Firebase: All specs should have `uploadedToOpenAI: true`
   - Check OpenAI Dashboard: Should see files for all specs

## Troubleshooting

### Error: "OpenAI storage not configured"

**Solution:** Make sure `OPENAI_API_KEY` is set in your `.env` file.

### Error: "Unauthorized" when testing endpoints

**Solution:** Make sure you're passing a valid Firebase auth token in the Authorization header.

### Error: "Rate limit exceeded"

**Solution:** The migration script includes a 1-second delay between uploads. If you still hit rate limits, you may need to:
- Wait a few minutes
- Reduce the number of concurrent uploads
- Check your OpenAI API usage limits

### Upload fails silently

**Check:**
1. Server logs for error messages
2. Firebase for `openaiUploadError` field
3. OpenAI account for API quota

## API Endpoints Reference

### POST `/api/specs/:specId/upload-to-openai`

Manually upload a spec to OpenAI.

**Auth:** Required (Firebase token)
**Params:** `specId` (URL parameter)
**Returns:**
```json
{
  "success": true,
  "fileId": "file-abc123",
  "message": "Spec uploaded to OpenAI successfully"
}
```

### GET `/api/specs/openai-status`

Get statistics about OpenAI storage status.

**Auth:** Required (Firebase token)
**Returns:**
```json
{
  "success": true,
  "total": 10,
  "uploaded": 8,
  "failed": 1,
  "notUploaded": 2,
  "percentage": "80.00",
  "enabled": true
}
```

## Next Steps

After completing all three phases:

1. Monitor the `/api/specs/openai-status` endpoint regularly
2. Check OpenAI dashboard for file uploads
3. Review server logs for any upload errors
4. Once stable, proceed to Phase 4 (File Search integration) - **TODO in future implementation**

## Cost Considerations

- OpenAI Files API storage: Free tier includes some storage
- File search tokens: Will be charged when using file search (future phase)
- Monitor usage at https://platform.openai.com/usage

## Security Notes

- OpenAI API keys are sensitive - never commit `.env` to git
- Firebase auth tokens are required for all endpoints
- Each user can only upload their own specs
- Files in OpenAI are not user-specific by OpenAI, but permissions are handled by Firebase

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Check Firebase for `openaiUploadError` fields
3. Review this guide and troubleshooting section
4. Contact the development team

