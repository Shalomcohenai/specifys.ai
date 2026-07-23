#!/usr/bin/env node
/**
 * Verify Resend email integration (config + optional real send + email_sent logging).
 *
 * Usage (from repo root or backend/):
 *   node backend/scripts/verify-resend-email.js
 *   node backend/scripts/verify-resend-email.js --dry-run
 *   node backend/scripts/verify-resend-email.js --send --to=you@example.com
 *   node backend/scripts/verify-resend-email.js --send --to=delivered@resend.dev --skip-firestore
 *
 * Required env (backend/.env):
 *   RESEND_API_KEY          Resend API key (re_...)
 *   RESEND_FROM_EMAIL       Verified sender (e.g. Specifys-Ai-Team@specifys-ai.com)
 *
 * Optional:
 *   RESEND_AUDIENCE_ID / RESEND_SEGMENT_ID   Marketing audience sync
 *   BASE_URL / SITE_URL                     Link + click-tracking base
 *   FIREBASE_*                              Needed to write/read email_sent (unless --skip-firestore)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = {
    dryRun: false,
    send: false,
    skipFirestore: false,
    to: null
  };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--send') args.send = true;
    else if (arg === '--skip-firestore') args.skipFirestore = true;
    else if (arg.startsWith('--to=')) args.to = arg.slice('--to='.length).trim();
  }
  // Default: dry-run when neither flag set; --send implies real send
  if (!args.send && !args.dryRun) {
    args.dryRun = true;
  }
  return args;
}

function mask(value) {
  if (!value || typeof value !== 'string') return '(unset)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}…${value.slice(-4)} (len=${value.length})`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Specifys-Ai-Team@specifys-ai.com';
  const audienceId = process.env.RESEND_AUDIENCE_ID || process.env.RESEND_SEGMENT_ID || null;
  const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';

  console.log('\n=== Specifys Resend email verification ===\n');
  console.log('Config:');
  console.log(`  RESEND_API_KEY:     ${apiKey ? mask(apiKey) : '(MISSING)'}`);
  console.log(`  RESEND_FROM_EMAIL:  ${fromEmail}`);
  console.log(`  RESEND_AUDIENCE_ID: ${audienceId || '(optional, unset)'}`);
  console.log(`  BASE_URL/SITE_URL:  ${baseUrl}`);
  console.log(`  Mode:               ${args.send ? 'SEND' : 'DRY-RUN'}`);

  if (!apiKey) {
    console.error('\n❌ RESEND_API_KEY is not set. Add it to backend/.env and re-run.');
    process.exit(1);
  }
  if (!apiKey.startsWith('re_')) {
    console.error('\n❌ RESEND_API_KEY should start with re_');
    process.exit(1);
  }

  // Load mailer after dotenv so lazy/constructor init sees the key
  const emailService = require('../server/email-service');
  const health = await emailService.checkHealth();
  console.log('\nEmailService.checkHealth():');
  console.log(`  configured: ${health.configured}`);
  console.log(`  success:    ${health.success}`);
  console.log(`  fromEmail:  ${health.fromEmail}`);
  if (health.error) {
    console.error(`  error:      ${health.error}`);
    process.exit(1);
  }

  // Probe SDK response shape without relying on Firestore
  const { Resend } = require('resend');
  const resend = new Resend(apiKey);
  const probe = await resend.emails.send({
    from: fromEmail,
    to: 'not-an-email',
    subject: 'shape probe',
    html: '<p>probe</p>'
  });
  const shapeOk = probe && Object.prototype.hasOwnProperty.call(probe, 'data')
    && Object.prototype.hasOwnProperty.call(probe, 'error');
  console.log('\nResend SDK response shape:');
  console.log(`  keys: ${Object.keys(probe || {}).join(', ')}`);
  console.log(`  expects data/error wrapper: ${shapeOk ? 'yes' : 'UNEXPECTED'}`);
  if (probe.error) {
    console.log(`  validation probe error (expected): ${probe.error.message}`);
  }

  if (!shapeOk) {
    console.error('\n❌ Unexpected Resend response shape — email-service _send() may need updating.');
    process.exit(1);
  }

  if (args.dryRun && !args.send) {
    console.log('\n✅ Dry-run OK. Mailer is configured and SDK shape matches email-service._send().');
    console.log('   Real send: node backend/scripts/verify-resend-email.js --send --to=you@example.com');
    console.log('   Resend test inbox: --to=delivered@resend.dev');
    process.exit(0);
  }

  const to = args.to || process.env.TEST_EMAIL || process.env.FEEDBACK_EMAIL || 'delivered@resend.dev';
  if (!to.includes('@')) {
    console.error('\n❌ Invalid --to address');
    process.exit(1);
  }

  console.log(`\nSending test email via EmailService.sendTestEmail → ${to} ...`);
  const sendResult = await emailService.sendTestEmail(to, baseUrl);
  if (!sendResult.success) {
    console.error(`\n❌ Send failed: ${sendResult.error}`);
    process.exit(1);
  }
  if (!sendResult.messageId) {
    console.error('\n❌ Send reported success but messageId is missing (SDK unwrap bug).');
    process.exit(1);
  }
  console.log(`  messageId: ${sendResult.messageId}`);

  if (args.skipFirestore) {
    console.log('\n✅ Send OK (--skip-firestore). Skipping email_sent check.');
    process.exit(0);
  }

  // Confirm email_sent was written
  const { db } = require('../server/firebase-admin');
  console.log('\nChecking Firestore email_sent for this messageId...');
  await new Promise((r) => setTimeout(r, 800));

  let found = null;
  const recent = await db.collection('email_sent').orderBy('timestamp', 'desc').limit(25).get();
  recent.docs.forEach((doc) => {
    const data = doc.data();
    if (data?.metadata?.messageId === sendResult.messageId) {
      found = { id: doc.id, ...data };
    }
  });

  if (!found) {
    // Fallback without orderBy (missing index)
    const snap = await db.collection('email_sent').limit(50).get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data?.metadata?.messageId === sendResult.messageId) {
        found = { id: doc.id, ...data };
      }
    });
  }

  if (!found) {
    console.error('\n❌ email_sent record not found for messageId. Check Firebase credentials / logging path.');
    process.exit(1);
  }

  console.log(`  email_sent doc: ${found.id}`);
  console.log(`  category: ${found.category}, eventName: ${found.eventName}`);
  console.log('\n✅ Resend send + email_sent logging verified.');
  console.log('   Click tracking: GET /api/email/track?et=...&lt=...&uid=...&target=... → email_clicks');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ verify-resend-email failed:', err.message);
  if (err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
});
