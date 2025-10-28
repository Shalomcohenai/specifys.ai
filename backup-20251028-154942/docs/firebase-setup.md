# Firebase Service Account Setup

## Step 1: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click on **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file

## Step 2: Add to Environment

Copy the entire JSON content and paste it as the value for `FIREBASE_SERVICE_ACCOUNT_KEY` in your `.env` file:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
```

**Important:** Keep this file secure and never commit it to version control!

## Step 3: Update Project ID

Replace `your-project-id-here` in the `.env` file with your actual Firebase project ID.

## Step 4: Test Connection

Run the server to test the connection:

```bash
cd backend
npm start
```

You should see: `✅ Firebase Admin SDK initialized successfully`
