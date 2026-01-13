/**
 * Reset all users to free tier with 1 credit.
 * Usage: node backend/scripts/reset-all-users.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function resetUser(uid) {
  const creditsRef = db.collection('user_credits').doc(uid);
  const userRef = db.collection('users').doc(uid);
  const subRef = db.collection('subscriptions').doc(uid);

  const creditsUpdate = {
    userId: uid,
    balances: {
      paid: 0,
      free: 1,
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };

  const userUpdate = {
    plan: 'free',
    last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(creditsRef, creditsUpdate, { merge: true });
  batch.set(userRef, userUpdate, { merge: true });
  await batch.commit();

  const subDoc = await subRef.get();
  if (subDoc.exists) {
    await subRef.delete();
  }

  console.log(`✅ Reset user ${uid}`);
}

async function main() {
  try {
    const snapshot = await db.collection('user_credits').get();
    const userIds = snapshot.docs.map(doc => doc.id);

    console.log(`Found ${userIds.length} users in user_credits collection.`);

    for (const uid of userIds) {
      await resetUser(uid);
    }

    console.log('🎉 All users reset to free tier with 1 credit.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting users:', error);
    process.exit(1);
  }
}

main();

