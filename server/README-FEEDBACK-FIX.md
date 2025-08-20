# 🔧 Fixing the CORS Feedback Issue

## Problem
You were experiencing a CORS (Cross-Origin Resource Sharing) error when trying to submit feedback directly to Google Apps Script from your frontend:

```
Access to fetch at 'https://script.google.com/macros/s/...' from origin 'https://specifys-ai.com' has been blocked by CORS policy
```

## Solution
Instead of calling Google Apps Script directly from the frontend, we now use your local Node.js server as a proxy. The server handles CORS properly and forwards the feedback to Google Apps Script.

## How It Works

1. **Frontend** → Sends feedback to your local server (`/api/feedback`)
2. **Local Server** → Receives feedback, handles CORS, forwards to Google Apps Script
3. **Google Apps Script** → Saves feedback to Google Sheets
4. **Response** → Returns success/error back through the chain

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start the Server

**On macOS/Linux:**
```bash
./start-server.sh
```

**On Windows:**
```bash
start-server.bat
```

**Manual start:**
```bash
node server.js
```

The server will start on port 10000.

### 3. Test the Feedback Form
- Open your website
- Try submitting feedback
- Check the server console for logs

## Configuration

### Update Production Server URL
In `server/config.js`, update the `productionServerUrl`:
```javascript
productionServerUrl: 'https://your-actual-production-server.com'
```

### Environment Variables (Optional)
Create a `.env` file in the server directory:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
FEEDBACK_EMAIL=feedback@specifys-ai.com
API_KEY=your-openai-api-key
```

## File Changes Made

### Frontend (`index.html`)
- Updated feedback submission to use local server instead of Google Apps Script directly
- Added dynamic URL detection for local vs production

### Backend (`server/server.js`)
- Enhanced CORS handling with proper origin validation
- Updated feedback endpoint to forward data to Google Apps Script
- Added better error handling and logging

### New Files
- `server/config.js` - Configuration management
- `server/start-server.sh` - Linux/macOS startup script
- `server/start-server.bat` - Windows startup script

## Benefits

✅ **No more CORS errors**  
✅ **Better error handling**  
✅ **Centralized configuration**  
✅ **Email notifications** (if configured)  
✅ **Console logging for debugging**  
✅ **Fallback handling**  

## Troubleshooting

### Server won't start
- Check if Node.js is installed: `node --version`
- Check if port 10000 is available
- Check console for error messages

### Feedback still not working
- Ensure server is running on port 10000
- Check browser console for errors
- Check server console for logs
- Verify Google Apps Script URL is correct

### Production Deployment
- Deploy the server to your production environment
- Update the production server URL in your frontend
- Ensure CORS origins are properly configured

## Security Notes

- The server now validates CORS origins
- Only allowed domains can make requests
- Google Apps Script URL is centralized in config
- Environment variables for sensitive data

## Next Steps

1. Test locally with the server running
2. Deploy server to production
3. Update frontend production URL
4. Monitor feedback submissions
5. Check Google Sheets for new entries
