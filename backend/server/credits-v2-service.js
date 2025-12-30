const { db, admin } = require('./firebase-admin');
const crypto = require('crypto');
const { logger } = require('./logger');
const { recordSubscriptionChange, recordCreditConsumption } = require('./admin-activity-service');

const CREDITS_COLLECTION = 'user_credits';
const LEDGER_COLLECTION = 'credit_ledger';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

/**
 * Generate unique transaction ID for idempotency
 */
function generateTransactionId(type, identifier, userId) {
  if (identifier) {
    return `${type}_${identifier}_${userId}`;
  }
  return `${type}_${Date.now()}_${userId}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Get default credits structure (0 credits - for fallback/error cases)
 */
function getDefaultCredits(userId) {
  logger.info({ userId }, '[CREDITS-V2] getDefaultCredits called - Creating default credits with 0 credits (fallback)');
  
  const creditsStructure = {
    userId: userId,
    balances: {
      paid: 0,
      free: 0,
      bonus: 0
    },
    subscription: {
      type: 'none',
      status: 'none',
      expiresAt: null,
      preservedCredits: 0
    },
    permissions: {
      canEdit: false,
      canCreateUnlimited: false
    },
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCreditGrant: null,
      lastCreditConsume: null
    }
  };
  
  logger.info({ userId, freeCredits: 0, paidCredits: 0, bonusCredits: 0 }, '[CREDITS-V2] getDefaultCredits - Default credits structure created (0 credits)');
  
  return creditsStructure;
}

/**
 * Get initial credits structure for new user (with 1 free welcome credit)
 * This should be used when creating a new user during registration
 */
function getInitialCreditsForNewUser(userId) {
  logger.info({ userId }, '[CREDITS-V2] getInitialCreditsForNewUser called - Creating initial credits with 1 free welcome credit');
  
  const creditsStructure = {
    userId: userId,
    balances: {
      paid: 0,
      free: 1,  // Welcome credit for new users
      bonus: 0
    },
    subscription: {
      type: 'none',
      status: 'none',
      expiresAt: null,
      preservedCredits: 0
    },
    permissions: {
      canEdit: false,
      canCreateUnlimited: false
    },
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCreditGrant: admin.firestore.FieldValue.serverTimestamp(),
      lastCreditConsume: null,
      welcomeCreditGranted: true  // Flag to prevent duplicate grants
    }
  };
  
  logger.info({ userId, freeCredits: 1, paidCredits: 0, bonusCredits: 0 }, '[CREDITS-V2] getInitialCreditsForNewUser - Initial credits structure created successfully');
  
  return creditsStructure;
}

/**
 * Calculate total credits from balances
 */
function calculateTotal(balances) {
  return (balances.paid || 0) + (balances.free || 0) + (balances.bonus || 0);
}

/**
 * Select which credit type to consume based on priority
 * @param {Object} balances - Current balances
 * @param {Array<string>} priority - Priority order (default: ['free', 'bonus', 'paid'])
 * @returns {string|null} - Credit type to consume, or null if no credits available
 */
function selectCreditType(balances, priority = ['free', 'bonus', 'paid']) {
  // Ensure balances is an object
  if (!balances || typeof balances !== 'object' || Array.isArray(balances)) {
    logger.warn({ balances, priority }, '[CREDITS-V2] selectCreditType - Invalid balances object');
    return null;
  }
  
  for (const type of priority) {
    const balance = balances[type];
    // Check if balance exists and is a positive number
    if (typeof balance === 'number' && balance > 0) {
      return type;
    }
  }
  return null;
}

/**
 * Determine credit type based on source
 */
function determineCreditType(source, metadata) {
  // If creditType is explicitly specified in metadata, use it
  if (metadata && metadata.creditType) {
    return metadata.creditType;
  }
  if (source === 'admin' && metadata.creditType) {
    return metadata.creditType; // Allow admin to specify
  }
  if (source === 'lemon_squeezy' || source === 'purchase') {
    return 'paid';
  }
  if (source === 'promotion' || source === 'free_trial') {
    return 'free';
  }
  if (source === 'bonus' || metadata.isBonus) {
    return 'bonus';
  }
  return 'paid'; // Default
}

/**
 * Migrate credits from old system (entitlements) to new system (user_credits)
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Migrated credits data
 */
async function migrateFromOldSystem(userId) {
  logger.info({ userId }, '[CREDITS-V2] Migrating from old system');
  
  try {
    // Get old entitlements
    const entitlementsRef = db.collection('entitlements').doc(userId);
    const entitlementsDoc = await entitlementsRef.get();
    
    if (!entitlementsDoc.exists) {
      // No old data, return null to create default
      return null;
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
    
    // Create new credits document
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
    
    // Save to new collection
    const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
    await creditsRef.set(newCredits);
    
    logger.info({ userId, paid, free, bonus, subscriptionType }, '[CREDITS-V2] Migration completed successfully');
    
    return newCredits;
  } catch (error) {
    logger.error({ userId, error: error.message }, '[CREDITS-V2] Error during migration');
    // Don't throw - return null to create default instead
    return null;
  }
}

/**
 * Get user credits (single source of truth)
 * Automatically migrates from old system if needed
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - User credits data
 */
/**
 * Get user credits from Firestore
 * @param {string} userId - Firebase user ID
 * @param {boolean} autoCreate - If true, creates default credits if not found (default: true for backward compatibility)
 * @returns {Promise<Object>} - User credits data
 * @throws {Error} - If credits don't exist and autoCreate is false
 */
async function getUserCredits(userId, autoCreate = true) {
  logger.info({ userId, autoCreate }, '[CREDITS-V2] getUserCredits called');
  
  if (!userId || typeof userId !== 'string') {
    logger.error({ userId }, '[CREDITS-V2] getUserCredits - Invalid userId');
    throw new Error('Invalid userId');
  }
  
  logger.debug({ userId }, '[CREDITS-V2] getUserCredits - Fetching credits document from Firestore...');
  const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
  const creditsDoc = await creditsRef.get();
  
  if (!creditsDoc.exists) {
    logger.warn({ userId }, '[CREDITS-V2] getUserCredits - Credits document does NOT exist');
    logger.info({ userId }, '[CREDITS-V2] getUserCredits - Attempting migration from old system...');
    
    // Try to migrate from old system
    const migratedCredits = await migrateFromOldSystem(userId);
    
    if (migratedCredits) {
      logger.info({ userId }, '[CREDITS-V2] getUserCredits - ✅ Migration successful, returning migrated credits');
      const totalMigrated = calculateTotal(migratedCredits.balances);
      logger.info({ userId, totalCredits: totalMigrated }, '[CREDITS-V2] getUserCredits - Migrated credits summary');
      return migratedCredits;
    }
    
    logger.info({ userId }, '[CREDITS-V2] getUserCredits - No old data found for migration');
    
    // No old data found - check if user is initialized before auto-creating
    if (autoCreate) {
      // Check if user document exists - if not, user hasn't been initialized yet
      // Don't create credits for uninitialized users to avoid race condition with initializeUser
      logger.info({ userId }, '[CREDITS-V2] getUserCredits - Checking if user is initialized...');
      const userRef = db.collection(USERS_COLLECTION).doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        logger.warn({ userId }, '[CREDITS-V2] getUserCredits - ⚠️ User not initialized yet, throwing error to force initialization (prevents race condition)');
        // User not initialized - don't create credits, let initializeUser handle it
        throw new Error(`User credits not found for user ${userId}. User must be initialized first via /api/users/initialize`);
      }
      
      // User exists - check if user was created recently (within last 5 minutes)
      // If so, try to initialize user credits instead of creating default credits with 0
      const userData = userDoc.data();
      const userCreatedAt = userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : null;
      const isRecentlyCreated = userCreatedAt && (Date.now() - userCreatedAt.getTime()) < 5 * 60 * 1000; // 5 minutes
      
      if (isRecentlyCreated) {
        logger.info({ userId }, '[CREDITS-V2] getUserCredits - User created recently, attempting to initialize credits via initializeUser...');
        try {
          // Try to initialize user credits - this will create credits with welcome credit if user is new
          const userManagement = require('./user-management');
          const initResult = await userManagement.initializeUser(userId, {}, true); // isNewUserFromClient = true
          
          if (initResult.credits) {
            logger.info({ userId }, '[CREDITS-V2] getUserCredits - ✅ User initialized successfully, reading credits from Firestore');
            // Read credits from Firestore to ensure we have the latest data
            const freshCreditsDoc = await creditsRef.get();
            if (freshCreditsDoc.exists) {
              const creditsData = freshCreditsDoc.data();
              // Enrich subscription data if needed (same logic as below)
              if (creditsData.subscription && creditsData.subscription.type === 'pro') {
                try {
                  const subscriptionDoc = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).get();
                  if (subscriptionDoc.exists) {
                    const subData = subscriptionDoc.data();
                    // Merge subscription details (same logic as in getUserCredits below)
                    creditsData.subscription = {
                      ...creditsData.subscription,
                      renewsAt: subData.renews_at || null,
                      endsAt: subData.ends_at || null,
                      expiresAt: subData.current_period_end || null,
                      cancelAtPeriodEnd: subData.cancel_at_period_end || false,
                      lastOrderTotal: subData.last_order_total || null,
                      currency: subData.currency || 'USD',
                      billingInterval: subData.billing_interval || null,
                      purchaseDate: subData.purchase_date || null
                    };
                  }
                } catch (error) {
                  logger.warn({ userId, error: error.message }, '[CREDITS-V2] getUserCredits - Failed to fetch subscription details');
                }
              }
              // Return credits in the same format as the rest of the function
              return creditsData;
            } else {
              logger.warn({ userId }, '[CREDITS-V2] getUserCredits - Credits document still not found after initialization');
            }
          }
          
          // If initialization didn't create credits, fall through to create default credits
          logger.warn({ userId }, '[CREDITS-V2] getUserCredits - Initialization didn\'t create credits, falling back to default credits');
        } catch (initError) {
          logger.warn({ userId, error: initError.message }, '[CREDITS-V2] getUserCredits - Failed to initialize user, falling back to default credits');
          // Fall through to create default credits
        }
      }
      
      // User exists but not recently created, or initialization failed - create default credits (for backward compatibility with existing users)
      logger.warn({ userId }, '[CREDITS-V2] getUserCredits - ⚠️ autoCreate=true, user exists but credits do not exist, creating default credits (0)');
      // Create default credits (0 credits) - for backward compatibility
      // Note: New users should be initialized via initializeUser which creates credits with welcome credit
      const defaultCredits = getDefaultCredits(userId);
      logger.info({ userId }, '[CREDITS-V2] getUserCredits - Saving default credits to Firestore...');
      await creditsRef.set(defaultCredits);
      logger.info({ userId }, '[CREDITS-V2] getUserCredits - ✅ Default credits saved to Firestore');
      return defaultCredits;
    } else {
      logger.error({ userId }, '[CREDITS-V2] getUserCredits - ❌ autoCreate=false, throwing error');
      // Don't auto-create - throw error
      throw new Error(`User credits not found for user ${userId}. User must be initialized first via /api/users/initialize`);
    }
  }
  
  logger.info({ userId }, '[CREDITS-V2] getUserCredits - ✅ Credits document exists, returning existing data');
  const creditsData = creditsDoc.data();
  const totalCredits = calculateTotal(creditsData.balances);
  logger.debug({ userId, totalCredits, breakdown: creditsData.balances }, '[CREDITS-V2] getUserCredits - Existing credits summary');
  
  // Enrich subscription data with details from subscriptions collection
  if (creditsData.subscription && creditsData.subscription.type === 'pro') {
    try {
      const subscriptionDoc = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).get();
      logger.debug({ userId, exists: subscriptionDoc.exists }, '[CREDITS-V2] getUserCredits - Checking subscriptions collection');
      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data();
        logger.debug({ userId, subDataKeys: Object.keys(subData) }, '[CREDITS-V2] getUserCredits - Subscription data keys from Firestore');
        
        // Determine renewal/end date - prioritize renews_at, then ends_at, then current_period_end
        const renewsAt = subData.renews_at || null;
        const endsAt = subData.ends_at || null;
        const currentPeriodEnd = subData.current_period_end || null;
        
        // For active subscriptions: use renews_at or current_period_end
        // For canceled subscriptions: use ends_at or current_period_end
        const cancelAtPeriodEnd = subData.cancel_at_period_end || false;
        let renewalDate = null;
        if (cancelAtPeriodEnd) {
          renewalDate = endsAt || currentPeriodEnd;
        } else {
          renewalDate = renewsAt || currentPeriodEnd;
        }
        
        // Calculate renewal date from purchase date + billing interval if not available
        let calculatedRenewalDate = renewalDate;
        if (!calculatedRenewalDate && subData.billing_interval) {
          // Try purchase_date first, then created_at, then updated_at
          let purchaseDate = null;
          if (subData.purchase_date) {
            purchaseDate = subData.purchase_date.toDate ? subData.purchase_date.toDate() : new Date(subData.purchase_date);
          } else if (subData.created_at) {
            purchaseDate = subData.created_at.toDate ? subData.created_at.toDate() : new Date(subData.created_at);
          } else if (subData.updated_at) {
            purchaseDate = subData.updated_at.toDate ? subData.updated_at.toDate() : new Date(subData.updated_at);
          }
          
          if (purchaseDate && !isNaN(purchaseDate.getTime())) {
            const billingInterval = subData.billing_interval.toLowerCase();
            const renewalDateCalc = new Date(purchaseDate);
            
            if (billingInterval === 'month' || billingInterval === 'monthly') {
              renewalDateCalc.setMonth(renewalDateCalc.getMonth() + 1);
            } else if (billingInterval === 'year' || billingInterval === 'yearly' || billingInterval === 'annual') {
              renewalDateCalc.setFullYear(renewalDateCalc.getFullYear() + 1);
            }
            
            calculatedRenewalDate = renewalDateCalc;
          }
        }
        
        // Merge subscription details
        creditsData.subscription = {
          ...creditsData.subscription,
          renewsAt: renewsAt || calculatedRenewalDate,
          endsAt: endsAt,
          cancelAtPeriodEnd: cancelAtPeriodEnd,
          lastOrderTotal: subData.last_order_total || null,
          currency: subData.currency || 'USD',
          billingInterval: subData.billing_interval || null,
          purchaseDate: subData.purchase_date || null,
          // Use the determined renewal date
          expiresAt: calculatedRenewalDate || renewalDate || creditsData.subscription.expiresAt || null
        };
        logger.info({ 
          userId, 
          renewsAt: renewsAt ? 'exists' : 'null',
          endsAt: endsAt ? 'exists' : 'null',
          currentPeriodEnd: currentPeriodEnd ? 'exists' : 'null',
          cancelAtPeriodEnd,
          finalExpiresAt: creditsData.subscription.expiresAt ? 'exists' : 'null'
        }, '[CREDITS-V2] getUserCredits - Enriched subscription data');
      } else {
        logger.warn({ userId }, '[CREDITS-V2] getUserCredits - No subscription document found in subscriptions collection');
      }
    } catch (error) {
      logger.warn({ userId, error: error.message }, '[CREDITS-V2] getUserCredits - Failed to fetch subscription details');
      // Continue without subscription details
    }
  }
  
  return creditsData;
}

/**
 * Get available credits for user
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Available credits info
 */
async function getAvailableCredits(userId) {
  const credits = await getUserCredits(userId);
  
  // Check subscription first - ensure subscription exists and is valid
  if (credits.subscription && credits.subscription.type === 'pro' && credits.subscription.status === 'active') {
    // Check if subscription expired
    if (credits.subscription.expiresAt) {
      let expiresAt;
      
      // Handle Firestore Timestamp
      if (credits.subscription.expiresAt.toDate && typeof credits.subscription.expiresAt.toDate === 'function') {
        expiresAt = credits.subscription.expiresAt.toDate();
      } else if (credits.subscription.expiresAt.seconds) {
        // Firestore Timestamp object with seconds
        expiresAt = new Date(credits.subscription.expiresAt.seconds * 1000);
      } else {
        // Try to parse as Date
        expiresAt = new Date(credits.subscription.expiresAt);
      }
      
      // Validate the date is valid
      if (!isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
        // Subscription expired, disable unlimited
        await updateSubscriptionStatus(userId, 'expired');
        return {
          unlimited: false,
          total: calculateTotal(credits.balances),
          breakdown: credits.balances
        };
      } else if (isNaN(expiresAt.getTime())) {
        // Invalid date - log warning and treat as unlimited
        logger.warn({ userId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V2] Invalid expiration date in getAvailableCredits, treating as unlimited');
      }
    }
    
    // No expiration or expiration is in the future - unlimited access
    return {
      unlimited: true,
      total: null,
      breakdown: null
    };
  }
  
  const total = calculateTotal(credits.balances);
  
  return {
    unlimited: false,
    total: total,
    breakdown: credits.balances
  };
}

/**
 * Update subscription status
 */
async function updateSubscriptionStatus(userId, status) {
  const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
  const credits = await getUserCredits(userId);
  
  // Ensure subscription exists before accessing properties
  if (status === 'expired' && credits.subscription && credits.subscription.type === 'pro') {
    // Restore preserved credits
    const preservedCredits = credits.subscription.preservedCredits || 0;
    if (preservedCredits > 0) {
      credits.balances.paid = (credits.balances.paid || 0) + preservedCredits;
    }
  }
  
  // Safely get subscription type
  const currentSubscriptionType = credits.subscription && credits.subscription.type ? credits.subscription.type : 'none';
  
  await creditsRef.update({
    'subscription.status': status,
    'subscription.type': status === 'expired' ? 'none' : currentSubscriptionType,
    'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Record ledger entry
 */
function recordLedgerEntry(transaction, entryData) {
  const ledgerRef = db.collection(LEDGER_COLLECTION).doc(entryData.transactionId);
  
  // Ensure source is a plain object (not a class instance or circular reference)
  let sourceData = entryData.source;
  if (sourceData && typeof sourceData === 'object') {
    // Convert to plain object to ensure Firestore compatibility
    sourceData = {
      type: sourceData.type || null,
      specId: sourceData.specId || null,
      orderId: sourceData.orderId || null,
      reason: sourceData.reason || null
    };
  } else if (!sourceData) {
    sourceData = null;
  }
  
  // Ensure balanceAfter is a plain object
  let balanceAfter = entryData.balanceAfter;
  if (balanceAfter && typeof balanceAfter === 'object' && !Array.isArray(balanceAfter)) {
    // Safely extract balance values
    balanceAfter = {
      paid: typeof balanceAfter.paid === 'number' ? balanceAfter.paid : 0,
      free: typeof balanceAfter.free === 'number' ? balanceAfter.free : 0,
      bonus: typeof balanceAfter.bonus === 'number' ? balanceAfter.bonus : 0
    };
  } else {
    // Default to zero balances if not provided or invalid
    balanceAfter = { paid: 0, free: 0, bonus: 0 };
  }
  
  const ledgerEntry = {
    id: entryData.transactionId,
    userId: entryData.userId,
    type: entryData.type,
    amount: entryData.amount,
    creditType: entryData.creditType,
    source: sourceData,
    balanceAfter: balanceAfter,
    metadata: entryData.metadata || {},
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  transaction.set(ledgerRef, ledgerEntry);
}

/**
 * Consume a credit when creating a spec
 * @param {string} userId - Firebase user ID
 * @param {string} specId - Specification ID
 * @param {Object} options - Options (priority, etc.)
 * @returns {Promise<Object>} - Result with success status and remaining credits
 */
async function consumeCredit(userId, specId, options = {}) {
  const requestId = `consume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  logger.info({ requestId, userId, specId }, '[CREDITS-V2] Consume credit');
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!specId || typeof specId !== 'string' || specId.trim().length === 0) {
      throw new Error('Invalid specId');
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId('consume', specId, userId);
    
    // Ensure user_credits exists (will migrate from old system if needed)
    // This must be done BEFORE the transaction to ensure migration happens
    await getUserCredits(userId);
    
    // Check if user already has a spec BEFORE transaction (can't use queries in transaction)
    // If specId starts with "temp-", it's a new spec creation attempt
    let existingSpecId = null;
    let creditAlreadyConsumed = false;
    
    if (specId.startsWith('temp-')) {
      // Check if user already has a spec
      const specsQuery = db.collection('specs').where('userId', '==', userId).limit(1);
      const existingSpecsSnapshot = await specsQuery.get();
      
      if (!existingSpecsSnapshot.empty) {
        existingSpecId = existingSpecsSnapshot.docs[0].id;
        logger.warn({ requestId, userId, existingSpecId }, '[CREDITS-V2] User already has a spec, checking if credit was consumed...');
        
        // Check if credit was already consumed recently (within last 10 minutes) for this user
        // This handles the case where spec was created but consumeCredit failed or wasn't called
        const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
        const ledgerQuery = db.collection(LEDGER_COLLECTION)
          .where('userId', '==', userId)
          .where('type', '==', 'consume')
          .where('timestamp', '>=', tenMinutesAgo)
          .orderBy('timestamp', 'desc')
          .limit(1);
        const ledgerSnapshot = await ledgerQuery.get();
        
        if (!ledgerSnapshot.empty) {
          // Credit was already consumed recently for this user
          creditAlreadyConsumed = true;
          logger.info({ requestId, userId, existingSpecId }, '[CREDITS-V2] Credit already consumed recently for this user, returning success (idempotency)');
          const ledgerEntry = ledgerSnapshot.docs[0].data();
          const credits = await getUserCredits(userId);
          const remaining = calculateTotal(credits.balances);
          
          return {
            success: true,
            alreadyProcessed: true,
            transactionId: ledgerEntry.id,
            remaining: remaining,
            creditType: ledgerEntry.creditType || 'free',
            unlimited: false
          };
        } else {
          // Spec exists but credit wasn't consumed - we'll consume it in the transaction
          logger.warn({ requestId, userId, existingSpecId }, '[CREDITS-V2] Spec exists but credit not consumed - will consume credit now to fix inconsistency');
        }
      }
    }
    
    // Use Firestore transaction for atomic credit consumption
    logger.debug({ requestId, userId, specId, transactionId }, '[CREDITS-V2] Before runTransaction');
    
    const result = await db.runTransaction(async (transaction) => {
      logger.debug({ requestId }, '[CREDITS-V2] Inside transaction');
      
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        logger.info({ requestId, transactionId }, '[CREDITS-V2] Transaction already processed (consume)');
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          remaining: existing.balanceAfter ? calculateTotal(existing.balanceAfter) : null,
          creditType: existing.creditType,
          unlimited: false
        };
      }
      
      // Check if user already has a spec (only one spec per user allowed)
      // Only check if we didn't already check above (for non-temp specIds)
      if (!specId.startsWith('temp-')) {
        const specsQuery = db.collection('specs').where('userId', '==', userId).limit(1);
        const existingSpecsSnapshot = await transaction.get(specsQuery);
        
        if (!existingSpecsSnapshot.empty) {
          const existingSpecId = existingSpecsSnapshot.docs[0].id;
          logger.warn({ requestId, userId, existingSpecId }, '[CREDITS-V2] User already has a spec');
          throw new Error('User already has a spec. Only one spec per user is allowed.');
        }
      }
      
      // Get user credits (should exist now after migration)
      const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      if (!creditsDoc.exists) {
        // This shouldn't happen if getUserCredits worked, but handle gracefully
        logger.warn({ requestId, userId }, '[CREDITS-V2] user_credits document missing, creating default');
        const defaultCredits = getDefaultCredits(userId);
        transaction.set(creditsRef, defaultCredits);
        throw new Error('Insufficient credits');
      }
      
      const credits = creditsDoc.data();
      
      // Ensure balances exist
      if (!credits.balances) {
        logger.warn({ requestId, userId, creditsKeys: Object.keys(credits || {}) }, '[CREDITS-V2] Credits document missing balances, creating default structure');
        credits.balances = {
          paid: 0,
          free: 0,
          bonus: 0
        };
      }
      
      // Ensure subscription exists
      if (!credits.subscription) {
        logger.warn({ requestId, userId }, '[CREDITS-V2] Credits document missing subscription, creating default');
        credits.subscription = {
          type: 'none',
          status: 'none',
          expiresAt: null,
          preservedCredits: 0
        };
      }
      
      logger.info({ 
        requestId, 
        userId,
        subscriptionType: credits.subscription?.type, 
        subscriptionStatus: credits.subscription?.status, 
        balances: credits.balances,
        hasExpiresAt: !!credits.subscription?.expiresAt
      }, '[CREDITS-V2] Credits data in transaction');
      
      // Check subscription first - ensure subscription exists and is valid
      if (credits.subscription && credits.subscription.type === 'pro' && credits.subscription.status === 'active') {
        logger.debug({ requestId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V2] Pro subscription detected');
        
        let isExpired = false;
        let hasValidExpiration = false;
        
        // Check expiration
        if (credits.subscription.expiresAt) {
          let expiresAt;
          
          // Handle Firestore Timestamp
          if (credits.subscription.expiresAt.toDate && typeof credits.subscription.expiresAt.toDate === 'function') {
            expiresAt = credits.subscription.expiresAt.toDate();
          } else if (credits.subscription.expiresAt.seconds) {
            // Firestore Timestamp object with seconds
            expiresAt = new Date(credits.subscription.expiresAt.seconds * 1000);
          } else {
            // Try to parse as Date
            expiresAt = new Date(credits.subscription.expiresAt);
          }
          
          // Validate the date is valid
          if (isNaN(expiresAt.getTime())) {
            // Invalid date - log warning and treat as no expiration (unlimited)
            logger.warn({ requestId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V2] Invalid expiration date, treating as unlimited');
            hasValidExpiration = false;
          } else {
            hasValidExpiration = true;
            logger.debug({ requestId, expiresAt: expiresAt.toISOString(), isExpired: expiresAt < new Date() }, '[CREDITS-V2] ExpiresAt conversion');
            
            if (expiresAt < new Date()) {
              // Subscription expired
              isExpired = true;
              logger.debug({ requestId }, '[CREDITS-V2] Subscription expired, continuing to check credits');
            }
          }
        }
        
        // If subscription is not expired (either no expiration date, invalid date treated as unlimited, or valid date in future)
        if (!hasValidExpiration || !isExpired) {
          // Unlimited access - record transaction
          logger.debug({ requestId, transactionId, userId, specId }, '[CREDITS-V2] Pro user - granting unlimited access');
          
          recordLedgerEntry(transaction, {
            transactionId: transactionId,
            userId: userId,
            type: 'consume',
            amount: 1,
            creditType: 'paid',
            source: {
              type: 'spec_creation',
              specId: specId,
              orderId: null,
              reason: 'unlimited_subscription'
            },
            balanceAfter: credits.balances,
            metadata: {
              notes: 'Unlimited subscription'
            }
          });
          
          logger.debug({ requestId }, '[CREDITS-V2] After recordLedgerEntry for unlimited');
          
          return {
            success: true,
            remaining: null,
            creditType: 'unlimited',
            unlimited: true,
            transactionId: transactionId
          };
        }
        // If expired, continue to regular credit consumption below
      }
      
      // Ensure balances exist before selecting credit type
      if (!credits.balances) {
        logger.error({ requestId, userId }, '[CREDITS-V2] Credits balances missing after subscription check');
        credits.balances = {
          paid: 0,
          free: 0,
          bonus: 0
        };
      }
      
      logger.debug({ requestId, balances: credits.balances, priority: options.priority }, '[CREDITS-V2] Before selectCreditType');
      
      // Select credit type to consume
      const priority = options.priority || ['free', 'bonus', 'paid'];
      const creditType = selectCreditType(credits.balances, priority);
      
      logger.debug({ requestId, creditType, balances: credits.balances }, '[CREDITS-V2] After selectCreditType');
      
      if (!creditType) {
        logger.warn({ requestId, userId, balances: credits.balances }, '[CREDITS-V2] No credits available to consume');
        throw new Error('Insufficient credits');
      }
      
      // Consume credit - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      
      logger.debug({ requestId, creditType, currentBalance, newBalance: Math.max(0, currentBalance - 1) }, '[CREDITS-V2] Before consuming credit');
      const newBalance = Math.max(0, currentBalance - 1);
      
      // Update credits - use increment for atomic update to ensure consistency
      if (!creditsDoc.exists) {
        // Create new document with updated balances
        credits.balances[creditType] = newBalance;
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditConsume': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Use increment for atomic update - more reliable than setting absolute values
        const updateData = {
          [`balances.${creditType}`]: admin.firestore.FieldValue.increment(-1),
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditConsume': admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.update(creditsRef, updateData);
        
        // Update local credits object for return value
        credits.balances[creditType] = newBalance;
      }
      
      // Record in ledger
      recordLedgerEntry(transaction, {
        transactionId: transactionId,
        userId: userId,
        type: 'consume',
        amount: 1,
        creditType: creditType,
        source: {
          type: 'spec_creation',
          specId: specId,
          orderId: null,
          reason: null
        },
        balanceAfter: credits.balances,
        metadata: {}
      });
      
      const remaining = calculateTotal(credits.balances);
      
      return {
        success: true,
        remaining: remaining,
        creditType: creditType,
        unlimited: false,
        breakdown: credits.balances,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ 
      requestId, 
      userId, 
      specId,
      totalTime, 
      result: {
        success: result.success,
        unlimited: result.unlimited,
        creditType: result.creditType,
        remaining: result.remaining,
        alreadyProcessed: result.alreadyProcessed
      }
    }, '[CREDITS-V2] Credit consumed successfully');
    
    // Record credit consumption activity (if not unlimited)
    if (result.success && !result.unlimited && result.creditType) {
      try {
        // Get user email and spec title
        const [userDoc, specDoc] = await Promise.all([
          db.collection(USERS_COLLECTION).doc(userId).get(),
          specId && !specId.startsWith('temp-') ? db.collection('specs').doc(specId).get() : Promise.resolve({ exists: false })
        ]);
        
        const userEmail = userDoc.exists ? userDoc.data().email : null;
        const specTitle = specDoc.exists ? specDoc.data().title : null;
        
        recordCreditConsumption(
          userId,
          userEmail,
          specId,
          specTitle,
          result.creditType,
          {
            transactionId: result.transactionId,
            remaining: result.remaining
          }
        ).catch(err => {
          logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to record credit consumption activity');
        });
      } catch (err) {
        logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to get user/spec data for activity recording');
      }
    }
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ 
      requestId, 
      userId, 
      specId,
      totalTime, 
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack
      }
    }, '[CREDITS-V2] ❌ Error consuming credit');
    
    // Re-throw known errors
    if (error.message === 'Insufficient credits') {
      throw new Error('Insufficient credits');
    }
    
    if (error.message === 'User already has a spec. Only one spec per user is allowed.') {
      throw new Error('User already has a spec. Only one spec per user is allowed.');
    }
    
    // For unknown errors, wrap with more context
    const errorMessage = error.message || 'Unknown error occurred';
    logger.error({ requestId, userId, specId, originalError: error }, '[CREDITS-V2] Unexpected error in consumeCredit');
    throw new Error(`Failed to consume credit: ${errorMessage}`);
  }
}

