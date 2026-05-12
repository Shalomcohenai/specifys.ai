/**
 * Admin bulk sync: Firestore users -> Resend audience (batched, stateful).
 * State doc: admin_config/resend_audience_sync
 */

const { db, admin } = require('./firebase-admin');
const emailService = require('./email-service');
const { logger } = require('./logger');

const STATE_COLLECTION = 'admin_config';
const STATE_DOC_ID = 'resend_audience_sync';
const MIN_BATCH = 5;
const MAX_BATCH = 7;
const DELAY_MS_BETWEEN_USERS = 220;

function stateRef() {
  return db.collection(STATE_COLLECTION).doc(STATE_DOC_ID);
}

function defaultState() {
  return {
    fullSyncComplete: false,
    cursorCreatedAt: null,
    cursorUserId: null,
    incrementalSince: null,
    maxCreatedAtSeen: null,
    lastBatchAt: null,
    lastBatchSummary: null
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestampToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds != null) return ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1e6);
  return null;
}

function maxTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const ma = timestampToMillis(a);
  const mb = timestampToMillis(b);
  if (ma == null) return b;
  if (mb == null) return a;
  return ma >= mb ? a : b;
}

function serializeState(data) {
  if (!data) return null;
  const out = { ...data };
  ['cursorCreatedAt', 'incrementalSince', 'maxCreatedAtSeen', 'lastBatchAt'].forEach((k) => {
    if (out[k] && typeof out[k].toDate === 'function') {
      out[k] = out[k].toDate().toISOString();
    }
  });
  return out;
}

async function readState() {
  const snap = await stateRef().get();
  if (!snap.exists) {
    return { ...defaultState() };
  }
  return { ...defaultState(), ...snap.data() };
}

function buildUserQuery(state, batchSize) {
  const idPath = admin.firestore.FieldPath.documentId();
  let q = db.collection('users').orderBy('createdAt', 'asc').orderBy(idPath, 'asc').limit(batchSize);

  if (state.fullSyncComplete && state.incrementalSince) {
    q = q.where('createdAt', '>', state.incrementalSince);
  }

  if (state.cursorCreatedAt != null && state.cursorUserId != null) {
    q = q.startAfter(state.cursorCreatedAt, state.cursorUserId);
  }

  return q;
}

async function getResendAudienceSyncState() {
  const raw = await readState();
  return {
    success: true,
    state: serializeState(raw)
  };
}

