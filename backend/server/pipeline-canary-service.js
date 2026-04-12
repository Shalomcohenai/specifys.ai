/**
 * Daily / manual pipeline canary: creates a real spec and runs overview → approve → specQueue (same path as users).
 * @see docs in backend/docs/PIPELINE-CANARY.md
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { toZonedTime } = require('date-fns-tz');
const specGenerationServiceV2 = require('./spec-generation-service-v2');
const specQueue = require('./spec-queue');
const { getTitleFromOverview } = require('./spec-overview-utils');
const { attachSpecQueueFirestoreListeners } = require('./spec-queue-firestore-listeners');

const RUNS_COLLECTION = 'pipeline_canary_runs';
const DEFAULT_CANARY_UID = 'w7t9dZPxSzOXgTm3jaQBC0w4rez1';

let cachedTemplates = null;

function loadTemplates() {
  if (cachedTemplates) return cachedTemplates;
  const jsonPath = path.join(__dirname, '../config/pipeline-canary-templates.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  cachedTemplates = parsed.templates || [];
  return cachedTemplates;
}

function getDateKeyInTimezone(date, timezone) {
  const z = toZonedTime(date, timezone);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, '0');
  const d = String(z.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function templateIndexForDateKey(dateKey) {
  const templates = loadTemplates();
  if (!templates.length) return 0;
  let h = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    h = ((h << 5) - h) + dateKey.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % templates.length;
}

function buildCanaryOverviewUserInput(answers) {
  const a0 = answers[0] || '';
  const a1 = answers[1] || '';
  const a2 = answers[2] || '';
  return `App Description: ${a0}\n\nUser Workflow: ${a1}\n\nAdditional Details: ${a2}\n\nTarget Platform: Web App`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function classifyTraffic(specData, job) {
  const st = specData.status || {};
  if (job && job.status === 'failed') return 'red';
  if (st.overview === 'error' || !specData.overview) return 'red';
  if (st.overview !== 'ready') return 'red';

  const sections = ['technical', 'market', 'design', 'architecture'];
  const allReady = sections.every((s) => st[s] === 'ready');
  if (allReady) return 'green';

  if (job && job.status === 'completed' && job.results && Array.isArray(job.results.errors) && job.results.errors.length > 0) {
    return 'orange';
  }

  return 'orange';
}

async function pollQueueOrFirestore(specId, queueTimeoutMs) {
  const start = Date.now();
  while (Date.now() - start < queueTimeoutMs) {
    const job = specQueue.getJob(specId);
    if (job && (job.status === 'completed' || job.status === 'failed')) {
      return job;
    }
    const doc = await db.collection('specs').doc(specId).get();
    if (doc.exists) {
      const d = doc.data();
      const st = d.status || {};
      if (
        st.technical === 'ready' &&
        st.market === 'ready' &&
        st.design === 'ready' &&
        st.architecture === 'ready'
      ) {
        return job || { status: 'completed', results: null };
      }
    }
    await sleep(4000);
  }
  return specQueue.getJob(specId);
}

function serializeRun(docSnap) {
  const d = docSnap.data();
  const out = { id: docSnap.id, ...d };
  ['startedAt', 'finishedAt', 'updatedAt'].forEach((k) => {
    const v = out[k];
    if (v && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    }
  });
  return out;
}

async function shouldSkipScheduledRunForDate(dateKey) {
  const snap = await db.collection(RUNS_COLLECTION).where('dateKey', '==', dateKey).limit(40).get();
  for (const doc of snap.docs) {
    const x = doc.data();
    if (x.trigger === 'schedule' && x.traffic === 'green') return true;
  }
  return false;
}

async function deleteExpiredCanarySpecs() {
  const snap = await db.collection('specs').where('pipelineCanary', '==', true).get();
  const now = new Date();
  let batch = db.batch();
  let n = 0;
  let total = 0;
  for (const doc of snap.docs) {
    const exp = doc.data().expiresAt;
    if (!exp || typeof exp.toDate !== 'function') continue;
    if (exp.toDate() >= now) continue;
    batch.delete(doc.ref);
    n += 1;
    total += 1;
    if (n >= 450) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
  if (total > 0) {
    logger.info({ deleted: total }, '[pipeline-canary] Deleted expired canary specs');
  }
  return total;
}

/**
 * Create initial run document (phase running, traffic null).
 */
