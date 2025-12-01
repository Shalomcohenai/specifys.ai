const { db, admin } = require('./firebase-admin');
const crypto = require('crypto');

const TRANSACTIONS_COLLECTION = 'credits_transactions';
const ENTITLEMENTS_COLLECTION = 'entitlements';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

/**
 * Generate unique transaction ID for idempotency
 */
function generateTransactionId(source, orderId, userId) {
  if (orderId) {
    return `${source}_${orderId}_${userId}`;
  }
  return `${source}_${Date.now()}_${userId}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Grant credits to a user
 * @param {string} userId - Firebase user ID
 * @param {number} amount - Number of credits to grant (must be positive)
 * @param {string} source - Source of credits: 'admin', 'lemon_squeezy', 'manual', 'promotion', 'free_trial'
 * @param {Object} metadata - Additional metadata (orderId, variantId, etc.)
 * @returns {Promise<Object>} - Result with success status and details
 */
async function grantCredits(userId, amount, source, metadata = {}) {
  const requestId = `grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[CREDITS] [${requestId}] ========== GRANT CREDITS CALLED ==========`);
  console.log(`[CREDITS] [${requestId}] Grant credits: userId=${userId}, amount=${amount}, source=${source}`);
  console.log(`[CREDITS] [${requestId}] Metadata:`, JSON.stringify(metadata));
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Amount must be a positive integer');
    }
    
    // Prevent overflow - max credits per grant
    const MAX_CREDITS_PER_GRANT = 1000;
    if (amount > MAX_CREDITS_PER_GRANT) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_GRANT})`);
    }
    
    const validSources = ['admin', 'lemon_squeezy', 'manual', 'promotion', 'free_trial'];
    if (!validSources.includes(source)) {
      throw new Error(`Invalid source. Must be one of: ${validSources.join(', ')}`);
    }
    
    // Generate transaction ID for idempotency
    const transactionId = metadata.transactionId || generateTransactionId(source, metadata.orderId, userId);
    
    // Check if transaction already processed (idempotency)
    // Use transactionId as document ID for efficient lookup
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      
      // Verify entitlements were actually updated by checking current state
      const entitlementsDoc = await db.collection(ENTITLEMENTS_COLLECTION).doc(userId).get();
      const currentCredits = entitlementsDoc.exists 
        ? (entitlementsDoc.data().spec_credits || 0)
        : 0;
      
      console.log(`[CREDITS] [${requestId}] Already processed - current credits: ${currentCredits}, transaction amount: ${existing.amount}`);
      
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        creditsAdded: existing.amount,
        remaining: currentCredits, // Return actual current credits, not stale metadata
        previousCredits: existing.metadata?.previousCredits || null
      };
    }
    
    // Use Firestore transaction for atomic credit grant
    const result = await db.runTransaction(async (transaction) => {
      // Get entitlements document reference (needed for both checks)
      const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
      
      // Double-check idempotency inside transaction using document ID
      // Use transactionId as document ID to ensure uniqueness
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        // Get current entitlements to verify
        const currentEntitlementsDoc = await transaction.get(entitlementsRef);
        const currentCredits = currentEntitlementsDoc.exists
          ? (currentEntitlementsDoc.data().spec_credits || 0)
          : 0;
        
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsAdded: existing.amount,
          remaining: currentCredits, // Return actual current credits
          previousCredits: existing.metadata?.previousCredits || null
        };
      }
      
      // Get entitlements document
      const entitlementsDoc = await transaction.get(entitlementsRef);
      
      const entitlements = entitlementsDoc.exists
        ? entitlementsDoc.data()
        : {
            userId: userId,
            spec_credits: 0,
            unlimited: false,
            can_edit: false,
            preserved_credits: 0
          };
      
      // Calculate new credit amount
      const currentCredits = entitlements.spec_credits || 0;
      const newCredits = currentCredits + amount;
      
      // Update entitlements
      if (entitlementsDoc.exists) {
        transaction.update(entitlementsRef, {
          spec_credits: admin.firestore.FieldValue.increment(amount),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(entitlementsRef, {
          userId: userId,
          spec_credits: amount,
          unlimited: false,
          can_edit: false,
          preserved_credits: 0,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Record transaction - use transactionId as document ID for idempotency
      const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      transaction.set(transactionRef, {
        userId: userId,
        amount: amount,
        type: 'grant',
        source: source,
        specId: null,
        orderId: metadata.orderId || null,
        transactionId: transactionId,
        metadata: {
          ...metadata,
          previousCredits: currentCredits,
          remaining: newCredits
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        creditsAdded: amount,
        previousCredits: currentCredits,
        remaining: newCredits,
        transactionId: transactionId
      };
    });
    
    // Verify the transaction actually updated the entitlements
    const verifyEntitlementsDoc = await db.collection(ENTITLEMENTS_COLLECTION).doc(userId).get();
    const actualCredits = verifyEntitlementsDoc.exists
      ? (verifyEntitlementsDoc.data().spec_credits || 0)
      : 0;
    
    const totalTime = Date.now() - startTime;
    console.log(`[CREDITS] [${requestId}] ✅ Credits granted successfully in ${totalTime}ms`);
    console.log(`[CREDITS] [${requestId}] Details: ${JSON.stringify(result)}`);
    console.log(`[CREDITS] [${requestId}] Verification - Expected: ${result.remaining}, Actual: ${actualCredits}`);
    
    // If there's a mismatch, log a warning but don't fail (transaction was committed)
    if (result.remaining !== actualCredits && !result.alreadyProcessed) {
      console.warn(`[CREDITS] [${requestId}] ⚠️ Credit mismatch detected! Expected ${result.remaining} but found ${actualCredits}`);
    }
    
    // Return actual credits in the response
    return {
      ...result,
      remaining: actualCredits // Ensure we return the actual current credits
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error granting credits (${totalTime}ms):`, error);
    throw error;
  }
}

/**
 * Enable Pro subscription (unlimited access)
 * @param {string} userId
 * @param {Object} options
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
  console.log(`[SUBSCRIPTION] [${requestId}] Enabling Pro access for user ${userId} (variant=${variantId || 'n/a'})`);

  const result = await db.runTransaction(async (transaction) => {
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);

    const entitlementsSnap = await transaction.get(entitlementsRef);
    const entitlements = entitlementsSnap.exists
      ? entitlementsSnap.data()
      : {
          userId,
          spec_credits: 0,
          unlimited: false,
          can_edit: false,
          preserved_credits: 0
        };

    const currentCredits = entitlements.spec_credits || 0;
    const alreadyUnlimited = !!entitlements.unlimited;

    const entitlementsUpdate = {
      unlimited: true,
      can_edit: true,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!alreadyUnlimited) {
      entitlementsUpdate.preserved_credits = currentCredits;
      entitlementsUpdate.spec_credits = 0;
    }

    transaction.set(entitlementsRef, entitlementsUpdate, { merge: true });

    transaction.set(userRef, {
      plan,
      last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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

    if (metadata && Object.keys(metadata).length > 0) {
      subscriptionData.metadata = {
        ...(metadata || {})
      };
    }

    transaction.set(subscriptionRef, subscriptionData, { merge: true });

    return {
      previouslyUnlimited: alreadyUnlimited,
      previousCredits: currentCredits,
      preservedCredits: entitlementsUpdate.preserved_credits ?? entitlements.preserved_credits ?? 0
    };
  });

  console.log(`[SUBSCRIPTION] [${requestId}] ✅ Pro access enabled (alreadyUnlimited=${result.previouslyUnlimited})`);
  return result;
}

/**
 * Disable Pro subscription (revert to free plan)
 * @param {string} userId
 * @param {Object} options
 */
async function disableProSubscription(userId, options = {}) {
  const {
    plan = 'free',
    subscriptionId = null,
    cancelReason = 'user_requested',
    cancelMode = 'immediate',
    cancelMetadata = {},
    restoreCredits = null,
    metadata = {}
  } = options;

  if (!userId) {
    throw new Error('disableProSubscription requires userId');
  }

  const requestId = `disable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SUBSCRIPTION] [${requestId}] Disabling Pro access for user ${userId}`);

  const result = await db.runTransaction(async (transaction) => {
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);

    const [entitlementsSnap, subscriptionSnap] = await Promise.all([
      transaction.get(entitlementsRef),
      transaction.get(subscriptionRef)
    ]);

    const entitlements = entitlementsSnap.exists
      ? entitlementsSnap.data()
      : {
          userId,
          spec_credits: 0,
          unlimited: false,
          can_edit: false,
          preserved_credits: 0
        };

    const preservedCredits = typeof entitlements.preserved_credits === 'number'
      ? entitlements.preserved_credits
      : 0;
    const currentCredits = typeof entitlements.spec_credits === 'number'
      ? entitlements.spec_credits
      : 0;
    const creditsToRestore = restoreCredits !== null && restoreCredits !== undefined
      ? restoreCredits
      : preservedCredits;

    const entitlementsUpdate = {
      unlimited: false,
      can_edit: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (creditsToRestore && creditsToRestore > 0) {
      entitlementsUpdate.spec_credits = creditsToRestore;
    } else if (!entitlementsSnap.exists) {
      entitlementsUpdate.spec_credits = 0;
    }

    entitlementsUpdate.preserved_credits = 0;

    transaction.set(entitlementsRef, entitlementsUpdate, { merge: true });

    transaction.set(userRef, {
      plan,
      last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const subscriptionData = {
      userId,
      status: 'cancelled',
      cancel_reason: cancelReason,
      cancel_mode: cancelMode,
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      lemon_subscription_id: subscriptionId || (subscriptionSnap.exists ? subscriptionSnap.data().lemon_subscription_id || null : null)
    };

    if (cancelMetadata && Object.keys(cancelMetadata).length > 0) {
      subscriptionData.cancel_metadata = cancelMetadata;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      subscriptionData.metadata = {
        ...(subscriptionSnap.exists ? subscriptionSnap.data().metadata || {} : {}),
        ...metadata
      };
    }

    transaction.set(subscriptionRef, subscriptionData, { merge: true });

    return {
      restoredCredits: creditsToRestore,
      previousCredits: currentCredits,
      preservedCredits: preservedCredits,
      subscriptionStatus: subscriptionData.status
    };
  });

  console.log(`[SUBSCRIPTION] [${requestId}] ✅ Pro access disabled (restoredCredits=${result.restoredCredits || 0})`);
  return result;
}

/**
 * Consume a credit when creating a spec
 * @param {string} userId - Firebase user ID
 * @param {string} specId - Specification ID
 * @returns {Promise<Object>} - Result with success status and remaining credits
 */
async function consumeCredit(userId, specId) {
  const requestId = `consume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[CREDITS] [${requestId}] Consume credit: userId=${userId}, specId=${specId}`);
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!specId || typeof specId !== 'string' || specId.trim().length === 0) {
      throw new Error('Invalid specId');
    }
    
    // Validate specId format (should be a valid Firestore document ID)
    // Firestore document IDs can be up to 1500 bytes, alphanumeric with some special chars
    if (specId.length > 1500) {
      throw new Error('specId is too long');
    }
    
    // Note: We don't verify spec exists here because:
    // 1. The spec might be created after credit consumption (tempSpecId pattern)
    // 2. We verify inside transaction that user doesn't already have a spec
    // 3. The transaction ID includes specId, so duplicate specIds are prevented
    
    // Generate transaction ID
    const transactionId = generateTransactionId('consume', specId, userId);
    
    // Check if transaction already processed (idempotency)
    // Use transactionId as document ID for efficient lookup
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        remaining: existing.metadata?.remaining || null,
        creditType: existing.metadata?.creditType || 'unknown'
      };
    }
    
    // Use Firestore transaction for atomic credit consumption
    const result = await db.runTransaction(async (transaction) => {
      // Double-check idempotency inside transaction using document ID
      // Use transactionId as document ID to ensure uniqueness
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          remaining: existing.metadata?.remaining || null,
          creditType: existing.metadata?.creditType || 'unknown'
        };
      }
      
      // Check if user already has a spec (only one spec per user allowed)
      const specsQuery = db.collection('specs').where('userId', '==', userId).limit(1);
      const existingSpecsSnapshot = await transaction.get(specsQuery);
      
      if (!existingSpecsSnapshot.empty) {
        const existingSpecId = existingSpecsSnapshot.docs[0].id;
        console.log(`[CREDITS] [${requestId}] User ${userId} already has a spec: ${existingSpecId}`);
        throw new Error('User already has a spec. Only one spec per user is allowed.');
      }
      
      // Get user document first to check if this is a new user
      const userRef = db.collection(USERS_COLLECTION).doc(userId);
      const userDoc = await transaction.get(userRef);
      
      // Get entitlements document
      const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
      const entitlementsDoc = await transaction.get(entitlementsRef);
      
      // If entitlements don't exist, check if this is a new user
      let isNewUserCheck = false;
      if (!userDoc.exists) {
        isNewUserCheck = true;
      } else {
        const userData = userDoc.data();
        if (userData.createdAt) {
          const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          isNewUserCheck = createdAt > fiveMinutesAgo;
        }
      }
      
      // Credits are only given during registration in auth.html
      // But if this is a new user and entitlements don't exist, give 1 credit as fallback
      const entitlements = entitlementsDoc.exists
        ? entitlementsDoc.data()
        : {
            userId: userId,
            spec_credits: isNewUserCheck ? 1 : 0,
            unlimited: false,
            can_edit: false
          };
      
      // Create entitlements document if it doesn't exist
      if (!entitlementsDoc.exists) {
        transaction.set(entitlementsRef, {
          ...entitlements,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      
      // Check if user has unlimited access (Pro subscription)
      if (entitlements.unlimited) {
        // Record transaction even for unlimited users - use transactionId as document ID
        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1, // Negative for consume
          type: 'consume',
          source: 'unlimited',
          specId: specId,
          orderId: null,
          transactionId: transactionId,
          metadata: {
            creditType: 'unlimited',
            remaining: null
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          success: true,
          remaining: null,
          creditType: 'unlimited',
          transactionId: transactionId
        };
      }
      
      // Check if user has paid credits
      const specCredits = entitlements.spec_credits || 0;
      if (specCredits > 0) {
        // Decrement spec_credits
        transaction.update(entitlementsRef, {
          spec_credits: admin.firestore.FieldValue.increment(-1),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const remaining = specCredits - 1;
        
        // Record transaction - use transactionId as document ID for idempotency
        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1, // Negative for consume
          type: 'consume',
          source: 'paid',
          specId: specId,
          orderId: null,
          transactionId: transactionId,
          metadata: {
            creditType: 'paid',
            previousCredits: specCredits,
            remaining: remaining
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          success: true,
          remaining: remaining,
          creditType: 'paid',
          transactionId: transactionId
        };
      }
      
      // Check free specs from users collection (userDoc already fetched above)
      const userData = userDoc.exists ? userDoc.data() || {} : {};
      let previousFreeCredits;

      if (!userDoc.exists) {
        previousFreeCredits = 1;
      } else if (typeof userData.free_specs_remaining === 'number') {
        previousFreeCredits = Math.max(0, userData.free_specs_remaining);
      } else {
        previousFreeCredits = 1;
      }

      if (previousFreeCredits > 0) {
        const remaining = previousFreeCredits - 1;
        const updatePayload = {
          free_specs_remaining: remaining,
          lastActive: admin.firestore.FieldValue.serverTimestamp()
        };
        if (!userDoc.exists) {
          updatePayload.plan = 'free';
          updatePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }
        transaction.set(userRef, updatePayload, { merge: true });

        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1,
          type: 'consume',
          source: 'free_trial',
          specId: specId,
          orderId: null,
          transactionId: transactionId,
          metadata: {
            creditType: 'free',
            previousCredits: previousFreeCredits,
            remaining: remaining
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          success: true,
          remaining: remaining,
          creditType: 'free',
          transactionId: transactionId
        };
      }
      
      // No credits available
      throw new Error('Insufficient credits');
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[CREDITS] [${requestId}] ✅ Credit consumed successfully in ${totalTime}ms`);
    console.log(`[CREDITS] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error consuming credit (${totalTime}ms):`, error);
    
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
  
  console.log(`[CREDITS] [${requestId}] Refund credit: userId=${userId}, amount=${amount}, reason=${reason}, originalTransactionId=${originalTransactionId}`);
  
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
    
    // Prevent overflow - max credits per refund
    const MAX_CREDITS_PER_REFUND = 1000;
    if (amount > MAX_CREDITS_PER_REFUND) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_REFUND})`);
    }
    
    // If originalTransactionId is provided, verify it exists and belongs to the user
    if (originalTransactionId) {
      const originalTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(originalTransactionId).get();
      
      if (!originalTransactionDoc.exists) {
        throw new Error(`Original transaction ${originalTransactionId} not found`);
      }
      
      const originalTransaction = originalTransactionDoc.data();
      
      // Verify the transaction belongs to this user
      if (originalTransaction.userId !== userId) {
        throw new Error('Original transaction does not belong to this user');
      }
      
      // Verify it's a consume transaction (can only refund consumed credits)
      if (originalTransaction.type !== 'consume') {
        throw new Error(`Cannot refund transaction of type ${originalTransaction.type}. Only consume transactions can be refunded.`);
      }
      
      // Check if this transaction was already refunded
      const refundQuery = await db.collection(TRANSACTIONS_COLLECTION)
        .where('metadata.originalTransactionId', '==', originalTransactionId)
        .where('type', '==', 'refund')
        .limit(1)
        .get();
      
      if (!refundQuery.empty) {
        const existingRefund = refundQuery.docs[0].data();
        throw new Error(`Transaction ${originalTransactionId} was already refunded (refund transaction: ${refundQuery.docs[0].id})`);
      }
      
      // Verify refund amount doesn't exceed original amount
      const originalAmount = Math.abs(originalTransaction.amount || 0);
      if (amount > originalAmount) {
        throw new Error(`Refund amount (${amount}) cannot exceed original transaction amount (${originalAmount})`);
      }
      
      console.log(`[CREDITS] [${requestId}] Verified original transaction: ${originalTransactionId}, original amount: ${originalAmount}`);
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId('refund', originalTransactionId, userId);
    
    // Check if transaction already processed (idempotency)
    // Use transactionId as document ID for efficient lookup
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        creditsRefunded: existing.amount,
        remaining: existing.metadata?.remaining || null
      };
    }
    
    // Use Firestore transaction for atomic credit refund
    const result = await db.runTransaction(async (transaction) => {
      // Double-check idempotency inside transaction using document ID
      // Use transactionId as document ID to ensure uniqueness
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsRefunded: existing.amount,
          remaining: existing.metadata?.remaining || null
        };
      }
      
      // Get entitlements document
      const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
      const entitlementsDoc = await transaction.get(entitlementsRef);
      
      const entitlements = entitlementsDoc.exists
        ? entitlementsDoc.data()
        : {
            userId: userId,
            spec_credits: 0,
            unlimited: false,
            can_edit: false,
            preserved_credits: 0
          };
      
      // Calculate new credit amount
      const currentCredits = entitlements.spec_credits || 0;
      const newCredits = currentCredits + amount;
      
      // Update entitlements
      if (entitlementsDoc.exists) {
        transaction.update(entitlementsRef, {
          spec_credits: admin.firestore.FieldValue.increment(amount),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(entitlementsRef, {
          userId: userId,
          spec_credits: amount,
          unlimited: false,
          can_edit: false,
          preserved_credits: 0,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Record transaction - use transactionId as document ID for idempotency
      const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      transaction.set(transactionRef, {
        userId: userId,
        amount: amount,
        type: 'refund',
        source: 'system',
        specId: null,
        orderId: null,
        transactionId: transactionId,
        metadata: {
          reason: reason,
          originalTransactionId: originalTransactionId,
          previousCredits: currentCredits,
          remaining: newCredits
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        creditsRefunded: amount,
        previousCredits: currentCredits,
        remaining: newCredits,
        transactionId: transactionId
      };
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[CREDITS] [${requestId}] ✅ Credits refunded successfully in ${totalTime}ms`);
    console.log(`[CREDITS] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error refunding credits (${totalTime}ms):`, error);
    throw error;
  }
}

