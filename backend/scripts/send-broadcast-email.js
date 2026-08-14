#!/usr/bin/env node
/**
 * Broadcast product-update email via Resend + Specifys email base template.
 *
 * Usage (from repo root):
 *   node backend/scripts/send-broadcast-email.js --dry-run
 *   node backend/scripts/send-broadcast-email.js --send --to=you@example.com
 *   node backend/scripts/send-broadcast-email.js --send --limit=5
 *   node backend/scripts/send-broadcast-email.js --send
 *   node backend/scripts/send-broadcast-email.js --send --all-users
 *
 * Default audience: newsletter subscribers
 *   (newsletterSubscribed !== false AND emailPreferences.newsletter !== false)
 *
 * Required env (backend/.env): RESEND_API_KEY, RESEND_FROM_EMAIL, Firebase Admin
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../server/firebase-admin');
const emailService = require('../server/email-service');
const emailTemplates = require('../server/email-templates');
const emailTracking = require('../server/email-tracking-service');

const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://www.specifys-ai.com';

const DEFAULT_SUBJECT = 'Your idea. One chat. A full spec.';
const DEFAULT_HEADER = 'Living Brief is live';
const CAMPAIGN_ID = 'broadcast-living-brief-launch';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    send: false,
    allUsers: false,
    forcePrefs: false,
    skipSent: false,
    subject: DEFAULT_SUBJECT,
    to: null,
    limit: null,
    batchSize: 10,
    delayMs: 1000,
    campaignId: CAMPAIGN_ID
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--send') args.send = true;
    else if (arg === '--all-users') args.allUsers = true;
    else if (arg === '--force-prefs') args.forcePrefs = true;
    else if (arg === '--skip-sent') args.skipSent = true;
    else if (arg.startsWith('--subject=')) args.subject = arg.slice('--subject='.length);
    else if (arg.startsWith('--to=')) args.to = arg.slice('--to='.length).trim().toLowerCase();
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--batch-size=')) args.batchSize = Number(arg.slice('--batch-size='.length)) || 10;
    else if (arg.startsWith('--delay-ms=')) args.delayMs = Number(arg.slice('--delay-ms='.length)) || 1000;
    else if (arg.startsWith('--campaign-id=')) args.campaignId = arg.slice('--campaign-id='.length);
  }

  if (!args.send && !args.dryRun) args.dryRun = true;
  return args;
}

function wantsNewsletter(userData, args) {
  if (args.forcePrefs) return true;
  if (userData.emailPreferences?.newsletter === false) return false;
  if (userData.emailPreferences?.marketing === false) return false;
  if (!args.allUsers && userData.newsletterSubscribed === false) return false;
  return true;
}

function buildHtml({ userName, userId, campaignId }) {
  // Direct site links — tracking redirect (/api/email/track) 404s on the static host
  const startUrl = `${baseUrl.replace(/\/$/, '')}/`;
  const proUrl = `${baseUrl.replace(/\/$/, '')}/pages/pricing.html`;
  const unsubscribeUrl = `${baseUrl.replace(/\/$/, '')}/pages/unsubscribe.html`;

  const bodyContent = `
      <p class="content-text" style="text-align:center;">
        Hello ${userName},
      </p>
      <p class="content-text" style="text-align:center;">
        Specifys just got faster. Meet <strong>Living Brief</strong> -
        describe your product in a chat, and get a full build-ready specification.
      </p>
      <p class="content-text" style="text-align:center;">
        No long forms. Just talk, refine, and generate.
      </p>
      <div class="btn-container">
        <a href="${startUrl}" class="btn">Try Living Brief free</a>
      </div>
      <p class="content-text" style="text-align:center;">
        Want unlimited specs? <a href="${proUrl}" style="color:#FF6B35;font-weight:600;text-decoration:none;">Go Pro for $1.99/mo</a>
      </p>
      <p class="content-text" style="text-align:center;">
        Happy building,<br>
        <strong>The Specifys.ai Team</strong>
      </p>
  `;

  return {
    html: emailTemplates.getBaseTemplate(DEFAULT_HEADER, bodyContent, true, unsubscribeUrl),
    unsubscribeUrl,
    startUrl,
    proUrl
  };
}

async function loadAlreadySentEmails(campaignId) {
  const sent = new Set();
  try {
    const snap = await db.collection('email_sent').where('category', '==', campaignId).get();
    snap.forEach((doc) => {
      const email = String(doc.data().recipientEmail || '')
        .trim()
        .toLowerCase();
      if (email) sent.add(email);
    });
  } catch (err) {
    console.warn(`Could not query email_sent by category (${err.message}) — scanning…`);
    const snap = await db.collection('email_sent').limit(20000).get();
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.category !== campaignId) return;
      const email = String(data.recipientEmail || '')
        .trim()
        .toLowerCase();
      if (email) sent.add(email);
    });
  }
  return sent;
}

async function loadRecipients(args) {
  if (args.to) {
    const snap = await db.collection('users').where('email', '==', args.to).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      return [{
        userId: doc.id,
        email: data.email || args.to,
        name: data.displayName || (data.email || args.to).split('@')[0],
        data
      }];
    }
    return [{
      userId: null,
      email: args.to,
      name: args.to.split('@')[0],
      data: {}
    }];
  }

  const alreadySent = args.skipSent ? await loadAlreadySentEmails(args.campaignId) : new Set();
  if (args.skipSent) {
    console.log(`Skipping ${alreadySent.size} addresses already sent for ${args.campaignId}`);
  }

  const snap = await db.collection('users').get();
  const recipients = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (!wantsNewsletter(data, args)) continue;
    if (alreadySent.has(email)) continue;

    recipients.push({
      userId: doc.id,
      email,
      name: data.displayName || email.split('@')[0],
      data
    });

    if (args.limit && recipients.length >= args.limit) break;
  }

  return recipients;
}

async function sendOne(recipient, args) {
  const { html } = buildHtml({
    userName: recipient.name,
    userId: recipient.userId,
    campaignId: args.campaignId
  });

  if (args.dryRun || !args.send) {
    return { success: true, dryRun: true };
  }

  if (!emailService.isConfigured()) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const result = await emailService._send({
      from: emailService.fromEmail,
      to: recipient.email,
      subject: args.subject,
      html
    });

    if (result.id) {
      emailTracking.recordEmailSent(
        recipient.userId,
        recipient.email,
        args.subject,
        args.campaignId,
        'broadcast_sent',
        { messageId: result.id, campaignId: args.campaignId }
      ).catch(() => {});
    }

    return { success: true, messageId: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!emailService.isConfigured()) {
    console.error('Email service not configured. Set RESEND_API_KEY / RESEND_FROM_EMAIL in backend/.env');
    process.exit(1);
  }

  const recipients = await loadRecipients(args);

  console.log(`\nCampaign: ${args.campaignId}`);
  console.log(`Subject:  ${args.subject}`);
  console.log(`Mode:     ${args.send ? 'SEND' : 'DRY-RUN'}`);
  console.log(`Audience: ${args.to ? `single (${args.to})` : args.allUsers ? 'all users (respecting prefs)' : 'newsletter subscribers'}`);
  console.log(`Count:    ${recipients.length}\n`);

  if (!recipients.length) {
    console.log('No recipients. Exiting.');
    return;
  }

  let sent = 0;
  let failed = 0;
  let listed = 0;
  let stopForQuota = false;

  for (let i = 0; i < recipients.length; i += args.batchSize) {
    if (stopForQuota) break;
    const batch = recipients.slice(i, i + args.batchSize);

    await Promise.all(
      batch.map(async (r) => {
        if (stopForQuota) return;
        const result = await sendOne(r, args);
        if (result.dryRun) {
          listed++;
          console.log(`[dry-run] ${r.email} (${r.name})`);
          return;
        }
        if (result.success) {
          sent++;
          console.log(`✓ ${r.email}  ${result.messageId || ''}`);
        } else {
          failed++;
          console.warn(`✗ ${r.email}  ${result.error || 'unknown error'}`);
          if (/daily email sending quota|rate.?limit/i.test(result.error || '')) {
            stopForQuota = true;
          }
        }
      })
    );

    if (i + args.batchSize < recipients.length && !stopForQuota) {
      await new Promise((resolve) => setTimeout(resolve, args.delayMs));
    }
  }

  console.log(`\nDone. sent=${sent} failed=${failed} dryRunListed=${listed}${stopForQuota ? ' (stopped: quota)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
