const { db } = require('./firebase-admin');

const TEST_PURCHASES_COLLECTION = 'test_purchases';

/**
 * Record a test purchase in Firestore
 * @param {string} userId - Firebase user ID
 * @param {string} orderId - Lemon Squeezy order ID
 * @param {string} variantId - Product variant ID
 * @param {Object} metadata - Additional purchase metadata
 * @returns {Promise<Object>} - Created purchase document
 */
async function recordTestPurchase(userId, orderId, variantId, metadata = {}) {
  try {
    const purchaseData = {
      userId: userId || null,
      email: metadata.email || null,
      variantId: variantId || null,
      productId: metadata.productId || null,
      productKey: metadata.productKey || null,
      productName: metadata.productName || null,
      orderId: orderId,
      orderNumber: metadata.orderNumber || null,
      amount: metadata.amount || 0,
      currency: metadata.currency || 'USD',
      quantity: metadata.quantity || 1,
      testMode: true,
      createdAt: new Date(),
      metadata: metadata.metadata || {}
    };

    // Use orderId as document ID to prevent duplicates
    const purchaseRef = db.collection(TEST_PURCHASES_COLLECTION).doc(orderId);
    
    // Check if purchase already exists
    const existingDoc = await purchaseRef.get();
    if (existingDoc.exists) {
      console.log(`Purchase ${orderId} already exists, skipping`);
      return existingDoc.data();
    }

    await purchaseRef.set(purchaseData);
    
    console.log(`Test purchase recorded: ${orderId} for user ${userId}`);
    return purchaseData;
  } catch (error) {
    console.error('Error recording test purchase:', error);
    throw error;
  }
}

/**
 * Get total count of test purchases
 * @returns {Promise<number>} - Total purchase count
 */
async function getTestPurchaseCount() {
  try {
    const snapshot = await db.collection(TEST_PURCHASES_COLLECTION).get();
    return snapshot.size;
  } catch (error) {
    console.error('Error getting test purchase count:', error);
    throw error;
  }
}

/**
 * Get test purchases for a specific user
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Array>} - Array of user's purchases
 */
async function getUserTestPurchases(userId) {
  try {
    if (!userId) {
      return [];
    }

    const snapshot = await db
      .collection(TEST_PURCHASES_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting user test purchases:', error);
    throw error;
  }
}

/**
 * Get purchase by order ID
 * @param {string} orderId - Lemon Squeezy order ID
 * @returns {Promise<Object|null>} - Purchase data or null
 */
async function getPurchaseByOrderId(orderId) {
  try {
    const doc = await db.collection(TEST_PURCHASES_COLLECTION).doc(orderId).get();
    if (!doc.exists) {
      return null;
    }
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error getting purchase by order ID:', error);
    throw error;
  }
}

module.exports = {
  recordTestPurchase,
  getTestPurchaseCount,
  getUserTestPurchases,
  getPurchaseByOrderId
};