async function createRunDocument(runId, { dateKey, trigger, templateId }) {
  await db.collection(RUNS_COLLECTION).doc(runId).set({
    dateKey,
    trigger,
    templateId,
    phase: 'running',
    traffic: null,
    specId: null,
    stages: {},
    error: null,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    finishedAt: null
  });
}

async function updateRun(runId, patch) {
  await db.collection(RUNS_COLLECTION).doc(runId).update({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function executePipelineCanaryRun(runId, { dateKey, trigger, templateIndex: templateIndexOverride }) {
  const requestId = `canary-exec-${runId}`;
  const templates = loadTemplates();
  if (!templates.length) {
    await updateRun(runId, {
      phase: 'done',
      traffic: 'red',
      error: 'No templates configured',
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  const idx = typeof templateIndexOverride === 'number' && templateIndexOverride >= 0 && templateIndexOverride < templates.length
    ? templateIndexOverride
    : templateIndexForDateKey(dateKey);

  const template = templates[idx] || templates[0];
  if (!template) {
    await updateRun(runId, {
      phase: 'done',
      traffic: 'red',
      error: 'No canary template available',
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return;
  }
  const answers = Array.isArray(template.answers) ? [...template.answers] : [];
  while (answers.length < 3) answers.push('');

  const canaryUid = (process.env.PIPELINE_CANARY_FIREBASE_UID || DEFAULT_CANARY_UID).trim();
  const overviewTimeout = parseInt(process.env.PIPELINE_CANARY_OVERVIEW_TIMEOUT_MS || '1200000', 10);
  const queueTimeout = parseInt(process.env.PIPELINE_CANARY_QUEUE_TIMEOUT_MS || '3600000', 10);

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 86400000);

  let specId = null;
  try {
    const specPayload = {
      title: 'Generating...',
      overview: null,
      technical: null,
      market: null,
      design: null,
      architecture: null,
      status: {
        overview: 'generating',
        technical: 'pending',
        market: 'pending',
        design: 'pending'
      },
      overviewApproved: false,
      userId: canaryUid,
      userName: 'Pipeline Canary',
      mode: 'unified',
      answers,
      pipelineCanary: true,
      pipelineCanaryRunId: runId,
      expiresAt,
      generationVersion: 'v2',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const specRef = await db.collection('specs').add(specPayload);
    specId = specRef.id;
    await updateRun(runId, { specId, templateId: template.id, stages: { specCreated: true } });

    const userInput = buildCanaryOverviewUserInput(answers);

    await updateRun(runId, { stages: { specCreated: true, overview: 'running' } });

    const overviewContent = await withTimeout(
      specGenerationServiceV2.generateOverview(specId, userInput),
      overviewTimeout,
      'overview'
    );

    const specTitle = getTitleFromOverview(overviewContent);
    await db.collection('specs').doc(specId).update({
      overview: overviewContent,
      'status.overview': 'ready',
      title: specTitle,
      generationVersion: 'v2',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await updateRun(runId, { stages: { specCreated: true, overview: 'ready' } });

    await db.collection('specs').doc(specId).update({
      overviewApproved: true,
      'status.technical': 'generating',
      'status.market': 'pending',
      'status.design': 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await updateRun(runId, { stages: { specCreated: true, overview: 'ready', advanced: 'queued' } });

    attachSpecQueueFirestoreListeners({
      specId,
      requestId,
      onGenerationComplete: undefined
    });

    await specQueue.add(specId, overviewContent, answers);

    const job = await pollQueueOrFirestore(specId, queueTimeout);

    const specSnap = await db.collection('specs').doc(specId).get();
    const specData = specSnap.data() || {};
    const traffic = classifyTraffic(specData, job);

    await updateRun(runId, {
      phase: 'done',
      traffic,
      stages: {
        specCreated: true,
        overview: 'ready',
        advanced: job && job.status === 'failed' ? 'failed' : 'finished',
        jobStatus: job ? job.status : 'unknown'
      },
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    logger.error({ requestId, runId, specId, error: err.message, stack: err.stack }, '[pipeline-canary] Run failed');
    if (specId) {
      try {
        await db.collection('specs').doc(specId).update({
          'status.overview': 'error',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        logger.warn({ specId, error: e.message }, '[pipeline-canary] Failed to mark overview error on spec');
      }
    }
    await updateRun(runId, {
      phase: 'done',
      traffic: 'red',
      error: err.message || String(err),
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

function newRunId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Start a manual canary: creates run doc and kicks async execution. Returns runId.
 */
async function startManualCanaryRun({ templateIndex } = {}) {
  const tz = process.env.PIPELINE_CANARY_TIMEZONE || process.env.REPORT_TIMEZONE || 'UTC';
  const dateKey = getDateKeyInTimezone(new Date(), tz);
  const runId = newRunId();
  const templates = loadTemplates();
  const idx = typeof templateIndex === 'number' && templateIndex >= 0 && templateIndex < templates.length
    ? templateIndex
    : templateIndexForDateKey(dateKey);
  const template = templates[idx];
  await createRunDocument(runId, {
    dateKey,
    trigger: 'manual',
    templateId: template ? template.id : 'unknown'
  });
  setImmediate(() => {
    executePipelineCanaryRun(runId, { dateKey, trigger: 'manual', templateIndex: idx }).catch((e) => {
      logger.error({ runId, error: e.message }, '[pipeline-canary] Manual run background error');
    });
  });
  return { runId, dateKey };
}

async function runScheduledPipelineCanaryOnce() {
  const tz = process.env.PIPELINE_CANARY_TIMEZONE || process.env.REPORT_TIMEZONE || 'UTC';
  const dateKey = getDateKeyInTimezone(new Date(), tz);
  if (await shouldSkipScheduledRunForDate(dateKey)) {
    logger.info({ dateKey }, '[pipeline-canary] Scheduled run skipped (already green today)');
    return { skipped: true, dateKey };
  }
  const runId = newRunId();
  const templates = loadTemplates();
  const idx = templateIndexForDateKey(dateKey);
  const template = templates[idx] || { id: 'unknown' };
  await createRunDocument(runId, {
    dateKey,
    trigger: 'schedule',
    templateId: template.id
  });
  await executePipelineCanaryRun(runId, { dateKey, trigger: 'schedule', templateIndex: idx });
  return { skipped: false, runId, dateKey };
}

async function getCanaryRun(runId) {
  const doc = await db.collection(RUNS_COLLECTION).doc(runId).get();
  if (!doc.exists) return null;
  return serializeRun(doc);
}

async function getCanaryHistory(days) {
  const limitN = Math.min(80, Math.max(14, (days || 14) * 3));
  const snap = await db.collection(RUNS_COLLECTION).orderBy('startedAt', 'desc').limit(limitN).get();
  const since = Date.now() - (days || 14) * 86400000;
  const runs = [];
  snap.docs.forEach((d) => {
    const s = serializeRun(d);
    const t = s.startedAt ? Date.parse(s.startedAt) : 0;
    if (t >= since) runs.push(s);
  });
  return runs;
}

module.exports = {
  loadTemplates,
  getDateKeyInTimezone,
  templateIndexForDateKey,
  executePipelineCanaryRun,
  startManualCanaryRun,
  runScheduledPipelineCanaryOnce,
  shouldSkipScheduledRunForDate,
  deleteExpiredCanarySpecs,
  getCanaryRun,
  getCanaryHistory,
  newRunId,
  RUNS_COLLECTION
};
