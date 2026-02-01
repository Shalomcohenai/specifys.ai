const { db, admin } = require('./firebase-admin');
const crypto = require('crypto');
const { logger } = require('./logger');
const { recordSubscriptionChange, recordCreditConsumption } = require('./admin-activity-service');

// V3 Collections - new structure with single source of truth
const CREDITS_COLLECTION_V3 = 'user_credits_v3';
const LEDGER_COLLECTION_V3 = 'credit_ledger_v3';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION_V3 = 'subscriptions_v3'; // Archive/logs only

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
  logger.info({ userId }, '[CREDITS-V3] getDefaultCredits called - Creating default credits with 0 credits (fallback)');
  
  const creditsStructure = {
    userId: userId,
    balances: {
      paid: 0,
      free: 0,
      bonus: 0
    },
    total: 0,  // Single source of truth - computed field
    subscription: {
      type: 'none',
      status: 'none',
      expiresAt: null,
      preservedCredits: 0,
      lemonSubscriptionId: null,
      lastSyncedAt: null,
      productKey: null,
      productName: null,
      billingInterval: null,
      renewsAt: null,
      endsAt: null,
      cancelAtPeriodEnd: false
    },
    permissions: {
      canEdit: false,
      canCreateUnlimited: false
    },
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: null,
      migrationTimestamp: null,
      lastCreditGrant: null,
      lastCreditConsume: null,
      welcomeCreditGranted: false
    }
  };
  
  logger.info({ userId, freeCredits: 0, paidCredits: 0, bonusCredits: 0 }, '[CREDITS-V3] getDefaultCredits - Default credits structure created (0 credits)');
  
  return creditsStructure;
}

/**
 * Get initial credits structure for new user (with 1 free welcome credit)
 * This should be used when creating a new user during registration
 */
function getInitialCreditsForNewUser(userId) {
  logger.info({ userId }, '[CREDITS-V3] getInitialCreditsForNewUser called - Creating initial credits with 1 free welcome credit');
  
  const creditsStructure = {
    userId: userId,
    balances: {
      paid: 0,
      free: 1,  // Welcome credit for new users
      bonus: 0
    },
    total: 1,  // Single source of truth - computed field (1 free credit)
    subscription: {
      type: 'none',
      status: 'none',
      expiresAt: null,
      preservedCredits: 0,
      lemonSubscriptionId: null,
      lastSyncedAt: null,
      productKey: null,
      productName: null,
      billingInterval: null,
      renewsAt: null,
      endsAt: null,
      cancelAtPeriodEnd: false
    },
    permissions: {
      canEdit: false,
      canCreateUnlimited: false
    },
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: null,
      migrationTimestamp: null,
      lastCreditGrant: admin.firestore.FieldValue.serverTimestamp(),
      lastCreditConsume: null,
      welcomeCreditGranted: true  // Flag to prevent duplicate grants
    }
  };
  
  logger.info({ userId, freeCredits: 1, paidCredits: 0, bonusCredits: 0 }, '[CREDITS-V3] getInitialCreditsForNewUser - Initial credits structure created successfully');
  
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
  if (!balances || typeof balances !== 'object') {
    return null;
  }
  
  // Check each credit type in priority order
  for (const type of priority) {
    if (balances[type] && balances[type] > 0) {
      return type;
    }
  }
  
  return null;
}

/**
 * Determine credit type based on source and metadata
 */
function determineCreditType(source, metadata = {}) {
  // Explicit credit type in metadata takes precedence
  if (metadata.creditType && ['paid', 'free', 'bonus'].includes(metadata.creditType)) {
    return metadata.creditType;
  }
  
  // Determine based on source
  if (source === 'purchase' || source === 'admin_purchase') {
    return 'paid';
  } else if (source === 'promotion' || source === 'admin_promotion') {
    return 'bonus';
  } else {
    return 'free';
  }
}

/**
 * Get user credits from V3 collection
 * @param {string} userId - Firebase user ID
 * @param {boolean} autoCreate - Whether to auto-create if not found
 * @returns {Promise<Object>} - User credits data
 */
