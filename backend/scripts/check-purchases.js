/**
 * Check All Purchases Script
 *
 * Usage: node backend/scripts/check-purchases.js
 *
 * This script checks all purchases and audit logs in the system
 */

const { db, admin } = require('../server/firebase-admin');

async function checkPurchases() {
    try {
        console.log('\n💳 Purchase System Report');
        console.log('=====================================\n');

        // Check purchases collection
        console.log('📦 PURCHASES COLLECTION:');
        console.log('────────────────────────────────────');
        const purchasesSnapshot = await db.collection('purchases').get();
        console.log(`Total purchases: ${purchasesSnapshot.size}`);

        if (!purchasesSnapshot.empty) {
            purchasesSnapshot.forEach((doc) => {
                const purchase = doc.data();
                console.log(`\nPurchase ID: ${doc.id}`);
                console.log(`  User ID: ${purchase.userId || 'N/A'}`);
                console.log(`  Order ID: ${purchase.lemon_order_id || 'N/A'}`);
                console.log(`  Amount: $${((purchase.total_amount_cents || 0) / 100).toFixed(2)}`);
                console.log(`  Credits Granted: ${purchase.credits_granted || 0}`);
                console.log(`  Status: ${purchase.status || 'N/A'}`);
                console.log(`  Purchased At: ${purchase.purchased_at ? purchase.purchased_at.toDate().toISOString() : 'N/A'}`);
            });
        } else {
            console.log('  No purchases found');
        }

        // Check audit logs (simpler query)
        console.log('\n📋 AUDIT LOGS:');
        console.log('────────────────────────────────────');
        const auditSnapshot = await db.collection('audit_logs').limit(20).get();

        console.log(`Total audit logs: ${auditSnapshot.size}`);

        let webhookLogs = 0;
        if (!auditSnapshot.empty) {
            auditSnapshot.forEach((doc) => {
                const log = doc.data();
                if (log.source === 'lemon_webhook') {
                    webhookLogs++;
                    console.log(`\nAudit Log ID: ${doc.id}`);
                    console.log(`  Action: ${log.action}`);
                    console.log(`  Event ID: ${log.eventId}`);
                    console.log(`  User ID: ${log.userId || 'N/A'}`);
                    console.log(`  Timestamp: ${log.timestamp ? log.timestamp.toDate().toISOString() : 'N/A'}`);

                    if (log.payload) {
                        if (log.action === 'order_created' && log.payload.credits_granted) {
                            console.log(`  Credits Granted: ${log.payload.credits_granted}`);
                        }
                        if (log.action === 'order_created' && log.payload.order_id) {
                            console.log(`  Order ID: ${log.payload.order_id}`);
                        }
                    }
                }
            });
        }

        console.log(`\nWebhook-related logs: ${webhookLogs}`);

        // Check pending entitlements
        console.log('\n⏳ PENDING ENTITLEMENTS:');
        console.log('────────────────────────────────────');
        const pendingSnapshot = await db.collection('pending_entitlements').get();
        console.log(`Total pending entitlements: ${pendingSnapshot.size}`);

        if (!pendingSnapshot.empty) {
            pendingSnapshot.forEach((doc) => {
                const pending = doc.data();
                console.log(`\nPending ID: ${doc.id}`);
                console.log(`  Email: ${pending.email}`);
                console.log(`  Claimed: ${pending.claimed ? 'YES' : 'NO'}`);
                console.log(`  Created: ${pending.created_at ? pending.created_at.toDate().toISOString() : 'N/A'}`);
                if (pending.claimed_at) {
                    console.log(`  Claimed At: ${pending.claimed_at.toDate().toISOString()}`);
                }
            });
        } else {
            console.log('  No pending entitlements');
        }

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log('────────────────────────────────────');
        console.log(`Total Purchases: ${purchasesSnapshot.size}`);
        console.log(`Total Webhook Events: ${auditSnapshot.size}`);
        console.log(`Pending Entitlements: ${pendingSnapshot.size}`);

        if (purchasesSnapshot.size === 0 && auditSnapshot.size === 0) {
            console.log('\n⚠️  WARNING: No purchases or webhook events found!');
            console.log('   This could mean:');
            console.log('   - No purchases have been made yet');
            console.log('   - Webhooks are not being received');
            console.log('   - Lemon Squeezy integration issues');
        }

        console.log('\n✅ Check completed!\n');

    } catch (error) {
        console.error('\n❌ Error checking purchases:', error);
        process.exit(1);
    }
}

checkPurchases();
