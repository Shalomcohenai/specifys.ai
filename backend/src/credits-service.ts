/**
 * Credits Service
 * Handles credit grants, consumption, refunds, and entitlements
 */

import { db, admin } from './firebase-admin';
import * as crypto from 'crypto';

const TRANSACTIONS_COLLECTION = 'credits_transactions';
const ENTITLEMENTS_COLLECTION = 'entitlements';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

interface CreditMetadata {
  transactionId?: string;
  orderId?: string;
  variantId?: string;
  [key: string]: any;
}

interface GrantCreditsResult {
  success: boolean;
  alreadyProcessed?: boolean;
  transactionId: string;
  creditsAdded?: number;
  remaining: number | null;
  previousCredits?: number | null;
}

interface ConsumeCreditResult {
  success: boolean;
  alreadyProcessed?: boolean;
  transactionId: string;
  remaining: number | null;
  creditType: 'unlimited' | 'paid' | 'free';
}

interface RefundCreditResult {
  success: boolean;
  alreadyProcessed?: boolean;
  transactionId: string;
  creditsRefunded?: number;
  remaining: number | null;
  previousCredits?: number;
}

interface EntitlementsResult {
  entitlements: {
    unlimited: boolean;
    spec_credits: number;
    can_edit: boolean;
    preserved_credits: number;
  };
  user: any;
}

interface AccessCheckResult {
  hasAccess: boolean;
  entitlements: any;
  paywallData: {
    reason: string;
    message: string;
    freeSpecs?: number;
    specCredits?: number;
    unlimited?: boolean;
  } | null;
}

interface ProSubscriptionOptions {
  plan?: string;
  variantId?: string | null;
  productKey?: string | null;
  productName?: string | null;
  productType?: string | null;
  productId?: string | null;
  orderId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string;
  subscriptionInterval?: string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  total?: number | null;
  currency?: string;
  metadata?: Record<string, any>;
}

interface DisableProSubscriptionOptions {
  plan?: string;
  subscriptionId?: string | null;
  cancelReason?: string;
  cancelMode?: string;
  cancelMetadata?: Record<string, any>;
  restoreCredits?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Generate unique transaction ID for idempotency
 */
function generateTransactionId(source: string, orderId: string | undefined, userId: string): string {
  if (orderId) {
    return `${source}_${orderId}_${userId}`;
  }
  return `${source}_${Date.now()}_${userId}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Grant credits to a user
 */
export async function grantCredits(
  userId: string,
  amount: number,
  source: 'admin' | 'lemon_squeezy' | 'manual' | 'promotion' | 'free_trial',
  metadata: CreditMetadata = {}
): Promise<GrantCreditsResult> {
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
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      
      // Verify entitlements were actually updated by checking current state
      const entitlementsDoc = await db.collection(ENTITLEMENTS_COLLECTION).doc(userId).get();
      const currentCredits = entitlementsDoc.exists 
        ? (entitlementsDoc.data()?.spec_credits || 0)
        : 0;
      
      console.log(`[CREDITS] [${requestId}] Already processed - current credits: ${currentCredits}, transaction amount: ${existing?.amount}`);
      
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        creditsAdded: existing?.amount || 0,
        remaining: currentCredits,
        previousCredits: (existing?.metadata as any)?.previousCredits || null
      };
    }
    
    // Use Firestore transaction for atomic credit grant
    const result = await db.runTransaction(async (transaction) => {
      const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        const currentEntitlementsDoc = await transaction.get(entitlementsRef);
        const currentCredits = currentEntitlementsDoc.exists
          ? (currentEntitlementsDoc.data()?.spec_credits || 0)
          : 0;
        
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsAdded: existing?.amount || 0,
          remaining: currentCredits,
          previousCredits: (existing?.metadata as any)?.previousCredits || null
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
      const currentCredits = (entitlements?.spec_credits as number) || 0;
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
      
      // Record transaction
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
      ? (verifyEntitlementsDoc.data()?.spec_credits || 0)
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
      remaining: actualCredits
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error granting credits (${totalTime}ms):`, error);
    throw error;
  }
}

