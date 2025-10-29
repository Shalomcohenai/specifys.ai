/**
 * Initialize public stats document in Firestore
 * Run this script once to create the initial public_stats document
 */

const { db, admin } = require('../firebase-admin');

async function initPublicStats() {
  try {
    console.log('Initializing public stats document...');
    
    // Get current count
    const specsSnapshot = await db.collection('specs').get();
    const specsCount = specsSnapshot.size;
    
    // Create or update the public stats document
    await db.collection('public_stats').doc('counts').set({
      specsCount: specsCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Public stats initialized with specsCount: ${specsCount}`);
    
  } catch (error) {
    console.error('❌ Error initializing public stats:', error);
    process.exit(1);
  }
}

// Run the initialization
initPublicStats()
  .then(() => {
    console.log('✅ Initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  });