/**
 * Grant credits to a user
 * @param {string} userId - Firebase user ID
 * @param {number} amount - Number of credits to grant (must be positive)
 * @param {string} source - Source of credits: 'admin', 'purchase', 'promotion', etc.
 * @param {Object} metadata - Additional metadata (orderId, creditType, etc.)
 * @returns {Promise<Object>} - Result with success status and details
 */
async function grantCredits(userId, amount, source, metadata = {}) {
  const requestId = `grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  logger.info({ requestId, userId, amount, source }, '[CREDITS-V2] Grant credits');
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Amount must be a positive integer');
    }
    
    // Prevent overflow
    const MAX_CREDITS_PER_GRANT = 1000;
    if (amount > MAX_CREDITS_PER_GRANT) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_GRANT})`);
    }
    
    // Generate transaction ID
    const transactionId = metadata.transactionId || generateTransactionId('grant', metadata.orderId, userId);
    
    // Ensure user_credits exists (will migrate from old system if needed)
    // This must be done BEFORE the transaction to ensure migration happens
    await getUserCredits(userId);
    
    // Use Firestore transaction for atomic credit grant
    const result = await db.runTransaction(async (transaction) => {
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        logger.info({ requestId, transactionId }, '[CREDITS-V2] Transaction already processed (grant)');
        
        // Get current credits to return actual state
        const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
        const creditsDoc = await transaction.get(creditsRef);
        const currentCredits = creditsDoc.exists ? creditsDoc.data() : getDefaultCredits(userId);
        
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsAdded: existing.amount,
          remaining: calculateTotal(currentCredits.balances),
          breakdown: currentCredits.balances
        };
      }
      
      // Get user credits (should exist now after migration)
      const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      if (!creditsDoc.exists) {
        // This shouldn't happen if getUserCredits worked, but handle gracefully
        logger.warn({ requestId, userId }, '[CREDITS-V2] user_credits document missing, creating default');
        const defaultCredits = getDefaultCredits(userId);
        transaction.set(creditsRef, defaultCredits);
        return {
          success: true,
          creditsAdded: amount,
          creditType: determineCreditType(source, metadata),
          total: amount,
          breakdown: defaultCredits.balances,
          transactionId: transactionId
        };
      }
      
      const credits = creditsDoc.data();
      
      // Determine credit type
      const creditType = determineCreditType(source, metadata);
      
      // Grant credits - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      const newBalance = currentBalance + amount;
      
      // Update credits - use increment for atomic update to ensure consistency
      if (!creditsDoc.exists) {
        // Create new document with updated balances
        credits.balances[creditType] = newBalance;
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Use increment for atomic update - more reliable than setting absolute values
        const updateData = {
          [`balances.${creditType}`]: admin.firestore.FieldValue.increment(amount),
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.update(creditsRef, updateData);
        
        // Update local credits object for return value
        credits.balances[creditType] = newBalance;
      }
      
      // Record in ledger
      recordLedgerEntry(transaction, {
        transactionId: transactionId,
        userId: userId,
        type: 'grant',
        amount: amount,
        creditType: creditType,
        source: {
          type: source,
          orderId: metadata.orderId || null,
          specId: null,
          reason: metadata.reason || null
        },
        balanceAfter: credits.balances,
        metadata: {
          expiresAt: metadata.expiresAt || null,
          notes: metadata.notes || null
        }
      });
      
      const total = calculateTotal(credits.balances);
      
      return {
        success: true,
        creditsAdded: amount,
        creditType: creditType,
        total: total,
        breakdown: credits.balances,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ requestId, totalTime, result }, '[CREDITS-V2] Credits granted successfully');
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ requestId, totalTime, error: error.message, stack: error.stack }, '[CREDITS-V2] Error granting credits');
    throw error;
  }
}

