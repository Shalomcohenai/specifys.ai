# Specs Profile Fix - Summary

## Issues Identified

### Problem 1: Specs Not Appearing in Profile
**Symptoms:**
- User creates a spec but doesn't approve it
- After logout/login, spec is not visible in profile
- Spec appears to exist but isn't linked to the user

**Root Cause:**
Missing composite index in Firestore database for querying specs by `userId` and `createdAt`.

The query `where('userId', '==', userId).orderBy('createdAt', 'desc')` requires a composite index that wasn't defined.

### Problem 2: Network Error in Console
**Symptoms:**
`ERR_QUIC_PROTOCOL_ERROR` in the browser console when trying to load specs

**Root Cause:**
The missing composite index causes the Firestore query to fail with a network-level error.

## Fixes Applied

### 1. Added Composite Indexes (`backend/public/firestore.indexes.json`)
Added the following composite indexes to support querying user content:

- **specs**: `userId` + `createdAt`
- **specs_v2**: `userId` + `createdAt`
- **apps**: `userId` + `createdAt`
- **marketResearch**: `userId` + `createdAt`
- **appNotes**: `appId` + `userId` + `createdAt`
- **appFeatures**: `appId` + `userId` + `createdAt`
- **appTasks**: `appId` + `userId` + `createdAt`
- **appMilestones**: Two indexes - one with `createdAt`, one with `dueDate`
- **appExpenses**: `appId` + `userId` + `createdAt`
- **userLikes**: `userId` + `likedAt`

### 2. Enhanced Logging (`assets/js/index.js`)
Added console logging to track `userId` when creating specs:
```javascript
console.log('   → User ID:', specDoc.userId);
console.log('   → User Name:', specDoc.userName);
```

### 3. Enhanced Error Handling (`pages/profile.html`)
Added detailed error logging and user-friendly error messages:
```javascript
console.log('🔍 [LOADING WORKSPACE] Current user ID:', currentUser.uid);
console.log('   → Found spec:', doc.id, '- userId:', data.userId, '- title:', data.title);
```

Error messages now detect missing index issues and provide helpful guidance.

### 4. Updated Deployment Script (`backend/deploy.sh`)
Changed from deploying only rules to deploying both rules and indexes:
```bash
# Before: firebase deploy --only firestore:rules
# After:  firebase deploy --only firestore
```

## Verification

### Checking Specs are Properly Saved
The `userId` field is correctly set in `saveSpecToFirebase()`:
```javascript
const specDoc = {
  userId: user.uid,
  userName: user.displayName || user.email || 'Unknown User',
  // ... other fields
};
```

### Checking Profile Query
The profile page correctly queries for user specs:
```javascript
const specsQuery = query(
  collection(db, 'specs'),
  where('userId', '==', currentUser.uid),
  orderBy('createdAt', 'desc')
);
```

## Deployment

Indexes have been deployed to Firebase. Wait a few minutes for them to build before testing.

To verify deployment status:
1. Go to Firebase Console → Firestore Database → Indexes
2. Check that the new indexes appear and are building/completed

## Testing Instructions

1. Create a new spec as a logged-in user
2. Check browser console for logging showing the `userId` being saved
3. Logout and login again
4. Check profile - spec should now appear
5. Check console for any errors related to loading specs

## Notes

- There's a typo in an existing Firestore index: `creadedAt` instead of `createdAt` in the `appTasks` collection. This was kept to avoid breaking existing functionality.
- All new indexes were deployed successfully
- The `userId` field is properly set when creating specs
- Firestore rules already allow users to read their own specs

## Files Modified

1. `backend/public/firestore.indexes.json` - Added all required composite indexes
2. `_site/backend/public/firestore.indexes.json` - Same updates
3. `assets/js/index.js` - Added logging for userId
4. `pages/profile.html` - Added detailed error logging
5. `backend/deploy.sh` - Updated to deploy indexes
