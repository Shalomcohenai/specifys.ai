/**
 * Sprint B — Product-side lifecycle email hooks & jobs.
 * Transport/Resend config is owned by the email agent; this module only calls EmailService.
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const emailService = require('./email-service');
const specEvents = require('./spec-events');

const MS_PER_HOUR = 60 * 60 * 1000;
const OVERVIEW_STUCK_HOURS = 24;
const UNFINISHED_HOURS = 24;
const MAX_PER_CYCLE = 25;

let listenersRegistered = false;

function getBaseUrl() {
  return process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
}

function parseTs(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOverviewOnly(status) {
  if (!status || status.overview !== 'ready') return false;
  const downstream = ['technical', 'market', 'design', 'architecture', 'visibility', 'prompts'];
  return downstream.every((k) => {
    const s = status[k];
    return !s || s === 'pending';
  });
}

function isUnfinishedDraft(status) {
  if (!status) return true;
  if (status.overview === 'generating' || status.overview === 'pending') return true;
  if (!status.overview) return true;
  return false;
}

async function loadUserContact(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data() || {};
  const email = data.email;
  if (!email) return null;
  const prefs = data.emailPreferences || {};
  if (prefs.operational === false || prefs.specNotifications === false) {
    return null;
  }
  return {
    email,
    name: data.displayName || email.split('@')[0],
    data,
    prefs
  };
}

/**
 * Fire upgrade offer when free credits hit zero (idempotent per user).
 */