/**
 * Refund credits to a user
 * @param {string} userId - Firebase user ID
 * @param {number} amount - Number of credits to refund (must be positive)
 * @param {string} reason - Reason for refund
 * @param {string} originalTransactionId - Original transaction ID to refund
 * @returns {Promise<Object>} - Result with success status and details
 */
async function refundCredit(userId, amount, reason, originalTransactionId = null) {
  const requestId = `refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  logger.info({ requestId, userId, amount, reason }, '[CREDITS-V2] Refund credit');
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Amount must be a positive integer');
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Reason is required and must be a non-empty string');
    }
    
    // Prevent overflow
    const MAX_CREDITS_PER_REFUND = 1000;
    if (amount > MAX_CREDITS_PER_REFUND) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_REFUND})`);
    }
    
    // If originalTransactionId is provided, verify it exists
    if (originalTransactionId) {
      const originalLedgerDoc = await db.collection(LEDGER_COLLECTION).doc(originalTransactionId).get();
      
      if (!originalLedgerDoc.exists) {
        throw new Error(`Original transaction ${originalTransactionId} not found`);
      }
      
      const originalTransaction = originalLedgerDoc.data();
      
      // Verify the transaction belongs to this user
      if (originalTransaction.userId !== userId) {
        throw new Error('Original transaction does not belong to this user');
      }
      
      // Verify it's a consume transaction
      if (originalTransaction.type !== 'consume') {
        throw new Error(`Cannot refund transaction of type ${originalTransaction.type}. Only consume transactions can be refunded.`);
      }
      
      // Check if already refunded
      const refundQuery = await db.collection(LEDGER_COLLECTION)
        .where('metadata.originalTransactionId', '==', originalTransactionId)
        .where('type', '==', 'refund')
        .limit(1)
        .get();
      
      if (!refundQuery.empty) {
        throw new Error(`Transaction ${originalTransactionId} was already refunded`);
      }
      
      // Verify refund amount doesn't exceed original amount
      const originalAmount = originalTransaction.amount || 0;
      if (amount > originalAmount) {
        throw new Error(`Refund amount (${amount}) cannot exceed original transaction amount (${originalAmount})`);
      }
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId('refund', originalTransactionId, userId);
    
    // Use Firestore transaction for atomic credit refund
    const result = await db.runTransaction(async (transaction) => {
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsRefunded: existing.amount,
          remaining: existing.balanceAfter ? calculateTotal(existing.balanceAfter) : null
        };
      }
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      const credits = creditsDoc.exists
        ? creditsDoc.data()
        : getDefaultCredits(userId);
      
      // Determine credit type (default to paid for refunds)
      const creditType = 'paid';
      
      // Grant credits (refund = grant) - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      const newBalance = currentBalance + amount;
      
      // Update credits - use increment for atomic update to ensure consistency
      if (!creditsDoc.exists) {
        // Create new document with updated balances
        credits.balances[creditType] = newBalance;
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Use increment for atomic update - more reliable than setting absolute values
        const updateData = {
          [`balances.${creditType}`]: admin.firestore.FieldValue.increment(amount),
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.update(creditsRef, updateData);
        
        // Update local credits object for return value
        credits.balances[creditType] = newBalance;
      }
      
      // Record in ledger
      recordLedgerEntry(transaction, {
        transactionId: transactionId,
        userId: userId,
        type: 'refund',
        amount: amount,
        creditType: creditType,
        source: {
          type: 'refund',
          orderId: null,
          specId: null,
          reason: reason
        },
        balanceAfter: credits.balances,
        metadata: {
          originalTransactionId: originalTransactionId,
          notes: `Refund: ${reason}`
        }
      });
      
      const total = calculateTotal(credits.balances);
      
      return {
        success: true,
        creditsRefunded: amount,
        total: total,
        breakdown: credits.balances,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ requestId, totalTime, result }, '[CREDITS-V2] Credits refunded successfully');
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ requestId, totalTime, error: error.message, stack: error.stack }, '[CREDITS-V2] Error refunding credits');
    throw error;
  }
}

