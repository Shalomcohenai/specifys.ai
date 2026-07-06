#!/usr/bin/env node
/**
 * Resend purchase confirmation emails for Lemon Squeezy orders.
 *
 * Usage:
 *   node backend/scripts/resend-purchase-emails.js --emails=a@x.com,b@y.com
 *   node backend/scripts/resend-purchase-emails.js --order-ids=123,456
 *   node backend/scripts/resend-purchase-emails.js --emails=a@x.com --dry-run
 *   node backend/scripts/resend-purchase-emails.js --emails=a@x.com --force
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db, auth, admin } = require('../server/firebase-admin');
const emailService = require('../server/email-service');

const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';

function parseArgs(argv) {
  const args = {
    emails: [],
    orderIds: [],
    dryRun: false,
    force: false
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg.startsWith('--emails=')) {
      args.emails = arg
        .slice('--emails='.length)
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--order-ids=')) {
      args.orderIds = arg
        .slice('--order-ids='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }

  return args;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function emailAlreadySent(orderId) {
  const orderDoc = await db.collection('orders').doc(orderId.toString()).get();
  if (!orderDoc.exists) return false;
  return orderDoc.data().purchaseEmailSent === true;
}

async function markEmailSent(orderId) {
  await db.collection('orders').doc(orderId.toString()).set(
    {
      purchaseEmailSent: true,
      purchaseEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      resentByScript: true
    },
    { merge: true }
  );
}

async function shouldSendOperationalEmail(userId) {
  if (!userId) return true;
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return true;
  const prefs = userDoc.data().emailPreferences || {};
  return prefs.operational !== false;
}

async function resolveRecipient(purchase) {
  const userId = purchase.userId || null;
  let userEmail = purchase.userEmail || purchase.email || null;
  let displayName = userEmail ? userEmail.split('@')[0] : 'Customer';

  if (userId) {
    try {
      const userRecord = await auth.getUser(userId);
      userEmail = userRecord.email || userEmail;
      if (userRecord.displayName) {
        displayName = userRecord.displayName;
      } else {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists && userDoc.data().displayName) {
          displayName = userDoc.data().displayName;
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not load Auth user ${userId}: ${err.message}`);
    }
  }

  return { userId, userEmail, displayName };
}

async function findLatestPurchaseByEmail(email) {
  const normalized = email.trim().toLowerCase();

  const byUserEmail = await db
    .collection('purchases')
    .where('userEmail', '==', normalized)
    .get();

  const byEmail = await db
    .collection('purchases')
    .where('email', '==', normalized)
    .get();

  const merged = new Map();
  for (const doc of [...byUserEmail.docs, ...byEmail.docs]) {
    merged.set(doc.id, { id: doc.id, ...doc.data() });
  }

  const purchases = Array.from(merged.values()).filter((p) => p.status === 'paid' || !p.status);

  if (purchases.length === 0) {
    return null;
  }

  purchases.sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });

  return purchases[0];
}

async function loadPurchasesByOrderIds(orderIds) {
  const purchases = [];
  for (const orderId of orderIds) {
    const doc = await db.collection('purchases').doc(orderId.toString()).get();
    if (doc.exists) {
      purchases.push({ id: doc.id, ...doc.data() });
    } else {
      console.warn(`  ⚠️  Purchase not found for order ID: ${orderId}`);
    }
  }
  return purchases;
}

async function getDisplayAmountCents(purchase) {
  if (typeof purchase.subtotal === 'number') {
    return purchase.subtotal;
  }
  const attrs = purchase.rawPayload?.data?.attributes;
  if (attrs && typeof attrs.subtotal === 'number') {
    return attrs.subtotal;
  }
  return typeof purchase.total === 'number' ? purchase.total : 0;
}

async function sendForPurchase(purchase, options) {
  const orderId = purchase.orderId || purchase.id;
  const label = `${orderId} (${purchase.userEmail || purchase.email || 'no-email'})`;

  if (!orderId) {
    console.log(`  ❌ Skip — missing orderId: ${label}`);
    return { skipped: true, reason: 'missing_order_id' };
  }

  if (!options.force && (await emailAlreadySent(orderId))) {
    console.log(`  ⏭️  Skip — email already marked sent: ${label}`);
    return { skipped: true, reason: 'already_sent' };
  }

  const { userId, userEmail, displayName } = await resolveRecipient(purchase);
  if (!userEmail) {
    console.log(`  ❌ Skip — no recipient email: ${label}`);
    return { skipped: true, reason: 'no_email' };
  }

  if (!(await shouldSendOperationalEmail(userId))) {
    console.log(`  ⏭️  Skip — user disabled operational emails: ${userEmail}`);
    return { skipped: true, reason: 'operational_disabled' };
  }

  const productName = purchase.productName || 'Specifys Pro';
  const amount = await getDisplayAmountCents(purchase);
  const currency = purchase.currency || 'USD';

  console.log(`  📧 ${options.dryRun ? '[DRY RUN] Would send to' : 'Sending to'} ${userEmail} — ${productName} (${orderId})`);

  if (options.dryRun) {
    return { dryRun: true, userEmail, orderId };
  }

  const result = await emailService.sendPurchaseConfirmationEmail(
    userEmail,
    displayName,
    userId,
    productName,
    amount,
    currency,
    orderId.toString(),
    baseUrl
  );

  if (result.success) {
    await markEmailSent(orderId);
    console.log(`  ✅ Sent — messageId: ${result.messageId || 'n/a'}`);
    return { success: true, userEmail, orderId, messageId: result.messageId };
  }

  console.log(`  ❌ Failed — ${result.error || 'unknown error'}`);
  return { success: false, userEmail, orderId, error: result.error };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!emailService.isConfigured()) {
    console.error('❌ RESEND_API_KEY is not configured. Cannot send emails.');
    process.exit(1);
  }

  let purchases = [];

  if (options.orderIds.length > 0) {
    purchases = await loadPurchasesByOrderIds(options.orderIds);
  } else if (options.emails.length > 0) {
    for (const email of options.emails) {
      const purchase = await findLatestPurchaseByEmail(email);
      if (!purchase) {
        console.warn(`⚠️  No paid purchase found for: ${email}`);
        continue;
      }
      purchases.push(purchase);
    }
  } else {
    console.error('Usage: node backend/scripts/resend-purchase-emails.js --emails=a@x.com,b@y.com');
    console.error('   or: node backend/scripts/resend-purchase-emails.js --order-ids=123,456');
    process.exit(1);
  }

  if (purchases.length === 0) {
    console.error('❌ No purchases to process.');
    process.exit(1);
  }

  console.log(`\n📬 Resend purchase confirmation emails (${purchases.length} purchase(s))`);
  console.log('══════════════════════════════════════════════════════════\n');

  const results = [];
  for (const purchase of purchases) {
    results.push(await sendForPurchase(purchase, options));
  }

  const sent = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.success === false).length;
  const dryRun = results.filter((r) => r.dryRun).length;

  console.log('\n📊 Summary');
  console.log(`  sent: ${sent}, skipped: ${skipped}, failed: ${failed}, dry-run: ${dryRun}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err.message);
  process.exit(1);
});
