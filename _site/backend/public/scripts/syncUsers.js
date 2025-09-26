import { auth, db } from './firebaseConfig.js';
import { createUserDocument } from './authService.js';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Sync existing users who have specs/apps but no user document
 * This script should be run once to fix the data inconsistency
 */
export async function syncExistingUsers() {
  try {
    console.log('Starting user sync process...');
    
    // Get all specs to find unique userIds
    const specsSnapshot = await getDocs(collection(db, 'specs'));
    const userIds = new Set();
    
    specsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });
    
    // Get all apps to find more unique userIds
    const appsSnapshot = await getDocs(collection(db, 'apps'));
    appsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });
    
    // Get all marketResearch to find more unique userIds
    const marketSnapshot = await getDocs(collection(db, 'marketResearch'));
    marketSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });
    
    console.log(`Found ${userIds.size} unique user IDs from existing data`);
    
    // Check which users don't have user documents
    const missingUsers = [];
    for (const userId of userIds) {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        missingUsers.push(userId);
      }
    }
    
    console.log(`Found ${missingUsers.length} users missing user documents`);
    
    // Create user documents for missing users
    for (const userId of missingUsers) {
      try {
        // Create a minimal user object with the data we have
        const mockUser = {
          uid: userId,
          email: `user-${userId}@temp.com`, // Temporary email
          displayName: `User ${userId.substring(0, 8)}`, // Display name from ID
          emailVerified: false
        };
        
        await createUserDocument(mockUser);
        console.log(`Created user document for ${userId}`);
      } catch (error) {
        console.error(`Failed to create user document for ${userId}:`, error);
      }
    }
    
    console.log('User sync process completed!');
    return {
      totalUserIds: userIds.size,
      missingUsers: missingUsers.length,
      syncedUsers: missingUsers.length
    };
    
  } catch (error) {
    console.error('Error during user sync:', error);
    throw error;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const specsSnapshot = await getDocs(collection(db, 'specs'));
    const appsSnapshot = await getDocs(collection(db, 'apps'));
    const marketSnapshot = await getDocs(collection(db, 'marketResearch'));
    
    const userIdsFromUsers = new Set();
    const userIdsFromData = new Set();
    
    // Get userIds from users collection
    usersSnapshot.forEach(doc => {
      userIdsFromUsers.add(doc.id);
    });
    
    // Get userIds from other collections
    [specsSnapshot, appsSnapshot, marketSnapshot].forEach(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          userIdsFromData.add(data.userId);
        }
      });
    });
    
    const orphanedData = [...userIdsFromData].filter(id => !userIdsFromUsers.has(id));
    const usersWithoutData = [...userIdsFromUsers].filter(id => !userIdsFromData.has(id));
    
    return {
      totalUsers: userIdsFromUsers.size,
      totalDataRecords: specsSnapshot.size + appsSnapshot.size + marketSnapshot.size,
      orphanedData: orphanedData.length,
      usersWithoutData: usersWithoutData.length,
      orphanedUserIds: orphanedData,
      usersWithoutDataIds: usersWithoutData
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
}

// Make functions available globally for console usage
if (typeof window !== 'undefined') {
  window.syncExistingUsers = syncExistingUsers;
  window.getUserStats = getUserStats;
}