/**
 * Enable Pro subscription (unlimited access)
 */
export async function enableProSubscription(userId: string, options: ProSubscriptionOptions = {}): Promise<any> {
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

    const currentCredits = (entitlements?.spec_credits as number) || 0;
    const alreadyUnlimited = !!(entitlements?.unlimited);

    const entitlementsUpdate: any = {
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

    const subscriptionData: any = {
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
      preservedCredits: entitlementsUpdate.preserved_credits ?? (entitlements?.preserved_credits as number) ?? 0
    };
  });

  console.log(`[SUBSCRIPTION] [${requestId}] ✅ Pro access enabled (alreadyUnlimited=${result.previouslyUnlimited})`);
  return result;
}

/**
 * Disable Pro subscription (revert to free plan)
 */
export async function disableProSubscription(userId: string, options: DisableProSubscriptionOptions = {}): Promise<any> {
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

    const preservedCredits = typeof entitlements?.preserved_credits === 'number'
      ? entitlements.preserved_credits
      : 0;
    const currentCredits = typeof entitlements?.spec_credits === 'number'
      ? entitlements.spec_credits
      : 0;
    const creditsToRestore = restoreCredits !== null && restoreCredits !== undefined
      ? restoreCredits
      : preservedCredits;

    const entitlementsUpdate: any = {
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

    const subscriptionData: any = {
      userId,
      status: 'cancelled',
      cancel_reason: cancelReason,
      cancel_mode: cancelMode,
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      lemon_subscription_id: subscriptionId || (subscriptionSnap.exists ? (subscriptionSnap.data()?.lemon_subscription_id as string) || null : null)
    };

    if (cancelMetadata && Object.keys(cancelMetadata).length > 0) {
      subscriptionData.cancel_metadata = cancelMetadata;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      subscriptionData.metadata = {
        ...(subscriptionSnap.exists ? (subscriptionSnap.data()?.metadata as Record<string, any>) || {} : {}),
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
 */
export async function consumeCredit(userId: string, specId: string): Promise<ConsumeCreditResult> {
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
    
    // Validate specId format
    if (specId.length > 1500) {
      throw new Error('specId is too long');
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId('consume', specId, userId);
    
    // Check if transaction already processed (idempotency)
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        remaining: (existing?.metadata as any)?.remaining || null,
        creditType: (existing?.metadata as any)?.creditType || 'unknown' as any
      };
    }
    
    // Use Firestore transaction for atomic credit consumption
    const result = await db.runTransaction(async (transaction) => {
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          remaining: (existing?.metadata as any)?.remaining || null,
          creditType: (existing?.metadata as any)?.creditType || 'unknown' as any
        };
      }
      
      // Check if user already has a spec
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
        if (userData?.createdAt) {
          const createdAt = (userData.createdAt as any).toDate ? (userData.createdAt as any).toDate() : new Date(userData.createdAt as string);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          isNewUserCheck = createdAt > fiveMinutesAgo;
        }
      }
      
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
      if (entitlements?.unlimited) {
        // Record transaction even for unlimited users
        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1,
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
          creditType: 'unlimited' as const,
          transactionId: transactionId
        };
      }
      
      // Check if user has paid credits
      const specCredits = (entitlements?.spec_credits as number) || 0;
      if (specCredits > 0) {
        // Decrement spec_credits
        transaction.update(entitlementsRef, {
          spec_credits: admin.firestore.FieldValue.increment(-1),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const remaining = specCredits - 1;
        
        // Record transaction
        const transactionRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
        transaction.set(transactionRef, {
          userId: userId,
          amount: -1,
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
          creditType: 'paid' as const,
          transactionId: transactionId
        };
      }
      
      // Check free specs from users collection
      const userData = userDoc.exists ? userDoc.data() || {} : {};
      let previousFreeCredits: number;

      if (!userDoc.exists) {
        previousFreeCredits = 1;
      } else if (typeof userData.free_specs_remaining === 'number') {
        previousFreeCredits = Math.max(0, userData.free_specs_remaining);
      } else {
        previousFreeCredits = 1;
      }

      if (previousFreeCredits > 0) {
        const remaining = previousFreeCredits - 1;
        const updatePayload: any = {
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
          creditType: 'free' as const,
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
  } catch (error: any) {
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
 */
export async function refundCredit(
  userId: string,
  amount: number,
  reason: string,
  originalTransactionId: string | null = null
): Promise<RefundCreditResult> {
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
    
    // Prevent overflow
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
      
      if (originalTransaction?.userId !== userId) {
        throw new Error('Original transaction does not belong to this user');
      }
      
      if (originalTransaction?.type !== 'consume') {
        throw new Error(`Cannot refund transaction of type ${originalTransaction.type}. Only consume transactions can be refunded.`);
      }
      
      const refundQuery = await db.collection(TRANSACTIONS_COLLECTION)
        .where('metadata.originalTransactionId', '==', originalTransactionId)
        .where('type', '==', 'refund')
        .limit(1)
        .get();
      
      if (!refundQuery.empty) {
        throw new Error(`Transaction ${originalTransactionId} was already refunded (refund transaction: ${refundQuery.docs[0].id})`);
      }
      
      const originalAmount = Math.abs((originalTransaction.amount as number) || 0);
      if (amount > originalAmount) {
        throw new Error(`Refund amount (${amount}) cannot exceed original transaction amount (${originalAmount})`);
      }
      
      console.log(`[CREDITS] [${requestId}] Verified original transaction: ${originalTransactionId}, original amount: ${originalAmount}`);
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId('refund', originalTransactionId || undefined, userId);
    
    // Check if transaction already processed (idempotency)
    const existingTransactionDoc = await db.collection(TRANSACTIONS_COLLECTION).doc(transactionId).get();
    
    if (existingTransactionDoc.exists) {
      console.log(`[CREDITS] [${requestId}] Transaction already processed: ${transactionId}`);
      const existing = existingTransactionDoc.data();
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: transactionId,
        creditsRefunded: existing?.amount as number || 0,
        remaining: (existing?.metadata as any)?.remaining || null
      };
    }
    
    // Use Firestore transaction for atomic credit refund
    const result = await db.runTransaction(async (transaction) => {
      const transactionDocRef = db.collection(TRANSACTIONS_COLLECTION).doc(transactionId);
      const existingTransactionDoc = await transaction.get(transactionDocRef);
      
      if (existingTransactionDoc.exists) {
        const existing = existingTransactionDoc.data();
        return {
          success: true,
          alreadyProcessed: true,
          transactionId: transactionId,
          creditsRefunded: existing?.amount as number || 0,
          remaining: (existing?.metadata as any)?.remaining || null
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
      const currentCredits = (entitlements?.spec_credits as number) || 0;
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
      
      // Record transaction
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
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[CREDITS] [${requestId}] ❌ Error refunding credits (${totalTime}ms):`, error);
    throw error;
  }
}

/**
 * Get user entitlements
 */
export async function getEntitlements(userId: string): Promise<EntitlementsResult> {
  try {
    // Get user document first to check if this is a new user
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    
    // Get entitlements document
    const entitlementsRef = db.collection(ENTITLEMENTS_COLLECTION).doc(userId);
    const entitlementsDoc = await entitlementsRef.get();
    
    let entitlements: any;
    let shouldCreateEntitlements = false;
    
    if (!entitlementsDoc.exists) {
      // Entitlements don't exist - check if this is a new user
      let isNewUserCheck = false;
      if (!userDoc.exists) {
        isNewUserCheck = true;
      } else {
        const userData = userDoc.data();
        if (userData?.createdAt) {
          const createdAt = (userData.createdAt as any).toDate ? (userData.createdAt as any).toDate() : new Date(userData.createdAt as string);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          isNewUserCheck = createdAt > fiveMinutesAgo;
        }
      }
      
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
    
    let user: any = null;

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
        unlimited: entitlements?.unlimited || false,
        spec_credits: entitlements?.spec_credits || 0,
        can_edit: entitlements?.can_edit || false,
        preserved_credits: entitlements?.preserved_credits || 0
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
 */
export async function checkAccess(userId: string): Promise<AccessCheckResult> {
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
      : 0;
    
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

