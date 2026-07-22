/**
 * Usage Intelligence — raw data export + product_releases
 *
 * Collects historical Firestore data into a streaming ZIP of JSONL files
 * for external analysis. Does not aggregate or interpret.
 */

const archiver = require('archiver');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');

const COLLECTION_PRODUCT_RELEASES = 'product_releases';
const PAGE_SIZE = 400;
const DEFAULT_MAX_PER_COLLECTION = 100000;
const MAX_RANGE_DAYS = 400;

/** Seed markers for known significant product changes (idempotent by doc id). */
const SEED_RELEASES = [
  {
    id: 'analytics-first-party',
    version: 'analytics-1.0',
    label: 'First-party page views + analytics_events',
    shippedAt: '2025-11-01T00:00:00.000Z',
    impactAreas: ['analytics', 'navigation'],
    significant: true,
    summary: 'Began writing page_views and analytics_events to Firestore alongside GA4.'
  },
  {
    id: 'credits-v3',
    version: 'credits-v3',
    label: 'Credits V3 (ledger + subscriptions_v3)',
    shippedAt: '2025-12-01T00:00:00.000Z',
    impactAreas: ['billing', 'credits', 'subscriptions'],
    significant: true,
    summary: 'user_credits_v3 / credit_ledger_v3 became the source of truth for balances and Pro.'
  },
  {
    id: 'mcp-per-user',
    version: 'mcp-1.0',
    label: 'MCP per-user API keys',
    shippedAt: '2026-01-15T00:00:00.000Z',
    impactAreas: ['mcp', 'product_core'],
    significant: true,
    summary: 'Users can create personal MCP keys; mcp_events and mcp_requests tracking added.'
  },
  {
    id: 'email-tracking',
    version: 'email-tracking-1.0',
    label: 'Email click + send tracking',
    shippedAt: '2026-02-01T00:00:00.000Z',
    impactAreas: ['email', 'acquisition'],
    significant: true,
    summary: 'email_clicks and email_sent collections for campaign engagement.'
  },
  {
    id: 'new-admin-dashboard',
    version: 'admin-2.0',
    label: 'New admin dashboard SPA',
    shippedAt: '2026-03-01T00:00:00.000Z',
    impactAreas: ['admin', 'analytics'],
    significant: false,
    summary: 'Replaced legacy admin with new-admin-dashboard (users, analytics, page views, MCP).'
  },
  {
    id: 'planning-funnel-events',
    version: 'planning-events-1.0',
    label: 'Planning + pricing funnel events',
    shippedAt: '2026-04-01T00:00:00.000Z',
    impactAreas: ['planning', 'monetization', 'analytics'],
    significant: true,
    summary: 'Richer planning_action and checkout funnel events in analytics_events.'
  },
  {
    id: 'pipeline-canary',
    version: 'pipeline-canary-1.0',
    label: 'Spec pipeline canary monitoring',
    shippedAt: '2026-05-01T00:00:00.000Z',
    impactAreas: ['product_core', 'quality'],
    significant: false,
    summary: 'Automated pipeline canary runs for generation quality monitoring.'
  },
  {
    id: 'usage-intelligence-export',
    version: 'usage-intelligence-1.0',
    label: 'Usage Intelligence raw export',
    shippedAt: '2026-07-21T00:00:00.000Z',
    impactAreas: ['analytics', 'admin'],
    significant: true,
    summary: 'Admin bulk ZIP/JSONL export of raw usage data + product_releases markers.'
  }
];

/**
 * Collections included in the raw dump.
 * dateField: Firestore field used for range filter (null = full snapshot, no date filter).
 * transform: optional (id, data) => plain object for JSONL line.
 */