/**
 * Get credit ledger for a user
 * @param {string} userId - Firebase user ID
 * @param {Object} filters - Filters (limit, offset, type, creditType)
 * @returns {Promise<Object>} - Ledger entries
 */
async function getCreditLedger(userId, filters = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId');
  }
  
  const limit = Math.min(filters.limit || 50, 100);
  const offset = filters.offset || 0;
  
  let query = db.collection(LEDGER_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(limit);
  
  if (filters.type) {
    query = query.where('type', '==', filters.type);
  }
  
  if (filters.creditType) {
    query = query.where('creditType', '==', filters.creditType);
  }
  
  const snapshot = await query.get();
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  return {
    transactions: transactions,
    count: transactions.length,
    limit: limit,
    hasMore: transactions.length === limit
  };
}

/**
 * Enable Pro subscription
 */
async function enableProSubscription(userId, options = {}) {
  const {
    plan = 'pro',
    variantId = null,
    productKey = null,
    productName = null,
    productType = null,
    productId = null,
    orderId = null,
    subscriptionId = null,
    subscriptionStatus = 'active',
    subscriptionInterval = null,
    currentPeriodEnd = null,
    cancelAtPeriodEnd = false,
    total = null,
    currency = 'USD',
    metadata = {}
  } = options;
  
  if (!userId) {
    throw new Error('enableProSubscription requires userId');
  }
  
  const requestId = `pro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId }, '[CREDITS-V2] Enabling Pro access');
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    
    const creditsDoc = await transaction.get(creditsRef);
    const credits = creditsDoc.exists
      ? creditsDoc.data()
      : getDefaultCredits(userId);
    
    const currentCredits = calculateTotal(credits.balances);
    const alreadyUnlimited = credits.subscription.type === 'pro' && credits.subscription.status === 'active';
    
    // Preserve current credits
    const preservedCredits = currentCredits;
    
    // Update credits
    const creditsUpdate = {
      'subscription.type': 'pro',
      'subscription.status': subscriptionStatus,
      'subscription.expiresAt': currentPeriodEnd || null,
      'subscription.preservedCredits': preservedCredits,
      'permissions.canEdit': true,
      'permissions.canCreateUnlimited': true,
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    };
    
    transaction.set(creditsRef, creditsUpdate, { merge: true });
    
    // Calculate purchase date (use current timestamp if not provided)
    const purchaseDate = admin.firestore.FieldValue.serverTimestamp();
    
    // Update subscription document
    const subscriptionData = {
      userId,
      product_id: productId || null,
      product_key: productKey || null,
      product_name: productName || null,
      product_type: productType || null,
      variant_id: variantId ? variantId.toString() : null,
      status: subscriptionStatus || 'active',
      billing_interval: subscriptionInterval || null,
      lemon_subscription_id: subscriptionId || null,
      last_order_id: orderId || null,
      last_order_total: typeof total === 'number' ? total : null,
      currency: currency || 'USD',
      cancel_at_period_end: !!cancelAtPeriodEnd,
      purchase_date: purchaseDate, // Store purchase date for renewal calculation
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (currentPeriodEnd) {
      subscriptionData.current_period_end = currentPeriodEnd;
    }
    
    transaction.set(subscriptionRef, subscriptionData, { merge: true });
    
    // Update users.plan to 'pro'
    transaction.update(userRef, { plan: 'pro' });
    
    return {
      previouslyUnlimited: alreadyUnlimited,
      previousCredits: currentCredits,
      preservedCredits: preservedCredits
    };
  });
  
  logger.info({ requestId, userId, result }, '[CREDITS-V2] Pro access enabled');
  
  // Record activity for subscription activation
  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const userEmail = userDoc.exists ? userDoc.data().email : null;
    
    recordSubscriptionChange(
      userId,
      userEmail,
      'pro',
      subscriptionStatus || 'active',
      {
        subscriptionId,
        productKey,
        productName,
        variantId,
        subscriptionInterval,
        orderId
      }
    ).catch(err => {
      logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to record subscription activation activity');
    });
  } catch (err) {
    logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to get user email for activity recording');
  }
  
  return result;
}

/**
 * Disable Pro subscription
 */
async function disableProSubscription(userId, options = {}) {
  const {
    plan = 'free',
    subscriptionId = null,
    cancelReason = 'user_requested',
    restoreCredits = null
  } = options;
  
  if (!userId) {
    throw new Error('disableProSubscription requires userId');
  }
  
  const requestId = `disable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId }, '[CREDITS-V2] Disabling Pro access');
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    
    const creditsDoc = await transaction.get(creditsRef);
    const credits = creditsDoc.exists
      ? creditsDoc.data()
      : getDefaultCredits(userId);
    
    const preservedCredits = credits.subscription.preservedCredits || 0;
    const creditsToRestore = restoreCredits !== null ? restoreCredits : preservedCredits;
    
    // Restore credits if any
    if (creditsToRestore > 0) {
      credits.balances.paid = (credits.balances.paid || 0) + creditsToRestore;
    }
    
    // Update credits
    transaction.set(creditsRef, {
      'subscription.type': 'none',
      'subscription.status': 'cancelled',
      'subscription.expiresAt': null,
      'subscription.preservedCredits': 0,
      'permissions.canEdit': false,
      'permissions.canCreateUnlimited': false,
      balances: credits.balances,
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Update subscription document
    transaction.set(subscriptionRef, {
      status: 'cancelled',
      cancel_reason: cancelReason,
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Update users.plan to 'free'
    transaction.update(userRef, { plan: 'free' });
    
    return {
      restoredCredits: creditsToRestore,
      previousCredits: preservedCredits
    };
  });
  
  logger.info({ requestId, userId, result }, '[CREDITS-V2] Pro access disabled');
  
  // Record activity for subscription cancellation
  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const userEmail = userDoc.exists ? userDoc.data().email : null;
    
    recordSubscriptionChange(
      userId,
      userEmail,
      'pro',
      'cancelled',
      {
        subscriptionId,
        cancelReason,
        restoredCredits: creditsToRestore
      }
    ).catch(err => {
      logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to record subscription cancellation activity');
    });
  } catch (err) {
    logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V2] Failed to get user email for activity recording');
  }
  
  return result;
}

module.exports = {
  getUserCredits,
  getAvailableCredits,
  consumeCredit,
  grantCredits,
  refundCredit,
  getCreditLedger,
  enableProSubscription,
  disableProSubscription,
  selectCreditType,
  calculateTotal,
  getInitialCreditsForNewUser,
  getDefaultCredits
};
