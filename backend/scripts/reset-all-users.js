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
  const entRef = db.collection('entitlements').doc(uid);
  const userRef = db.collection('users').doc(uid);
  const subRef = db.collection('subscriptions').doc(uid);

  const entUpdate = {
    unlimited: false,
    can_edit: false,
    spec_credits: 1,
    preserved_credits: admin.firestore.FieldValue.delete(),
    unlimited_since: admin.firestore.FieldValue.delete(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };

  const userUpdate = {
    plan: 'free',
    free_specs_remaining: 1,
    last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(entRef, entUpdate, { merge: true });
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
    const snapshot = await db.collection('entitlements').get();
    const userIds = snapshot.docs.map(doc => doc.id);

    console.log(`Found ${userIds.length} users in entitlements collection.`);

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