const EXPORT_SOURCES = [
  {
    key: 'product_releases',
    collection: COLLECTION_PRODUCT_RELEASES,
    dateField: 'shippedAt',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'users',
    collection: 'users',
    dateField: null,
    transform: (id, data, opts) => transformUser(id, data, opts)
  },
  {
    key: 'user_credits_v3',
    collection: 'user_credits_v3',
    dateField: null,
    transform: (id, data) => ({ userId: id, ...sanitizeForJson(data) })
  },
  {
    key: 'credit_ledger_v3',
    collection: 'credit_ledger_v3',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'subscriptions_v3',
    collection: 'subscriptions_v3',
    dateField: null,
    transform: (id, data) => ({ userId: id, ...sanitizeForJson(data) })
  },
  {
    key: 'purchases',
    collection: 'purchases',
    dateField: 'createdAt',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'page_views',
    collection: 'page_views',
    dateField: 'viewedAt',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'analytics_events',
    collection: 'analytics_events',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'article_views',
    collection: 'article_views',
    dateField: 'viewedAt',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'guide_views',
    collection: 'guide_views',
    dateField: 'viewedAt',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'specs_summary',
    collection: 'specs',
    dateField: 'createdAt',
    transform: (id, data) => transformSpecSummary(id, data)
  },
  {
    key: 'admin_activity_log',
    collection: 'admin_activity_log',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'mcp_events',
    collection: 'mcp_events',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'mcp_requests',
    collection: 'mcp_requests',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  },
  {
    key: 'email_clicks',
    collection: 'email_clicks',
    dateField: 'clickedAt',
    transform: (id, data, opts) => transformEmailClick(id, data, opts)
  },
  {
    key: 'email_sent',
    collection: 'email_sent',
    dateField: 'sentAt',
    transform: (id, data, opts) => transformEmailSent(id, data, opts)
  },
  {
    key: 'web_vitals',
    collection: 'webVitals',
    dateField: 'timestamp',
    transform: (id, data) => ({ id, ...sanitizeForJson(data) })
  }
];

function toIso(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return null;
    }
  }
  if (typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
}

function sanitizeForJson(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (typeof obj !== 'object') return obj;
  // Firestore Timestamp
  if (typeof obj.toDate === 'function') return toIso(obj);
  if (Object.prototype.hasOwnProperty.call(obj, '_seconds')) return toIso(obj);

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeForJson(v);
  }
  return out;
}

function hashEmail(email) {
  if (!email || typeof email !== 'string') return null;
  // Lightweight non-crypto hash for export redaction (not for auth).
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (Math.imul(31, h) + email.charCodeAt(i)) | 0;
  }
  return `email_${(h >>> 0).toString(16)}`;
}

function transformUser(id, data, opts) {
  const clean = sanitizeForJson(data);
  delete clean.mcpApiKey;
  delete clean.mcpApiKeyHash;
  if (opts.redactPii) {
    if (clean.email) clean.email = hashEmail(clean.email);
    if (clean.displayName) clean.displayName = '[redacted]';
    if (clean.photoURL) clean.photoURL = null;
  }
  return { id, ...clean };
}

function transformEmailClick(id, data, opts) {
  const clean = sanitizeForJson(data);
  if (opts.redactPii && clean.userEmail) {
    clean.userEmail = hashEmail(clean.userEmail);
  }
  delete clean.ip;
  return { id, ...clean };
}

function transformEmailSent(id, data, opts) {
  const clean = sanitizeForJson(data);
  if (opts.redactPii && clean.userEmail) {
    clean.userEmail = hashEmail(clean.userEmail);
  }
  if (opts.redactPii && clean.to) {
    clean.to = hashEmail(clean.to);
  }
  return { id, ...clean };
}

function transformSpecSummary(id, data) {
  const status = data.status && typeof data.status === 'object' ? data.status : {};
  const stages = {};
  for (const key of Object.keys(status)) {
    const s = status[key];
    stages[key] = typeof s === 'object' ? (s.state || s.status || s) : s;
  }
  const stageContentKeys = ['overview', 'research', 'technical', 'architecture', 'prompts', 'mockups'];
  const contentPresence = {};
  for (const key of stageContentKeys) {
    const val = data[key];
    contentPresence[key] = !!(val && (typeof val === 'string' ? val.trim() : true));
  }
  return {
    id,
    userId: data.userId || null,
    title: data.title || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    generationVersion: data.generationVersion || null,
    stages,
    contentPresence,
    hasAnswers: !!(data.answers && Object.keys(data.answers).length),
    answerCount: data.answers && typeof data.answers === 'object' ? Object.keys(data.answers).length : 0
  };
}

