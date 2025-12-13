const { db, admin } = require('./firebase-admin');
const crypto = require('crypto');

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
 * Get default credits structure for new user
 */
function getDefaultCredits(userId) {
  return {
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
  for (const type of priority) {
    if (balances[type] && balances[type] > 0) {
      return type;
    }
  }
  return null;
}

/**
 * Determine credit type based on source
 */
function determineCreditType(source, metadata) {
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
 * Get user credits (single source of truth)
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - User credits data
 */
async function getUserCredits(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId');
  }
  
  const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
  const creditsDoc = await creditsRef.get();
  
  if (!creditsDoc.exists) {
    // Create default credits for new user
    const defaultCredits = getDefaultCredits(userId);
    await creditsRef.set(defaultCredits);
    return defaultCredits;
  }
  
  return creditsDoc.data();
}

/**
 * Get available credits for user
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Available credits info
 */
async function getAvailableCredits(userId) {
  const credits = await getUserCredits(userId);
  
  // Check subscription first
  if (credits.subscription.type === 'pro' && credits.subscription.status === 'active') {
    // Check if subscription expired
    if (credits.subscription.expiresAt) {
      const expiresAt = credits.subscription.expiresAt.toDate ? credits.subscription.expiresAt.toDate() : new Date(credits.subscription.expiresAt);
      if (expiresAt < new Date()) {
        // Subscription expired, disable unlimited
        await updateSubscriptionStatus(userId, 'expired');
        return {
          unlimited: false,
          total: calculateTotal(credits.balances),
          breakdown: credits.balances
        };
      }
    }
    
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
  
  if (status === 'expired' && credits.subscription.type === 'pro') {
    // Restore preserved credits
    const preservedCredits = credits.subscription.preservedCredits || 0;
    if (preservedCredits > 0) {
      credits.balances.paid = (credits.balances.paid || 0) + preservedCredits;
    }
  }
  
  await creditsRef.update({
    'subscription.status': status,
    'subscription.type': status === 'expired' ? 'none' : credits.subscription.type,
    'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Record ledger entry
 */
async function recordLedgerEntry(transaction, entryData) {
  const ledgerRef = db.collection(LEDGER_COLLECTION).doc(entryData.transactionId);
  
  const ledgerEntry = {
    id: entryData.transactionId,
    userId: entryData.userId,
    type: entryData.type,
    amount: entryData.amount,
    creditType: entryData.creditType,
    source: entryData.source,
    balanceAfter: entryData.balanceAfter,
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
  
  console.log(`[CREDITS-V2] [${requestId}] Consume credit: userId=${userId}, specId=${specId}`);
  
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
    
    // Use Firestore transaction for atomic credit consumption
    const result = await db.runTransaction(async (transaction) => {
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        console.log(`[CREDITS-V2] [${requestId}] Transaction already processed: ${transactionId}`);
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
      const specsQuery = db.collection('specs').where('userId', '==', userId).limit(1);
      const existingSpecsSnapshot = await transaction.get(specsQuery);
      
      if (!existingSpecsSnapshot.empty) {
        const existingSpecId = existingSpecsSnapshot.docs[0].id;
        console.log(`[CREDITS-V2] [${requestId}] User ${userId} already has a spec: ${existingSpecId}`);
        throw new Error('User already has a spec. Only one spec per user is allowed.');
      }
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      const credits = creditsDoc.exists
        ? creditsDoc.data()
        : getDefaultCredits(userId);
      
      // Check subscription first
      if (credits.subscription.type === 'pro' && credits.subscription.status === 'active') {
        // Check expiration
        if (credits.subscription.expiresAt) {
          const expiresAt = credits.subscription.expiresAt.toDate ? credits.subscription.expiresAt.toDate() : new Date(credits.subscription.expiresAt);
          if (expiresAt < new Date()) {
            // Subscription expired, continue to check credits
          } else {
            // Unlimited access - record transaction
            await recordLedgerEntry(transaction, {
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
            
            return {
              success: true,
              remaining: null,
              creditType: 'unlimited',
              unlimited: true,
              transactionId: transactionId
            };
          }
        } else {
          // No expiration date, assume active
          await recordLedgerEntry(transaction, {
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
          
          return {
            success: true,
            remaining: null,
            creditType: 'unlimited',
            unlimited: true,
            transactionId: transactionId
          };
        }
      }
      
      // Select credit type to consume
      const priority = options.priority || ['free', 'bonus', 'paid'];
      const creditType = selectCreditType(credits.balances, priority);
      
      if (!creditType) {
        throw new Error('Insufficient credits');
      }
      
      // Consume credit
      const newBalance = (credits.balances[creditType] || 0) - 1;
      credits.balances[creditType] = Math.max(0, newBalance);
      
      // Update credits
      if (!creditsDoc.exists) {
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditConsume': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(creditsRef, {
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditConsume': admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Record in ledger
      await recordLedgerEntry(transaction, {
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
    console.log(`[CREDITS-V2] [${requestId}] ✅ Credit consumed successfully in ${totalTime}ms`);
    console.log(`[CREDITS-V2] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS-V2] [${requestId}] ❌ Error consuming credit (${totalTime}ms):`, error);
    
    if (error.message === 'Insufficient credits') {
      throw new Error('Insufficient credits');
    }
    
    if (error.message === 'User already has a spec. Only one spec per user is allowed.') {
      throw new Error('User already has a spec. Only one spec per user is allowed.');
    }
    
    throw error;
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
  
  console.log(`[CREDITS-V2] [${requestId}] Grant credits: userId=${userId}, amount=${amount}, source=${source}`);
  
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
    
    // Use Firestore transaction for atomic credit grant
    const result = await db.runTransaction(async (transaction) => {
      // Check idempotency
      const ledgerDocRef = db.collection(LEDGER_COLLECTION).doc(transactionId);
      const existingLedgerDoc = await transaction.get(ledgerDocRef);
      
      if (existingLedgerDoc.exists) {
        const existing = existingLedgerDoc.data();
        console.log(`[CREDITS-V2] [${requestId}] Transaction already processed: ${transactionId}`);
        
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
      
      // Get user credits
      const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
      const creditsDoc = await transaction.get(creditsRef);
      
      const credits = creditsDoc.exists
        ? creditsDoc.data()
        : getDefaultCredits(userId);
      
      // Determine credit type
      const creditType = determineCreditType(source, metadata);
      
      // Grant credits
      credits.balances[creditType] = (credits.balances[creditType] || 0) + amount;
      
      // Update credits
      if (!creditsDoc.exists) {
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(creditsRef, {
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Record in ledger
      await recordLedgerEntry(transaction, {
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
    console.log(`[CREDITS-V2] [${requestId}] ✅ Credits granted successfully in ${totalTime}ms`);
    console.log(`[CREDITS-V2] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS-V2] [${requestId}] ❌ Error granting credits (${totalTime}ms):`, error);
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
  
  console.log(`[CREDITS-V2] [${requestId}] Refund credit: userId=${userId}, amount=${amount}, reason=${reason}`);
  
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
      
      // Grant credits (refund = grant)
      credits.balances[creditType] = (credits.balances[creditType] || 0) + amount;
      
      // Update credits
      if (!creditsDoc.exists) {
        transaction.set(creditsRef, {
          ...credits,
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(creditsRef, {
          balances: credits.balances,
          'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Record in ledger
      await recordLedgerEntry(transaction, {
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
    console.log(`[CREDITS-V2] [${requestId}] ✅ Credits refunded successfully in ${totalTime}ms`);
    console.log(`[CREDITS-V2] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS-V2] [${requestId}] ❌ Error refunding credits (${totalTime}ms):`, error);
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
  console.log(`[CREDITS-V2] [${requestId}] Enabling Pro access for user ${userId}`);
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    
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
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (currentPeriodEnd) {
      subscriptionData.current_period_end = currentPeriodEnd;
    }
    
    transaction.set(subscriptionRef, subscriptionData, { merge: true });
    
    return {
      previouslyUnlimited: alreadyUnlimited,
      previousCredits: currentCredits,
      preservedCredits: preservedCredits
    };
  });
  
  console.log(`[CREDITS-V2] [${requestId}] ✅ Pro access enabled`);
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
  console.log(`[CREDITS-V2] [${requestId}] Disabling Pro access for user ${userId}`);
  
  const result = await db.runTransaction(async (transaction) => {
    const creditsRef = db.collection(CREDITS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
    
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
    
    return {
      restoredCredits: creditsToRestore,
      previousCredits: preservedCredits
    };
  });
  
  console.log(`[CREDITS-V2] [${requestId}] ✅ Pro access disabled`);
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
  calculateTotal
};