async function getUserCredits(userId, autoCreate = true) {
  logger.info({ userId, autoCreate }, '[CREDITS-V3] getUserCredits called');
  
  if (!userId || typeof userId !== 'string') {
    logger.error({ userId }, '[CREDITS-V3] getUserCredits - Invalid userId');
    throw new Error('Invalid userId');
  }
  
  logger.debug({ userId }, '[CREDITS-V3] getUserCredits - Fetching credits document from Firestore...');
  const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
  const creditsDoc = await creditsRef.get();
  
  if (!creditsDoc.exists) {
    logger.warn({ userId }, '[CREDITS-V3] getUserCredits - Credits document does NOT exist');
    
    if (autoCreate) {
      // Check if user document exists
      logger.info({ userId }, '[CREDITS-V3] getUserCredits - Checking if user is initialized...');
      const userRef = db.collection(USERS_COLLECTION).doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        // User doesn't exist in Firestore - still create default credits
        // This handles cases where user was created in Auth but initialize failed
        logger.warn({ userId }, '[CREDITS-V3] getUserCredits - ⚠️ User not initialized in Firestore, but autoCreate=true - creating default credits anyway');
        const defaultCredits = getDefaultCredits(userId);
        logger.info({ userId }, '[CREDITS-V3] getUserCredits - Saving default credits to Firestore...');
        await creditsRef.set(defaultCredits);
        logger.info({ userId }, '[CREDITS-V3] getUserCredits - ✅ Default credits saved to Firestore (user not in Firestore yet)');
        return defaultCredits;
      }
      
      // User exists - create default credits
      logger.warn({ userId }, '[CREDITS-V3] getUserCredits - ⚠️ autoCreate=true, user exists but credits do not exist, creating default credits (0)');
      const defaultCredits = getDefaultCredits(userId);
      logger.info({ userId }, '[CREDITS-V3] getUserCredits - Saving default credits to Firestore...');
      await creditsRef.set(defaultCredits);
      logger.info({ userId }, '[CREDITS-V3] getUserCredits - ✅ Default credits saved to Firestore');
      return defaultCredits;
    } else {
      logger.error({ userId }, '[CREDITS-V3] getUserCredits - ❌ autoCreate=false, throwing error');
      throw new Error(`User credits not found for user ${userId}. User must be initialized first via /api/users/initialize`);
    }
  }
  
  logger.info({ userId }, '[CREDITS-V3] getUserCredits - ✅ Credits document exists, returning existing data');
  const creditsData = creditsDoc.data();
  const totalCredits = calculateTotal(creditsData.balances);
  logger.debug({ userId, totalCredits, breakdown: creditsData.balances }, '[CREDITS-V3] getUserCredits - Existing credits summary');
  
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
  // "paid" status also means active subscription
  if (credits.subscription && credits.subscription.type === 'pro' && 
      (credits.subscription.status === 'active' || credits.subscription.status === 'paid')) {
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
        // Use total from document if available, otherwise calculate
        const total = credits.total !== undefined ? credits.total : calculateTotal(credits.balances);
        return {
          unlimited: false,
          total: total,
          breakdown: credits.balances
        };
      } else if (isNaN(expiresAt.getTime())) {
        // Invalid date - log warning and treat as unlimited
        logger.warn({ userId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V3] Invalid expiration date in getAvailableCredits, treating as unlimited');
      }
    }
    
    // No expiration or expiration is in the future - unlimited access
    return {
      unlimited: true,
      total: null,
      breakdown: null
    };
  }
  
  // Use total from document if available, otherwise calculate (for backward compatibility)
  const total = credits.total !== undefined ? credits.total : calculateTotal(credits.balances);
  
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
  const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
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
  
  // Update nested objects properly (not flat paths)
  // Preserve existing subscription data if it exists
  const subscriptionUpdate = credits.subscription ? {
    ...credits.subscription,
    status: status,
    type: status === 'expired' ? 'none' : currentSubscriptionType
  } : {
    type: status === 'expired' ? 'none' : currentSubscriptionType,
    status: status,
    expiresAt: null,
    preservedCredits: 0,
    lemonSubscriptionId: null,
    lastSyncedAt: null,
    productKey: null,
    productName: null,
    billingInterval: null,
    renewsAt: null,
    endsAt: null,
    cancelAtPeriodEnd: false
  };
  
  await creditsRef.update({
    subscription: subscriptionUpdate,
    balances: credits.balances, // Preserve balances
    'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Record ledger entry
 */
function recordLedgerEntry(transaction, entryData) {
  const ledgerRef = db.collection(LEDGER_COLLECTION_V3).doc(entryData.transactionId);
  
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
  
  logger.info({ requestId, userId, specId }, '[CREDITS-V3] Consume credit');
  
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
    
    // Ensure user_credits exists
    await getUserCredits(userId);
    
    // Note: Idempotency is handled in the transaction below using transactionId
    // No need to check ledger before transaction - transaction itself checks idempotency
    
    // Use Firestore transaction for atomic credit consumption
    logger.debug({ requestId, userId, specId, transactionId }, '[CREDITS-V3] Before runTransaction');
    
    const result = await db.runTransaction(async (transaction) => {
      logger.debug({ requestId }, '[CREDITS-V3] Inside transaction');
      
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION_V3).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        logger.info({ requestId, transactionId }, '[CREDITS-V3] Transaction already processed (consume)');
        // Calculate remaining from balanceAfter in ledger, or get current credits
        let remaining = null;
        if (existing.balanceAfter) {
          remaining = calculateTotal(existing.balanceAfter);
        } else {
          // Fallback: get current credits total
          const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
          const creditsDoc = await transaction.get(creditsRef);
          if (creditsDoc.exists) {
            const credits = creditsDoc.data();
            remaining = credits.total !== undefined ? credits.total : calculateTotal(credits.balances || {});
          }
        }
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          remaining: remaining,
          creditType: existing.creditType || 'free',
          unlimited: false
        };
      }
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      if (!creditsDoc.exists) {
        logger.warn({ requestId, userId }, '[CREDITS-V3] user_credits document missing, creating default');
        const defaultCredits = getDefaultCredits(userId);
        transaction.set(creditsRef, defaultCredits);
        throw new Error('Insufficient credits');
      }
      
      const credits = creditsDoc.data();
      
      // Ensure balances exist
      if (!credits.balances) {
        logger.warn({ requestId, userId }, '[CREDITS-V3] Credits document missing balances, creating default structure');
        credits.balances = {
          paid: 0,
          free: 0,
          bonus: 0
        };
      }
      
      // Ensure subscription exists
      if (!credits.subscription) {
        logger.warn({ requestId, userId }, '[CREDITS-V3] Credits document missing subscription, creating default');
        credits.subscription = {
          type: 'none',
          status: 'none',
          expiresAt: null,
          preservedCredits: 0,
          lemonSubscriptionId: null,
          lastSyncedAt: null,
          productKey: null,
          productName: null,
          billingInterval: null,
          renewsAt: null,
          endsAt: null,
          cancelAtPeriodEnd: false
        };
      }
      
      logger.info({ 
        requestId, 
        userId,
        subscriptionType: credits.subscription?.type, 
        subscriptionStatus: credits.subscription?.status, 
        balances: credits.balances,
        hasExpiresAt: !!credits.subscription?.expiresAt
      }, '[CREDITS-V3] Credits data in transaction');
      
      // Check subscription first - ensure subscription exists and is valid
      // "paid" status also means active subscription
      if (credits.subscription && credits.subscription.type === 'pro' && 
          (credits.subscription.status === 'active' || credits.subscription.status === 'paid')) {
        logger.debug({ requestId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V3] Pro subscription detected');
        
        let isExpired = false;
        let hasValidExpiration = false;
        
        // Check expiration
        if (credits.subscription.expiresAt) {
          let expiresAt;
          
          // Handle Firestore Timestamp
          if (credits.subscription.expiresAt.toDate && typeof credits.subscription.expiresAt.toDate === 'function') {
            expiresAt = credits.subscription.expiresAt.toDate();
          } else if (credits.subscription.expiresAt.seconds) {
            expiresAt = new Date(credits.subscription.expiresAt.seconds * 1000);
          } else {
            expiresAt = new Date(credits.subscription.expiresAt);
          }
          
          // Validate the date is valid
          if (isNaN(expiresAt.getTime())) {
            logger.warn({ requestId, expiresAt: credits.subscription.expiresAt }, '[CREDITS-V3] Invalid expiration date, treating as unlimited');
            hasValidExpiration = false;
          } else {
            hasValidExpiration = true;
            logger.debug({ requestId, expiresAt: expiresAt.toISOString(), isExpired: expiresAt < new Date() }, '[CREDITS-V3] ExpiresAt conversion');
            
            if (expiresAt < new Date()) {
              isExpired = true;
              logger.debug({ requestId }, '[CREDITS-V3] Subscription expired, continuing to check credits');
            }
          }
        }
        
        // If subscription is not expired (either no expiration date, invalid date treated as unlimited, or valid date in future)
        if (!hasValidExpiration || !isExpired) {
          // Unlimited access - record transaction
          logger.debug({ requestId, transactionId, userId, specId }, '[CREDITS-V3] Pro user - granting unlimited access');
          
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
          
          logger.debug({ requestId }, '[CREDITS-V3] After recordLedgerEntry for unlimited');
          
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
        logger.error({ requestId, userId }, '[CREDITS-V3] Credits balances missing after subscription check');
        credits.balances = {
          paid: 0,
          free: 0,
          bonus: 0
        };
      }
      
      logger.debug({ requestId, balances: credits.balances, priority: options.priority }, '[CREDITS-V3] Before selectCreditType');
      
      // Select credit type to consume
      const priority = options.priority || ['free', 'bonus', 'paid'];
      const creditType = selectCreditType(credits.balances, priority);
      
      logger.debug({ requestId, creditType, balances: credits.balances }, '[CREDITS-V3] After selectCreditType');
      
      if (!creditType) {
        logger.warn({ requestId, userId, balances: credits.balances }, '[CREDITS-V3] No credits available to consume');
        throw new Error('Insufficient credits');
      }
      
      // Consume credit - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      
      logger.debug({ requestId, creditType, currentBalance, newBalance: Math.max(0, currentBalance - 1) }, '[CREDITS-V3] Before consuming credit');
      const newBalance = Math.max(0, currentBalance - 1);
      
      // Update credits - use increment for atomic update to ensure consistency
      // Calculate new total after consumption
      const currentTotal = credits.total || calculateTotal(credits.balances);
      const newTotal = Math.max(0, currentTotal - 1);
      
      const updateData = {
        [`balances.${creditType}`]: admin.firestore.FieldValue.increment(-1),
        total: newTotal,  // Update total field - single source of truth
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'metadata.lastCreditConsume': admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.update(creditsRef, updateData);
      
      // Update local credits object for return value
      credits.balances[creditType] = newBalance;
      credits.total = newTotal;
      
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
        metadata: {
          priority: options.priority || null
        }
      });
      
      const total = newTotal;
      
      logger.debug({ requestId }, '[CREDITS-V3] After recordLedgerEntry');
      
      return {
        success: true,
        remaining: total,
        creditType: creditType,
        unlimited: false,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ requestId, totalTime, result }, '[CREDITS-V3] Credit consumed successfully');
    
    // Record activity for credit consumption
    try {
      const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      const userEmail = userDoc.exists ? userDoc.data().email : null;
      
      recordCreditConsumption(
        userId,
        userEmail,
        specId,
        result.creditType || 'free',
        {
          transactionId: result.transactionId,
          remaining: result.remaining,
          unlimited: result.unlimited
        }
      ).catch(err => {
        logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to record credit consumption activity');
      });
    } catch (err) {
      logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to get user email for activity recording');
    }
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ requestId, totalTime, error: error.message, stack: error.stack }, '[CREDITS-V3] Error consuming credit');
    
    if (error.message === 'Insufficient credits') {
      throw new Error('Insufficient credits');
    }
    
    // For unknown errors, wrap with more context
    const errorMessage = error.message || 'Unknown error occurred';
    logger.error({ requestId, userId, specId, originalError: error }, '[CREDITS-V3] Unexpected error in consumeCredit');
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
  
  logger.info({ 
    requestId, 
    userId, 
    amount, 
    source,
    amountType: typeof amount,
    amountIsNumber: typeof amount === 'number',
    amountIsInteger: Number.isInteger(amount),
    amountPositive: amount > 0,
    metadata: {
      orderId: metadata.orderId,
      productKey: metadata.productKey,
      productName: metadata.productName,
      transactionId: metadata.transactionId
    },
    fullMetadata: metadata
  }, '[CREDITS-V3] 🔵 [CRITICAL] grantCredits - Starting - ALL PARAMETERS LOGGED');
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      logger.error({ requestId, userId }, '[CREDITS-V3] ❌ Invalid userId');
      throw new Error('Invalid userId');
    }
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      logger.error({ requestId, userId, amount }, '[CREDITS-V3] ❌ Invalid amount');
      throw new Error('Amount must be a positive integer');
    }
    
    // Prevent overflow
    const MAX_CREDITS_PER_GRANT = 1000;
    if (amount > MAX_CREDITS_PER_GRANT) {
      logger.error({ requestId, userId, amount, maxAllowed: MAX_CREDITS_PER_GRANT }, '[CREDITS-V3] ❌ Amount exceeds maximum');
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_GRANT})`);
    }
    
    // Generate transaction ID
    const transactionId = metadata.transactionId || generateTransactionId('grant', metadata.orderId, userId);
    logger.info({ 
      requestId, 
      userId, 
      transactionId,
      metadataTransactionId: metadata.transactionId
    }, '[CREDITS-V3] 🔵 Transaction ID generated');
    
    // Ensure user_credits exists
    logger.info({ requestId, userId }, '[CREDITS-V3] 🔵 Ensuring user_credits exists...');
    await getUserCredits(userId);
    logger.info({ requestId, userId }, '[CREDITS-V3] ✅ user_credits exists');
    
    // Use Firestore transaction for atomic credit grant
    logger.info({ requestId, userId, transactionId }, '[CREDITS-V3] 🔵 Starting Firestore transaction...');
    const result = await db.runTransaction(async (transaction) => {
      logger.info({ requestId, transactionId }, '[CREDITS-V3] 🔵 Inside transaction - checking idempotency...');
      
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION_V3).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        logger.info({ 
          requestId, 
          transactionId,
          existingAmount: existing.amount,
          existingType: existing.type
        }, '[CREDITS-V3] ⚠️ Transaction already processed (grant) - idempotency check');
        
        // Get current credits to return actual state
        const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
        const creditsDoc = await transaction.get(creditsRef);
        const currentCredits = creditsDoc.exists ? creditsDoc.data() : getDefaultCredits(userId);
        
        const idempotentResult = {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsAdded: existing.amount,
          remaining: calculateTotal(currentCredits.balances),
          breakdown: currentCredits.balances
        };
        
        logger.info({ requestId, transactionId, result: idempotentResult }, '[CREDITS-V3] ✅ Returning idempotent result');
        return idempotentResult;
      }
      
      logger.info({ requestId, transactionId }, '[CREDITS-V3] 🔵 Transaction not found - proceeding with grant...');
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      if (!creditsDoc.exists) {
        logger.warn({ requestId, userId }, '[CREDITS-V3] ⚠️ user_credits document missing in transaction, creating default');
        const defaultCredits = getDefaultCredits(userId);
        transaction.set(creditsRef, defaultCredits);
        
        const newUserResult = {
          success: true,
          creditsAdded: amount,
          creditType: determineCreditType(source, metadata),
          total: amount,
          breakdown: defaultCredits.balances,
          transactionId: transactionId
        };
        
        logger.info({ requestId, userId, result: newUserResult }, '[CREDITS-V3] ✅ Created default credits for new user');
        return newUserResult;
      }
      
      const credits = creditsDoc.data();
      logger.info({ 
        requestId, 
        userId,
        currentTotal: credits.total,
        currentBalances: credits.balances
      }, '[CREDITS-V3] 🔵 Current credits retrieved');
      
      // Determine credit type
      const creditType = determineCreditType(source, metadata);
      logger.info({ 
        requestId, 
        userId,
        creditType,
        source,
        metadataCreditType: metadata.creditType
      }, '[CREDITS-V3] 🔵 Credit type determined');
      
      // Grant credits - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      const newBalance = currentBalance + amount;
      
      // Calculate new total after grant
      const currentTotal = credits.total || calculateTotal(credits.balances);
      const newTotal = currentTotal + amount;
      
      logger.info({ 
        requestId, 
        userId,
        creditType,
        currentBalance,
        amount,
        newBalance,
        currentTotal,
        newTotal
      }, '[CREDITS-V3] 🔵 Credit calculation complete');
      
      // Update credits - use increment for atomic update to ensure consistency
      const updateData = {
        [`balances.${creditType}`]: admin.firestore.FieldValue.increment(amount),
        total: newTotal,  // Update total field - single source of truth
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
      };
      
      logger.info({ 
        requestId, 
        userId,
        updateData,
        creditType
      }, '[CREDITS-V3] 🔵 Updating credits in Firestore...');
      
      transaction.update(creditsRef, updateData);
      
      // Update local credits object for return value
      credits.balances[creditType] = newBalance;
      credits.total = newTotal;
      
      logger.info({ 
        requestId, 
        userId,
        balanceAfter: credits.balances,
        newTotal
      }, '[CREDITS-V3] 🔵 Recording ledger entry...');
      
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
      
      logger.info({ requestId, userId, transactionId }, '[CREDITS-V3] ✅ Ledger entry recorded');
      
      const total = newTotal;
      
      const successResult = {
        success: true,
        creditsAdded: amount,
        creditType: creditType,
        total: total,
        breakdown: credits.balances,
        transactionId: transactionId
      };
      
      logger.info({ requestId, userId, result: successResult }, '[CREDITS-V3] ✅ Transaction completed successfully');
      return successResult;
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ 
      requestId, 
      totalTime, 
      userId,
      amount,
      result: {
        success: result.success,
        creditsAdded: result.creditsAdded,
        creditType: result.creditType,
        total: result.total,
        remaining: result.remaining,
        breakdown: result.breakdown,
        alreadyProcessed: result.alreadyProcessed,
        transactionId: result.transactionId
      },
      creditsAdded: result.creditsAdded,
      remaining: result.remaining,
      alreadyProcessed: result.alreadyProcessed,
      transactionId: result.transactionId
    }, '[CREDITS-V3] ✅ [SUCCESS] Credits granted successfully - transaction complete - USER CREDITS UPDATED');
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ 
      requestId, 
      totalTime, 
      userId,
      amount,
      error: error.message, 
      stack: error.stack,
      errorName: error.name
    }, '[CREDITS-V3] ❌ Error granting credits - throwing error');
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
  
  logger.info({ requestId, userId, amount, reason }, '[CREDITS-V3] Refund credit');
  
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
    
    // Generate transaction ID
    const transactionId = generateTransactionId('refund', originalTransactionId, userId);
    
    // Ensure user_credits exists
    await getUserCredits(userId);
    
    // Use Firestore transaction for atomic credit refund
    const result = await db.runTransaction(async (transaction) => {
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION_V3).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        logger.info({ requestId, transactionId }, '[CREDITS-V3] Transaction already processed (refund)');
        
        // Get current credits to return actual state
        const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
        const creditsDoc = await transaction.get(creditsRef);
        const currentCredits = creditsDoc.exists ? creditsDoc.data() : getDefaultCredits(userId);
        
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsRefunded: existing.amount,
          total: calculateTotal(currentCredits.balances),
          breakdown: currentCredits.balances
        };
      }
      
      // Get original transaction if provided
      let originalTransaction = null;
      let creditType = 'free'; // Default credit type
      
      if (originalTransactionId) {
        try {
          const originalLedgerDoc = await db.collection(LEDGER_COLLECTION_V3).doc(originalTransactionId).get();
          if (originalLedgerDoc.exists) {
            originalTransaction = originalLedgerDoc.data();
            creditType = originalTransaction.creditType || 'free';
          }
        } catch (err) {
          logger.warn({ requestId, originalTransactionId, error: err.message }, '[CREDITS-V3] Failed to fetch original transaction');
        }
      }
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      if (!creditsDoc.exists) {
        logger.warn({ requestId, userId }, '[CREDITS-V3] user_credits document missing, creating default');
        const defaultCredits = getDefaultCredits(userId);
        transaction.set(creditsRef, defaultCredits);
        // Refund to default credits
        defaultCredits.balances[creditType] = amount;
        transaction.update(creditsRef, {
          [`balances.${creditType}`]: admin.firestore.FieldValue.increment(amount),
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          success: true,
          creditsRefunded: amount,
          creditType: creditType,
          total: amount,
          breakdown: defaultCredits.balances,
          transactionId: transactionId
        };
      }
      
      const credits = creditsDoc.data();
      
      // Refund credits - use increment for atomic update
      const currentBalance = credits.balances[creditType] || 0;
      const newBalance = currentBalance + amount;
      
      // Calculate new total after refund
      const currentTotal = credits.total || calculateTotal(credits.balances);
      const newTotal = currentTotal + amount;
      
      // Update credits
      const updateData = {
        [`balances.${creditType}`]: admin.firestore.FieldValue.increment(amount),
        total: newTotal,  // Update total field - single source of truth
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.update(creditsRef, updateData);
      
      // Update local credits object for return value
      credits.balances[creditType] = newBalance;
      credits.total = newTotal;
      
      // Record in ledger
      recordLedgerEntry(transaction, {
        transactionId: transactionId,
        userId: userId,
        type: 'refund',
        amount: amount,
        creditType: creditType,
        source: {
          type: 'refund',
          orderId: originalTransaction?.source?.orderId || null,
          specId: originalTransaction?.source?.specId || null,
          reason: reason
        },
        balanceAfter: credits.balances,
        metadata: {
          originalTransactionId: originalTransactionId || null,
          notes: `Refund: ${reason}`
        }
      });
      
      const total = newTotal;
      
      return {
        success: true,
        creditsRefunded: amount,
        creditType: creditType,
        total: total,
        breakdown: credits.balances,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    logger.info({ requestId, totalTime, result }, '[CREDITS-V3] Credits refunded successfully');
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({ requestId, totalTime, error: error.message, stack: error.stack }, '[CREDITS-V3] Error refunding credits');
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
  const limit = Math.min(filters.limit || 50, 100); // Max 100
  const offset = filters.offset || 0;
  
  let query = db.collection(LEDGER_COLLECTION_V3)
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(limit + offset);
  
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
  
  // Apply offset
  const offsetTransactions = transactions.slice(offset);
  
  return {
    transactions: offsetTransactions,
    count: offsetTransactions.length,
    limit: limit,
    hasMore: transactions.length === limit + offset
  };
}

/**
 * Enable Pro subscription
 * V3: user_credits_v3 is the single source of truth
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
  logger.info({ requestId, userId }, '[CREDITS-V3] Enabling Pro access');
  
  // Calculate currentPeriodEnd if not provided but subscriptionInterval is available
  let calculatedPeriodEnd = currentPeriodEnd;
  if (!calculatedPeriodEnd && subscriptionInterval) {
    const now = new Date();
    const interval = subscriptionInterval.toLowerCase();
    
    if (interval === 'month' || interval === 'monthly') {
      calculatedPeriodEnd = new Date(now);
      calculatedPeriodEnd.setMonth(calculatedPeriodEnd.getMonth() + 1);
    } else if (interval === 'year' || interval === 'yearly' || interval === 'annual') {
      calculatedPeriodEnd = new Date(now);
      calculatedPeriodEnd.setFullYear(calculatedPeriodEnd.getFullYear() + 1);
    }
    
    if (calculatedPeriodEnd) {
      logger.debug({ requestId, userId, calculatedPeriodEnd: calculatedPeriodEnd.toISOString() }, '[CREDITS-V3] Calculated currentPeriodEnd from interval');
    }
  }
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION_V3).doc(userId); // Archive only
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    
    const creditsDoc = await transaction.get(creditsRef);
    const credits = creditsDoc.exists
      ? creditsDoc.data()
      : getDefaultCredits(userId);
    
    const currentCredits = calculateTotal(credits.balances);
    // "paid" status also means active subscription
    const alreadyUnlimited = credits.subscription.type === 'pro' && 
      (credits.subscription.status === 'active' || credits.subscription.status === 'paid');
    
    // Preserve current credits
    const preservedCredits = currentCredits;
    
    // Update credits - use calculated period end if available
    const finalPeriodEnd = calculatedPeriodEnd || currentPeriodEnd || null;
    
    // Update nested objects properly (not flat paths)
    // Normalize subscriptionStatus: "paid" means active
    const normalizedSubscriptionStatus = subscriptionStatus === 'paid' ? 'active' : subscriptionStatus;
    
    // When enabling Pro, set total to 0 (unlimited access) but preserve credits for restoration
    const creditsUpdate = {
      subscription: {
        type: 'pro',
        status: normalizedSubscriptionStatus,
        expiresAt: finalPeriodEnd,
        preservedCredits: preservedCredits,
        lemonSubscriptionId: subscriptionId || null,
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        productKey: productKey || null,
        productName: productName || null,
        billingInterval: subscriptionInterval || null,
        renewsAt: finalPeriodEnd, // Use period end as renewsAt
        endsAt: null,
        cancelAtPeriodEnd: cancelAtPeriodEnd
      },
      permissions: {
        canEdit: true,
        canCreateUnlimited: true
      },
      total: 0,  // Set to 0 for unlimited subscription - single source of truth
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    };
    
    transaction.set(creditsRef, creditsUpdate, { merge: true });
    
    // Archive subscription data in subscriptions_v3 (for audit/logs only)
    const purchaseDate = admin.firestore.FieldValue.serverTimestamp();
    const subscriptionData = {
      userId,
      product_id: productId || null,
      product_key: productKey || null,
      product_name: productName || null,
      product_type: productType || null,
      variant_id: variantId ? variantId.toString() : null,
      status: normalizedSubscriptionStatus,
      billing_interval: subscriptionInterval || null,
      lemon_subscription_id: subscriptionId || null,
      last_order_id: orderId || null,
      last_order_total: typeof total === 'number' ? total : null,
      currency: currency || 'USD',
      cancel_at_period_end: !!cancelAtPeriodEnd,
      purchase_date: purchaseDate,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
      last_synced_source: 'enableProSubscription',
      last_synced_mode: 'live'
    };
    
    if (finalPeriodEnd) {
      subscriptionData.current_period_end = finalPeriodEnd;
      subscriptionData.renews_at = finalPeriodEnd;
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
  
  logger.info({ requestId, userId, result }, '[CREDITS-V3] Pro access enabled');
  
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
      logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to record subscription activation activity');
    });
  } catch (err) {
    logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to get user email for activity recording');
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
  logger.info({ requestId, userId }, '[CREDITS-V3] Disabling Pro access');
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION_V3).doc(userId); // Archive only
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    
    const creditsDoc = await transaction.get(creditsRef);
    const credits = creditsDoc.exists
      ? creditsDoc.data()
      : getDefaultCredits(userId);
    
    // Safely get preserved credits
    const preservedCredits = (credits.subscription && credits.subscription.preservedCredits) || 0;
    const creditsToRestore = restoreCredits !== null ? restoreCredits : preservedCredits;
    
    // Restore credits if any
    if (creditsToRestore > 0) {
      credits.balances.paid = (credits.balances.paid || 0) + creditsToRestore;
    }
    
    // Calculate new total after restoring credits
    const newTotal = calculateTotal(credits.balances);
    
    // Update credits - use nested objects properly (not flat paths)
    transaction.set(creditsRef, {
      subscription: {
        type: 'none',
        status: 'cancelled',
        expiresAt: null,
        preservedCredits: 0,
        lemonSubscriptionId: null,
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        productKey: null,
        productName: null,
        billingInterval: null,
        renewsAt: null,
        endsAt: null,
        cancelAtPeriodEnd: false
      },
      permissions: {
        canEdit: false,
        canCreateUnlimited: false
      },
      balances: credits.balances,
      total: newTotal,  // Update total field - single source of truth (restored credits)
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Archive subscription cancellation in subscriptions_v3
    transaction.set(subscriptionRef, {
      status: 'cancelled',
      cancel_reason: cancelReason,
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
      last_synced_source: 'disableProSubscription',
      last_synced_mode: 'live'
    }, { merge: true });
    
    // Update users.plan to 'free'
    transaction.update(userRef, { plan: 'free' });
    
    return {
      restoredCredits: creditsToRestore,
      previousCredits: preservedCredits
    };
  });
  
  logger.info({ requestId, userId, result }, '[CREDITS-V3] Pro access disabled');
  
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
      logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to record subscription cancellation activity');
    });
  } catch (err) {
    logger.warn({ requestId, userId, error: err.message }, '[CREDITS-V3] Failed to get user email for activity recording');
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
  getDefaultCredits,
  getInitialCreditsForNewUser,
  calculateTotal,
  selectCreditType,
  determineCreditType
};