function parseExportRange(from, to) {
  if (!from) {
    const err = new Error('from is required (ISO 8601)');
    err.code = 'INVALID_INPUT';
    throw err;
  }
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to ? (to instanceof Date ? to : new Date(to)) : new Date();
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    const err = new Error('Invalid from/to date. Use ISO 8601.');
    err.code = 'INVALID_INPUT';
    throw err;
  }
  if (fromDate > toDate) {
    const err = new Error('from must be before to');
    err.code = 'INVALID_INPUT';
    throw err;
  }
  const rangeMs = toDate.getTime() - fromDate.getTime();
  const maxMs = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (rangeMs > maxMs) {
    const err = new Error(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    err.code = 'INVALID_INPUT';
    throw err;
  }
  return { fromDate, toDate };
}

/**
 * Paginate and return all JSONL lines for a source (memory-capped via maxPerCollection).
 */
async function collectSourceLines(source, opts) {
  const { fromDate, toDate, maxPerCollection, redactPii } = opts;
  const lines = [];
  let truncated = false;
  let pages = 0;
  let error = null;

  try {
    if (!source.dateField) {
      const snap = await db.collection(source.collection).limit(maxPerCollection).get();
      for (const doc of snap.docs) {
        lines.push(JSON.stringify(source.transform(doc.id, doc.data(), { redactPii })));
      }
      if (snap.size >= maxPerCollection) truncated = true;
      pages = 1;
      return { lines, truncated, pages, error };
    }

    const fromTs = admin.firestore.Timestamp.fromDate(fromDate);
    const toTs = admin.firestore.Timestamp.fromDate(toDate);
    let lastDoc = null;

    while (lines.length < maxPerCollection) {
      let q = db.collection(source.collection)
        .where(source.dateField, '>=', fromTs)
        .where(source.dateField, '<=', toTs)
        .orderBy(source.dateField, 'asc')
        .limit(Math.min(PAGE_SIZE, maxPerCollection - lines.length));
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      pages++;
      if (snap.empty) break;

      for (const doc of snap.docs) {
        lines.push(JSON.stringify(source.transform(doc.id, doc.data(), { redactPii })));
      }
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
      if (lines.length >= maxPerCollection) {
        truncated = true;
        break;
      }
    }
  } catch (err) {
    error = err.message || String(err);
    logger.warn(
      { collection: source.collection, dateField: source.dateField, error: error },
      '[usage-intelligence] Collection export failed (continuing)'
    );
  }

  return { lines, truncated, pages, error };
}

/**
 * Stream a ZIP of JSONL files to an HTTP response.
 * @param {import('express').Response} res
 * @param {{ from: Date|string, to?: Date|string, redactPii?: boolean, maxPerCollection?: number }} options
 */
