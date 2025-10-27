# Lemon Squeezy Integration - Quick Start Guide

## 🚀 What's Already Done

✅ **All code is written and ready!**
- Payment integration backend services
- Webhook processing with signature verification
- Frontend paywall and credits display
- Firestore database schema and rules
- Comprehensive documentation

## 📋 What You Need to Complete

### 1. Environment Setup
**File:** `/backend/env-template.txt` (copy to `.env`)
```bash
cd backend
cp env-template.txt .env
# Edit .env with your actual values
```

**Required values:**
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_KEY`: JSON key from Firebase Console
- `FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket

### 2. Firebase Service Account
**Guide:** `/docs/firebase-setup.md`

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Copy JSON content to `.env` file

### 3. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 4. Lemon Squeezy Webhook
**URL to set in Lemon Squeezy dashboard:**
```
https://yourdomain.com/api/webhook/lemon
```

**Secret:** `specifys_ai_secret_2025`

### 5. Install Dependencies
```bash
cd backend
./setup.sh
```

### 6. Deploy
```bash
cd backend
./deploy.sh
```

## 🧪 Testing

**Guide:** `/docs/testing-guide.md`

**Quick test:**
1. Start server: `npm start`
2. Test webhook endpoint
3. Test purchase flow
4. Verify credits display

## 📚 Documentation

- **Main Integration Guide:** `/docs/lemon-squeezy-integration.md`
- **Firebase Setup:** `/docs/firebase-setup.md`
- **Testing Guide:** `/docs/testing-guide.md`

## 🎯 Ready to Go!

Once you complete the setup steps above, your payment integration will be fully functional with:

- ✅ Credit-based spec creation
- ✅ Pro subscription management
- ✅ Real-time credits display
- ✅ Secure webhook processing
- ✅ Pending entitlements for unauthenticated users
- ✅ Comprehensive audit logging

**Total setup time: ~30 minutes**