/**
 * Get user entitlements
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Entitlements and user data
 */
async function getEntitlements(userId) {
  try {
    // Get user document first to check if this is a new user
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    const isNewUser = !userDoc.exists;
    
    // Get entitlements document
    const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
    const entitlementsDoc = await entitlementsRef.get();
    
    let entitlements;
    let shouldCreateEntitlements = false;
    
    if (!entitlementsDoc.exists) {
      // Entitlements don't exist - check if this is a new user
      let isNewUserCheck = false;
      if (!userDoc.exists) {
        isNewUserCheck = true;
      } else {
        const userData = userDoc.data();
        if (userData.createdAt) {
          const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          isNewUserCheck = createdAt > fiveMinutesAgo;
        }
      }
      
      // Credits are only given during registration in auth.html
      // But if this is a new user and entitlements don't exist, give 1 credit as fallback
      entitlements = {
        userId: userId,
        spec_credits: isNewUserCheck ? 1 : 0,
        unlimited: false,
        can_edit: false,
        preserved_credits: 0
      };
      shouldCreateEntitlements = true;
    } else {
      entitlements = entitlementsDoc.data();
    }
    
    let user = null;

    if (!userDoc.exists) {
      await userRef.set({
        free_specs_remaining: 1,
        plan: 'free',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      user = {
        free_specs_remaining: 1,
        plan: 'free'
      };
    } else {
      const data = userDoc.data() || {};
      if (typeof data.free_specs_remaining !== 'number') {
        await userRef.set({
          free_specs_remaining: 1,
          lastActive: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        data.free_specs_remaining = 1;
      }
      user = data;
    }
    
    // Create entitlements document if it doesn't exist
    if (shouldCreateEntitlements) {
      await entitlementsRef.set({
        ...entitlements,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return {
      entitlements: {
        unlimited: entitlements.unlimited || false,
        spec_credits: entitlements.spec_credits || 0,
        can_edit: entitlements.can_edit || false,
        preserved_credits: entitlements.preserved_credits || 0
      },
      user: user
    };
  } catch (error) {
    console.error('[CREDITS] Error fetching entitlements:', error);
    throw error;
  }
}

/**
 * Check if user has access to create specs
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} - Access status and details
 */
async function checkAccess(userId) {
  try {
    const data = await getEntitlements(userId);
    const { entitlements, user } = data;
    
    if (entitlements.unlimited) {
      return {
        hasAccess: true,
        entitlements: entitlements,
        paywallData: null
      };
    }
    
    if (entitlements.spec_credits && entitlements.spec_credits > 0) {
      return {
        hasAccess: true,
        entitlements: entitlements,
        paywallData: null
      };
    }
    
    const freeSpecs = typeof user?.free_specs_remaining === 'number' 
      ? Math.max(0, user.free_specs_remaining)
      : 0; // Default to 0 if user doesn't exist or field is missing
    
    if (freeSpecs > 0) {
      return {
        hasAccess: true,
        entitlements: entitlements,
        paywallData: null
      };
    }
    
    return {
      hasAccess: false,
      entitlements: entitlements,
      paywallData: {
        reason: 'insufficient_credits',
        message: 'You have no remaining spec credits',
        freeSpecs: freeSpecs,
        specCredits: entitlements.spec_credits || 0,
        unlimited: false
      }
    };
  } catch (error) {
    console.error('[CREDITS] Error checking access:', error);
    return {
      hasAccess: false,
      entitlements: null,
      paywallData: {
        reason: 'error',
        message: 'Unable to verify your access. Please try again.'
      }
    };
  }
}

module.exports = {
  grantCredits,
  consumeCredit,
  refundCredit,
  getEntitlements,
  checkAccess,
  enableProSubscription,
  disableProSubscription
};