async function streamUsageDumpZip(res, options = {}) {
  const { fromDate, toDate } = parseExportRange(options.from, options.to);
  const redactPii = options.redactPii === true || options.redactPii === 'true';
  const maxPerCollection = Math.min(
    DEFAULT_MAX_PER_COLLECTION,
    Math.max(100, parseInt(options.maxPerCollection, 10) || DEFAULT_MAX_PER_COLLECTION)
  );

  const fromIso = fromDate.toISOString().slice(0, 10);
  const toIso = toDate.toISOString().slice(0, 10);
  const filename = `usage-dump-${fromIso}-to-${toIso}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    logger.error({ error: err.message }, '[usage-intelligence] Archive error');
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Archive failed' });
    } else {
      res.end();
    }
  });
  archive.pipe(res);

  const collectedAt = new Date().toISOString();
  const fileStats = [];
  const opts = { fromDate, toDate, maxPerCollection, redactPii };

  for (const source of EXPORT_SOURCES) {
    const result = await collectSourceLines(source, opts);
    const body = result.lines.length ? result.lines.join('\n') + '\n' : '';
    archive.append(body, { name: `${source.key}.jsonl` });
    fileStats.push({
      file: `${source.key}.jsonl`,
      collection: source.collection,
      dateField: source.dateField,
      rows: result.lines.length,
      truncated: result.truncated,
      pages: result.pages,
      error: result.error || null
    });
  }

  const manifest = {
    schemaVersion: 1,
    type: 'specifys-usage-intelligence-raw-dump',
    collectedAt,
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
    redactPii,
    maxPerCollection,
    note: 'Raw records for external analysis. Specs are summarized (no stage markdown bodies). mcpApiKey never exported. Snapshot collections (users, user_credits_v3, subscriptions_v3) are current state, not date-filtered. Event collections are filtered by the requested date range.',
    files: fileStats,
    sources: EXPORT_SOURCES.map((s) => ({
      key: s.key,
      collection: s.collection,
      dateField: s.dateField
    }))
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  await archive.finalize();

  logger.info(
    {
      filename,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      files: fileStats.length,
      totalRows: fileStats.reduce((n, f) => n + f.rows, 0)
    },
    '[usage-intelligence] Usage dump ZIP finalized'
  );

  return { filename, fileStats };
}

// ─── product_releases CRUD ───────────────────────────────────────────

function serializeRelease(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    version: data.version || null,
    label: data.label || null,
    summary: data.summary || null,
    shippedAt: toIso(data.shippedAt),
    impactAreas: Array.isArray(data.impactAreas) ? data.impactAreas : [],
    significant: data.significant === true,
    gitSha: data.gitSha || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    createdBy: data.createdBy || null
  };
}

async function listProductReleases() {
  const snap = await db.collection(COLLECTION_PRODUCT_RELEASES)
    .orderBy('shippedAt', 'desc')
    .get();
  return snap.docs.map(serializeRelease);
}

async function createProductRelease(payload, adminUser) {
  const label = (payload.label || '').trim();
  if (!label) {
    const err = new Error('label is required');
    err.code = 'INVALID_INPUT';
    throw err;
  }
  const shippedAt = payload.shippedAt ? new Date(payload.shippedAt) : new Date();
  if (Number.isNaN(shippedAt.getTime())) {
    const err = new Error('Invalid shippedAt');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const id = (payload.id || '').trim() || db.collection(COLLECTION_PRODUCT_RELEASES).doc().id;
  const ref = db.collection(COLLECTION_PRODUCT_RELEASES).doc(id);
  const existing = await ref.get();
  if (existing.exists && !payload.overwrite) {
    const err = new Error(`Release id already exists: ${id}`);
    err.code = 'CONFLICT';
    throw err;
  }

  const doc = {
    version: (payload.version || '').trim() || null,
    label,
    summary: (payload.summary || '').trim() || null,
    shippedAt: admin.firestore.Timestamp.fromDate(shippedAt),
    impactAreas: Array.isArray(payload.impactAreas)
      ? payload.impactAreas.map((a) => String(a).trim()).filter(Boolean)
      : [],
    significant: payload.significant !== false,
    gitSha: (payload.gitSha || '').trim() || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: adminUser?.email || adminUser?.uid || null
  };
  if (!existing.exists) {
    doc.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await ref.set(doc, { merge: true });
  const saved = await ref.get();
  return serializeRelease(saved);
}

async function deleteProductRelease(id) {
  const ref = db.collection(COLLECTION_PRODUCT_RELEASES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('Release not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await ref.delete();
  return { id };
}

/**
 * Idempotent seed of known significant releases.
 */
async function seedProductReleases(adminUser) {
  const results = [];
  for (const seed of SEED_RELEASES) {
    const ref = db.collection(COLLECTION_PRODUCT_RELEASES).doc(seed.id);
    const existing = await ref.get();
    if (existing.exists) {
      results.push({ id: seed.id, status: 'skipped' });
      continue;
    }
    await ref.set({
      version: seed.version,
      label: seed.label,
      summary: seed.summary,
      shippedAt: admin.firestore.Timestamp.fromDate(new Date(seed.shippedAt)),
      impactAreas: seed.impactAreas,
      significant: seed.significant === true,
      gitSha: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUser?.email || 'seed',
      seeded: true
    });
    results.push({ id: seed.id, status: 'created' });
  }
  return results;
}

module.exports = {
  EXPORT_SOURCES,
  SEED_RELEASES,
  streamUsageDumpZip,
  parseExportRange,
  listProductReleases,
  createProductRelease,
  deleteProductRelease,
  seedProductReleases
};
