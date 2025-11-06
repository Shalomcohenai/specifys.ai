const { db, admin } = require('./firebase-admin');
const crypto = require('crypto');

const TRANSACTIONS_COLLECTION = 'credits_transactions';
const ENTITLEMENTS_COLLECTION = 'entitlements';
const USERS_COLLECTION = 'users';

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
  
  console.log(`[CREDITS] [${requestId}] Grant credits: userId=${userId}, amount=${amount}, source=${source}`);
  
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
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        creditsAdded: existing.amount,
        remaining: existing.metadata?.remaining || null
      };
    }
    
    // Use Firestore transaction for atomic credit grant
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
          creditsAdded: existing.amount,
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
    
    const totalTime = Date.now() - startTime;
    console.log(`[CREDITS] [${requestId}] ✅ Credits granted successfully in ${totalTime}ms`);
    console.log(`[CREDITS] [${requestId}] Details: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error granting credits (${totalTime}ms):`, error);
    throw error;
  }
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
    
    if (!specId || typeof specId !== 'string') {
      throw new Error('Invalid specId');
    }
    
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
      
      // Get entitlements document
      const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
      const entitlementsDoc = await transaction.get(entitlementsRef);
      
      const entitlements = entitlementsDoc.exists
        ? entitlementsDoc.data()
        : {
            userId: userId,
            spec_credits: 0,
            unlimited: false,
            can_edit: false
          };
      
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
      
      // Check free specs from users collection
      const userRef = db.collection(USERS_COLLECTION).doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        // User document doesn't exist - create it with 0 free specs
        transaction.set(userRef, {
          free_specs_remaining: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        throw new Error('Insufficient credits');
      }
      
      const userData = userDoc.data();
      // Default to 0 if not set
      const freeSpecsRemaining = typeof userData?.free_specs_remaining === 'number'
        ? Math.max(0, userData.free_specs_remaining)
        : 0;
      
      // Check if user has free specs
      if (freeSpecsRemaining > 0) {
        // Decrement free_specs_remaining
        transaction.update(userRef, {
          free_specs_remaining: admin.firestore.FieldValue.increment(-1)
        });
        
        const remaining = freeSpecsRemaining - 1;
        
        // Record transaction - use transactionId as document ID for idempotency
        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1, // Negative for consume
          type: 'consume',
          source: 'free_trial',
          specId: specId,
          orderId: null,
          transactionId: transactionId,
          metadata: {
            creditType: 'free',
            previousCredits: freeSpecsRemaining,
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
  
  console.log(`[CREDITS] [${requestId}] Refund credit: userId=${userId}, amount=${amount}, reason=${reason}`);
  
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Amount must be a positive integer');
    }
    
    // Prevent overflow - max credits per refund
    const MAX_CREDITS_PER_REFUND = 1000;
    if (amount > MAX_CREDITS_PER_REFUND) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_CREDITS_PER_REFUND})`);
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
    // Get entitlements document
    const entitlementsDoc = await db.collection(ENTITLEMENTS_COLLECTION).doc(userId).get();
    const entitlements = entitlementsDoc.exists
      ? entitlementsDoc.data()
      : {
          userId: userId,
          spec_credits: 0,
          unlimited: false,
          can_edit: false,
          preserved_credits: 0
        };
    
    // Get user document
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : null;
    
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
  checkAccess
};

