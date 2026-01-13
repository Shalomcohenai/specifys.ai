/**
 * Migrate all entitlements data to user_credits collection
 * This script migrates all users from the old entitlements system to the new user_credits system
 * Usage: node backend/scripts/migrate-entitlements-to-user-credits.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();
const ENTITLEMENTS_COLLECTION = 'entitlements';
const USER_CREDITS_COLLECTION = 'user_credits';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

/**
 * Migrate a single user from entitlements to user_credits
 */
async function migrateUser(userId) {
  try {
    // Check if user_credits already exists
    const creditsRef = db.collection(USER_CREDITS_COLLECTION).doc(userId);
    const creditsDoc = await creditsRef.get();
    
    // Get entitlements data
    const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
    const entitlementsDoc = await entitlementsRef.get();
    
    if (!entitlementsDoc.exists) {
      // No entitlements data - skip
      return { userId, status: 'skipped', reason: 'no_entitlements' };
    }
    
    const entitlements = entitlementsDoc.data();
    
    // Get user data for free_specs_remaining
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Calculate balances from old system
    const paid = typeof entitlements.spec_credits === 'number' ? entitlements.spec_credits : 0;
    const free = typeof userData.free_specs_remaining === 'number' ? userData.free_specs_remaining : 0;
    const bonus = 0; // Start with 0 bonus credits
    
    // Determine subscription
    const isUnlimited = entitlements.unlimited === true;
    const subscriptionType = isUnlimited ? 'pro' : 'none';
    const subscriptionStatus = isUnlimited ? 'active' : 'none';
    
    // Check if subscription document exists for expiration date and other details
    let subscriptionExpiresAt = null;
    let subscriptionDetails = {};
    if (isUnlimited) {
      const subscriptionDoc = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).get();
      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data();
        subscriptionExpiresAt = subData.renews_at || subData.current_period_end || null;
        subscriptionDetails = {
          renewsAt: subData.renews_at || null,
          endsAt: subData.ends_at || null,
          cancelAtPeriodEnd: subData.cancel_at_period_end || false,
          lastOrderTotal: subData.last_order_total || null,
          currency: subData.currency || 'USD',
          billingInterval: subData.billing_interval || null
        };
      }
    }
    
    // Create new credits document structure
    const newCredits = {
      userId: userId,
      balances: {
        paid: paid,
        free: free,
        bonus: bonus
      },
      subscription: {
        type: subscriptionType,
        status: subscriptionStatus,
        expiresAt: subscriptionExpiresAt,
        preservedCredits: typeof entitlements.preserved_credits === 'number' 
          ? entitlements.preserved_credits 
          : 0,
        ...subscriptionDetails
      },
      permissions: {
        canEdit: entitlements.can_edit === true,
        canCreateUnlimited: isUnlimited
      },
      metadata: {
        createdAt: entitlements.updated_at || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastCreditGrant: null,
        lastCreditConsume: null,
        migratedFrom: 'entitlements',
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    };
    
    if (creditsDoc.exists) {
      // User_credits already exists - check for inconsistencies
      const existingCredits = creditsDoc.data();
      const existingTotal = (existingCredits.balances?.paid || 0) + 
                           (existingCredits.balances?.free || 0) + 
                           (existingCredits.balances?.bonus || 0);
      const newTotal = paid + free + bonus;
      
      const existingIsPro = existingCredits.subscription?.type === 'pro' && 
                           existingCredits.subscription?.status === 'active';
      
      // Check if there's an inconsistency
      if (existingIsPro !== isUnlimited || existingTotal !== newTotal) {
        // Update with merged data - prioritize existing if it's more recent
        const mergedCredits = {
          ...existingCredits,
          balances: {
            paid: Math.max(existingCredits.balances?.paid || 0, paid),
            free: Math.max(existingCredits.balances?.free || 0, free),
            bonus: Math.max(existingCredits.balances?.bonus || 0, bonus)
          },
          subscription: {
            ...existingCredits.subscription,
            // If entitlements says unlimited, ensure subscription is pro
            type: isUnlimited ? 'pro' : (existingCredits.subscription?.type || 'none'),
            status: isUnlimited ? 'active' : (existingCredits.subscription?.status || 'none'),
            ...subscriptionDetails
          },
          permissions: {
            canEdit: existingCredits.permissions?.canEdit || entitlements.can_edit === true,
            canCreateUnlimited: existingCredits.permissions?.canCreateUnlimited || isUnlimited
          },
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.migratedFrom': 'entitlements',
          'metadata.migratedAt': admin.firestore.FieldValue.serverTimestamp()
        };
        
        await creditsRef.set(mergedCredits, { merge: true });
        return { 
          userId, 
          status: 'updated', 
          reason: 'inconsistency_fixed',
          details: {
            existingTotal,
            newTotal,
            existingIsPro,
            newIsPro: isUnlimited
          }
        };
      } else {
        // No inconsistency - skip
        return { userId, status: 'skipped', reason: 'already_migrated' };
      }
    } else {
      // Create new user_credits document
      await creditsRef.set(newCredits);
      return { 
        userId, 
        status: 'migrated', 
        details: {
          paid,
          free,
          bonus,
          subscriptionType,
          subscriptionStatus
        }
      };
    }
  } catch (error) {
    console.error(`❌ Error migrating user ${userId}:`, error);
    return { userId, status: 'error', error: error.message };
  }
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('🚀 Starting migration from entitlements to user_credits...\n');
    
    // Get all entitlements documents
    const entitlementsSnapshot = await db.collection(ENTITLEMENTS_COLLECTION).get();
    const userIds = entitlementsSnapshot.docs.map(doc => doc.id);
    
    console.log(`📊 Found ${userIds.length} users in entitlements collection.\n`);
    
    if (userIds.length === 0) {
      console.log('✅ No users to migrate.');
      process.exit(0);
    }
    
    const results = {
      migrated: [],
      updated: [],
      skipped: [],
      errors: []
    };
    
    // Migrate each user
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      console.log(`[${i + 1}/${userIds.length}] Migrating user ${userId}...`);
      
      const result = await migrateUser(userId);
      
      switch (result.status) {
        case 'migrated':
          results.migrated.push(result);
          console.log(`  ✅ Migrated: paid=${result.details.paid}, free=${result.details.free}, pro=${result.details.subscriptionType === 'pro'}`);
          break;
        case 'updated':
          results.updated.push(result);
          console.log(`  🔄 Updated: ${result.reason}`);
          break;
        case 'skipped':
          results.skipped.push(result);
          console.log(`  ⏭️  Skipped: ${result.reason}`);
          break;
        case 'error':
          results.errors.push(result);
          console.log(`  ❌ Error: ${result.error}`);
          break;
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${results.migrated.length}`);
    console.log(`🔄 Updated: ${results.updated.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    console.log('='.repeat(60));
    
    // Print Pro users summary
    const proUsers = results.migrated.filter(r => r.details?.subscriptionType === 'pro').length +
                     results.updated.filter(r => r.details?.newIsPro === true).length;
    console.log(`\n👑 Pro users: ${proUsers}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors occurred during migration. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
main();