async function processResendAudienceSyncBatch(body = {}) {
  if (!emailService.isConfigured()) {
    const err = new Error('Resend is not configured (RESEND_API_KEY)');
    err.code = 'RESEND_NOT_CONFIGURED';
    throw err;
  }
  if (!emailService.getResendAudienceId()) {
    const err = new Error('Resend audience is not configured (RESEND_AUDIENCE_ID or RESEND_SEGMENT_ID)');
    err.code = 'RESEND_AUDIENCE_MISSING';
    throw err;
  }

  let batchSize = parseInt(body.batchSize, 10);
  if (!Number.isFinite(batchSize)) {
    batchSize = 6;
  }
  batchSize = Math.min(MAX_BATCH, Math.max(MIN_BATCH, batchSize));

  const state = await readState();
  const phase = state.fullSyncComplete ? 'incremental' : 'full';

  let snapshot;
  try {
    snapshot = await buildUserQuery(state, batchSize).get();
  } catch (err) {
    logger.error({ err: err.message, phase }, '[resend-audience-bulk-sync] users query failed (missing Firestore index?)');
    throw err;
  }

  const results = [];
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let skippedNoEmail = 0;

  if (snapshot.empty) {
    const summary = {
      phase,
      processed: 0,
      ok: 0,
      skipped: 0,
      failed: 0,
      skippedNoEmail: 0,
      hasMore: false,
      note: 'no_matching_users'
    };

    const updates = {
      cursorCreatedAt: null,
      cursorUserId: null,
      lastBatchAt: admin.firestore.FieldValue.serverTimestamp(),
      lastBatchSummary: summary
    };

    if (!state.fullSyncComplete) {
      updates.fullSyncComplete = true;
      updates.incrementalSince = state.maxCreatedAtSeen || admin.firestore.Timestamp.now();
      updates.maxCreatedAtSeen = state.maxCreatedAtSeen || null;
    }

    await stateRef().set(updates, { merge: true });

    return {
      success: true,
      phase,
      processed: 0,
      hasMore: false,
      results,
      state: serializeState(await readState())
    };
  }

  let runningMax = state.maxCreatedAtSeen || null;

  for (let i = 0; i < snapshot.docs.length; i++) {
    const doc = snapshot.docs[i];
    const userId = doc.id;
    const data = doc.data() || {};
    const userEmail = (data.email || '').trim();
    const displayName = data.displayName || data.name || '';
    const emailPreferences = data.emailPreferences || null;

    if (!userEmail) {
      skippedNoEmail++;
      results.push({ userId, email: '', outcome: 'skipped_no_email' });
    } else {
      try {
        const r = await emailService.addSignupToResendAudience(userEmail, displayName, userId, emailPreferences);
        if (r.skipped && r.reason === 'no_audience_id') {
          skipped++;
          results.push({ userId, email: userEmail, outcome: 'skipped', reason: r.reason });
        } else if (r.skipped && r.reason === 'duplicate') {
          skipped++;
          results.push({ userId, email: userEmail, outcome: 'duplicate' });
        } else if (r.success) {
          ok++;
          results.push({ userId, email: userEmail, outcome: r.skipped ? 'skipped' : 'ok' });
        } else {
          failed++;
          results.push({ userId, email: userEmail, outcome: 'error', error: r.error || 'unknown' });
        }
      } catch (e) {
        failed++;
        results.push({ userId, email: userEmail, outcome: 'exception', error: e.message });
        logger.warn({ userId, err: e.message }, '[resend-audience-bulk-sync] addSignupToResendAudience exception');
      }
    }

    const ca = data.createdAt;
    if (ca && typeof ca.toMillis === 'function') {
      runningMax = maxTimestamp(runningMax, ca);
    }

    if (i < snapshot.docs.length - 1) {
      await sleep(DELAY_MS_BETWEEN_USERS);
    }
  }

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  const lastData = lastDoc.data() || {};
  const lastCreatedAt = lastData.createdAt;
  const lastUserId = lastDoc.id;
  const hasMore = snapshot.docs.length === batchSize;

  const summary = {
    phase,
    processed: snapshot.docs.length,
    ok,
    skipped,
    failed,
    skippedNoEmail,
    hasMore
  };

  const patch = {
    maxCreatedAtSeen: runningMax,
    lastBatchAt: admin.firestore.FieldValue.serverTimestamp(),
    lastBatchSummary: summary
  };

  if (hasMore) {
    patch.cursorCreatedAt = lastCreatedAt;
    patch.cursorUserId = lastUserId;
  } else {
    patch.cursorCreatedAt = null;
    patch.cursorUserId = null;
    if (!state.fullSyncComplete) {
      patch.fullSyncComplete = true;
      patch.incrementalSince = runningMax || lastCreatedAt || admin.firestore.Timestamp.now();
    }
  }

  await stateRef().set(patch, { merge: true });

  logger.info(
    {
      phase,
      batchSize,
      processed: snapshot.docs.length,
      ok,
      skipped,
      failed,
      hasMore
    },
    '[resend-audience-bulk-sync] batch complete'
  );

  return {
    success: true,
    phase,
    processed: snapshot.docs.length,
    hasMore,
    results,
    state: serializeState(await readState())
  };
}

module.exports = {
  getResendAudienceSyncState,
  processResendAudienceSyncBatch,
  MIN_BATCH,
  MAX_BATCH
};