async function maybeSendUpgradeOfferAfterConsume(userId, consumeResult) {
  try {
    if (!userId || !consumeResult || consumeResult.unlimited) return { skipped: true, reason: 'unlimited_or_missing' };
    if (consumeResult.remaining !== 0 && consumeResult.remaining !== null) {
      return { skipped: true, reason: 'still_has_credits' };
    }

    const contact = await loadUserContact(userId);
    if (!contact) return { skipped: true, reason: 'no_contact' };
    if (contact.prefs.marketing === false) return { skipped: true, reason: 'marketing_off' };
    if (contact.data.upgradeOfferEmailSentAt) return { skipped: true, reason: 'already_sent' };

    const result = await emailService.sendUpgradeOfferEmail(
      contact.email,
      contact.name,
      userId,
      getBaseUrl()
    );

    if (result.success) {
      await db.collection('users').doc(userId).set({
        upgradeOfferEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return result;
  } catch (error) {
    logger.warn({ userId, error: error.message }, '[lifecycle-email] maybeSendUpgradeOfferAfterConsume failed');
    return { success: false, error: error.message };
  }
}

/**
 * When prompts become ready, send Cursor/MCP activation email (once per spec).
 */
async function maybeSendPromptsReadyEmail(specId) {
  try {
    const specRef = db.collection('specs').doc(specId);
    const snap = await specRef.get();
    if (!snap.exists) return { skipped: true, reason: 'missing_spec' };
    const spec = snap.data() || {};
    if (spec.promptsReadyMcpEmailSentAt) return { skipped: true, reason: 'already_sent' };
    if (spec.status?.prompts !== 'ready') return { skipped: true, reason: 'prompts_not_ready' };

    const userId = spec.userId;
    if (!userId) return { skipped: true, reason: 'no_user' };
    const contact = await loadUserContact(userId);
    if (!contact) return { skipped: true, reason: 'no_contact' };

    const result = await emailService.sendPromptsReadyMcpEmail(
      contact.email,
      contact.name,
      spec.title || 'App Specification',
      specId,
      userId,
      getBaseUrl()
    );

    if (result.success) {
      await specRef.set({
        promptsReadyMcpEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return result;
  } catch (error) {
    logger.warn({ specId, error: error.message }, '[lifecycle-email] maybeSendPromptsReadyEmail failed');
    return { success: false, error: error.message };
  }
}

function registerLifecycleEmailListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  specEvents.on('spec.update', (payload) => {
    if (payload?.stage === 'prompts' && payload?.status === 'ready' && payload?.specId) {
      maybeSendPromptsReadyEmail(payload.specId).catch(() => {});
    }
  });

  specEvents.on('spec.complete', (payload) => {
    if (payload?.results?.prompts && payload?.specId) {
      maybeSendPromptsReadyEmail(payload.specId).catch(() => {});
    }
  });

  logger.info('[lifecycle-email] Spec event listeners registered (prompts-ready MCP)');
}

/**
 * Daily-ish job: overview-only for ~24h+, unfinished drafts ~24h+.
 */
async function runLifecycleActivationEmailJob() {
  const requestId = `lifecycle-email-${Date.now()}`;
  const baseUrl = getBaseUrl();
  const now = Date.now();
  const overviewCutoff = new Date(now - OVERVIEW_STUCK_HOURS * MS_PER_HOUR);
  const unfinishedCutoff = new Date(now - UNFINISHED_HOURS * MS_PER_HOUR);

  const stats = { overviewStuck: 0, unfinished: 0, errors: 0, scanned: 0 };

  try {
    logger.info({ requestId }, '[lifecycle-email] Starting activation email job');

    // Overview stuck: overview ready, downstream still pending, old enough
    const overviewSnap = await db.collection('specs')
      .where('status.overview', '==', 'ready')
      .limit(200)
      .get();

    for (const doc of overviewSnap.docs) {
      if (stats.overviewStuck >= MAX_PER_CYCLE) break;
      stats.scanned += 1;
      const spec = doc.data() || {};
      if (!isOverviewOnly(spec.status)) continue;
      if (spec.overviewStuckEmailSentAt) continue;

      const updatedAt = parseTs(spec.updatedAt) || parseTs(spec.createdAt);
      if (!updatedAt || updatedAt > overviewCutoff) continue;

      const userId = spec.userId;
      if (!userId) continue;
      const contact = await loadUserContact(userId);
      if (!contact) continue;

      const result = await emailService.sendOverviewStuckEmail(
        contact.email,
        contact.name,
        spec.title || 'App Specification',
        doc.id,
        userId,
        baseUrl
      );
      if (result.success) {
        stats.overviewStuck += 1;
        await doc.ref.set({
          overviewStuckEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        stats.errors += 1;
      }
    }

    // Unfinished: overview not ready, older than 24h
    const unfinishedSnap = await db.collection('specs')
      .orderBy('updatedAt', 'desc')
      .limit(150)
      .get()
      .catch(async () => db.collection('specs').limit(150).get());

    for (const doc of unfinishedSnap.docs) {
      if (stats.unfinished >= MAX_PER_CYCLE) break;
      stats.scanned += 1;
      const spec = doc.data() || {};
      if (!isUnfinishedDraft(spec.status)) continue;
      if (spec.unfinishedSpecEmailSentAt) continue;

      const updatedAt = parseTs(spec.updatedAt) || parseTs(spec.createdAt);
      if (!updatedAt || updatedAt > unfinishedCutoff) continue;

      const userId = spec.userId;
      if (!userId) continue;
      const contact = await loadUserContact(userId);
      if (!contact) continue;

      const result = await emailService.sendUnfinishedSpecEmail(
        contact.email,
        contact.name,
        spec.title || 'Your idea',
        doc.id,
        userId,
        baseUrl
      );
      if (result.success) {
        stats.unfinished += 1;
        await doc.ref.set({
          unfinishedSpecEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        stats.errors += 1;
      }
    }

    logger.info({ requestId, stats }, '[lifecycle-email] Activation email job completed');
    return { success: true, stats };
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[lifecycle-email] Activation email job failed');
    return { success: false, error: error.message, stats };
  }
}

module.exports = {
  registerLifecycleEmailListeners,
  runLifecycleActivationEmailJob,
  maybeSendUpgradeOfferAfterConsume,
  maybeSendPromptsReadyEmail,
  isOverviewOnly,
  isUnfinishedDraft,
  OVERVIEW_STUCK_HOURS,
  UNFINISHED_HOURS
};
