/**
 * Check Webhook Errors Script
 *
 * Usage: node backend/scripts/check-webhook-errors.js
 *
 * This script checks for webhook errors and problematic patterns
 */

const { db, admin } = require('../server/firebase-admin');

async function checkWebhookErrors() {
    try {
        console.log('\n🔍 Webhook Error Analysis');
        console.log('═══════════════════════════════════════════════════════════════════\n');

        // Check audit logs for errors
        console.log('📋 CHECKING AUDIT LOGS FOR ERRORS...');
        console.log('───────────────────────────────────────────────────────────────────');
        
        const auditSnapshot = await db.collection('audit_logs')
            .where('source', '==', 'lemon_webhook')
            .get();

        const allLogs = auditSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Total webhook audit logs: ${allLogs.length}\n`);

        // Analyze by action type
        const actions = {};
        allLogs.forEach(log => {
            const action = log.action || 'unknown';
            if (!actions[action]) {
                actions[action] = [];
            }
            actions[action].push(log);
        });

        console.log('📊 STATISTICS BY ACTION:');
        console.log('───────────────────────────────────────────────────────────────────');
        Object.entries(actions).forEach(([action, logs]) => {
            console.log(`  ${action}: ${logs.length} events`);
        });

        // Find errors
        const errors = [];
        const warnings = [];
        
        Object.entries(actions).forEach(([action, logs]) => {
            logs.forEach(log => {
                // Error actions
                if (action.includes('error') || action.includes('failed')) {
                    errors.push(log);
                }
                // Warning actions
                if (action.includes('pending') || action.includes('unhandled')) {
                    warnings.push(log);
                }
            });
        });

        console.log(`\n❌ ERRORS FOUND: ${errors.length}`);
        if (errors.length > 0) {
            console.log('───────────────────────────────────────────────────────────────────');
            errors.forEach((log, idx) => {
                console.log(`\nError ${idx + 1}:`);
                console.log(`  ID: ${log.id}`);
                console.log(`  Action: ${log.action}`);
                console.log(`  User ID: ${log.userId || 'N/A'}`);
                console.log(`  Event ID: ${log.eventId || 'N/A'}`);
                console.log(`  Timestamp: ${log.created_at ? log.created_at.toDate().toISOString() : 'N/A'}`);
                
                if (log.payload_json) {
                    try {
                        const payload = JSON.parse(log.payload_json);
                        console.log(`  Error Details:`, JSON.stringify(payload, null, 2));
                    } catch (e) {
                        console.log(`  Payload: ${log.payload_json}`);
                    }
                }
            });
        }

        console.log(`\n⚠️  WARNINGS FOUND: ${warnings.length}`);
        if (warnings.length > 0) {
            console.log('───────────────────────────────────────────────────────────────────');
            warnings.forEach((log, idx) => {
                console.log(`\nWarning ${idx + 1}:`);
                console.log(`  ID: ${log.id}`);
                console.log(`  Action: ${log.action}`);
                console.log(`  User ID: ${log.userId || 'N/A'}`);
                console.log(`  Event ID: ${log.eventId || 'N/A'}`);
                console.log(`  Timestamp: ${log.created_at ? log.created_at.toDate().toISOString() : 'N/A'}`);
            });
        }

        // Check for recent activity
        console.log('\n📅 RECENT ACTIVITY (Last 24 Hours):');
        console.log('───────────────────────────────────────────────────────────────────');
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLogs = allLogs.filter(log => {
            const timestamp = log.created_at ? log.created_at.toDate() : null;
            return timestamp && timestamp > oneDayAgo;
        });

        console.log(`Total recent logs: ${recentLogs.length}`);
        
        if (recentLogs.length > 0) {
            const recentActions = {};
            recentLogs.forEach(log => {
                const action = log.action || 'unknown';
                recentActions[action] = (recentActions[action] || 0) + 1;
            });
            
            Object.entries(recentActions).forEach(([action, count]) => {
                console.log(`  ${action}: ${count}`);
            });
        }

        // Check pending entitlements
        console.log('\n⏳ PENDING ENTITLEMENTS (Not Claimed):');
        console.log('───────────────────────────────────────────────────────────────────');
        
        const pendingSnapshot = await db.collection('pending_entitlements')
            .where('claimed', '==', false)
            .get();

        console.log(`Total pending: ${pendingSnapshot.size}`);
        
        if (!pendingSnapshot.empty) {
            pendingSnapshot.forEach((doc) => {
                const pending = doc.data();
                console.log(`\n  Email: ${pending.email}`);
                console.log(`  Created: ${pending.created_at ? pending.created_at.toDate().toISOString() : 'N/A'}`);
                console.log(`  Age: ${pending.created_at ? Math.round((Date.now() - pending.created_at.toDate().getTime()) / (1000 * 60 * 60)) : 'unknown'} hours`);
            });
        }

        // Check for orphaned purchases (no corresponding user)
        console.log('\n👤 CHECKING PURCHASES FOR ORPHANED RECORDS:');
        console.log('───────────────────────────────────────────────────────────────────');
        
        const purchasesSnapshot = await db.collection('purchases').get();
        let orphanedCount = 0;
        
        if (!purchasesSnapshot.empty) {
            for (const doc of purchasesSnapshot.docs) {
                const purchase = doc.data();
                if (purchase.userId) {
                    const userDoc = await db.collection('users').doc(purchase.userId).get();
                    if (!userDoc.exists) {
                        orphanedCount++;
                        console.log(`\n  Orphaned purchase: ${doc.id}`);
                        console.log(`    User ID: ${purchase.userId}`);
                        console.log(`    Order ID: ${purchase.lemon_order_id}`);
                    }
                }
            }
        }
        
        console.log(`Total orphaned purchases: ${orphanedCount}`);

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`Total webhook events: ${allLogs.length}`);
        console.log(`Errors: ${errors.length}`);
        console.log(`Warnings: ${warnings.length}`);
        console.log(`Recent activity (24h): ${recentLogs.length}`);
        console.log(`Pending entitlements: ${pendingSnapshot.size}`);
        console.log(`Orphaned purchases: ${orphanedCount}`);
        
        if (errors.length > 0) {
            console.log('\n⚠️  WARNING: Errors detected! Check the details above.');
        } else if (warnings.length > 0) {
            console.log('\nℹ️  No errors, but some warnings found. Check details above.');
        } else {
            console.log('\n✅ No errors or warnings found!');
        }

        console.log('\n✅ Check completed!\n');

    } catch (error) {
        console.error('\n❌ Error checking webhook errors:', error);
        process.exit(1);
    }
}

checkWebhookErrors();
