const { db, admin } = require('./firebase-admin');

const PURCHASES_COLLECTION = 'purchases';

function getServerTimestamp() {
  if (admin && admin.firestore && admin.firestore.FieldValue) {
    return admin.firestore.FieldValue.serverTimestamp();
  }
  return new Date();
}

async function recordPurchase({
  orderId,
  orderNumber,
  userId,
  email,
  variantId,
  productId,
  productKey,
  productName,
  productType,
  credits,
  quantity = 1,
  total,
  currency = 'USD',
  testMode = false,
  subscriptionId = null,
  subscriptionStatus = null,
  subscriptionInterval = null,
  rawPayload = null,
  metadata = {}
}) {
  if (!orderId) {
    throw new Error('orderId is required to record a purchase');
  }

  const purchaseRef = db.collection(PURCHASES_COLLECTION).doc(orderId.toString());
  const existing = await purchaseRef.get();

  let normalizedCredits = null;
  if (typeof credits === 'number' && Number.isFinite(credits)) {
    normalizedCredits = credits;
  } else if (typeof credits === 'string' && credits !== 'unlimited') {
    const parsedCredits = Number(credits);
    normalizedCredits = Number.isNaN(parsedCredits) ? null : parsedCredits;
  }

  const purchaseData = {
    orderId: orderId ? orderId.toString() : null,
    orderNumber: orderNumber || null,
    userId: userId || null,
    email: email || null,
    variantId: variantId ? variantId.toString() : null,
    productId: productId ? productId.toString() : null,
    productKey: productKey || null,
    productName: productName || null,
    productType: productType || null,
    credits: normalizedCredits,
    quantity: quantity || 1,
    total: typeof total === 'number' ? total : null,
    currency: currency || 'USD',
    testMode: !!testMode,
    subscriptionId: subscriptionId ? subscriptionId.toString() : null,
    subscriptionStatus: subscriptionStatus || null,
    subscriptionInterval: subscriptionInterval || null,
    status: 'paid',
    rawPayload: rawPayload || null,
    metadata,
    updatedAt: getServerTimestamp()
  };

  if (!existing.exists) {
    purchaseData.createdAt = getServerTimestamp();
  } else if (!existing.data().createdAt) {
    purchaseData.createdAt = getServerTimestamp();
  }

  await purchaseRef.set(purchaseData, { merge: true });
  return purchaseData;
}

async function getPurchasesForUser(userId, { limit = 50 } = {}) {
  if (!userId) {
    return [];
  }

  const snapshot = await db
    .collection(PURCHASES_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getPurchaseById(orderId) {
  if (!orderId) {
    return null;
  }

  const doc = await db.collection(PURCHASES_COLLECTION).doc(orderId.toString()).get();
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  };
}

module.exports = {
  recordPurchase,
  getPurchasesForUser,
  getPurchaseById
};

