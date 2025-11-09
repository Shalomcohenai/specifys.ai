const { URLSearchParams } = require('url');

const ACTIVE_STATUSES = new Set(['active', 'on_trial', 'paused', 'past_due']);
const CANCELLED_STATUSES = new Set(['cancelled', 'expired', 'unpaid']);

function normalizeStatus(status) {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

function hasActiveStatus(status) {
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}

function hasCancelledStatus(status) {
  return CANCELLED_STATUSES.has(normalizeStatus(status));
}

function buildLogger(logger, requestId) {
  const prefix = requestId ? `[${requestId}]` : '';
  const safeLogger = logger || console;
  return {
    debug: (msg, data) => safeLogger.debug ? safeLogger.debug(prefix, msg, data || '') : safeLogger.log(prefix, msg, data || ''),
    info: (msg, data) => safeLogger.info ? safeLogger.info(prefix, msg, data || '') : safeLogger.log(prefix, msg, data || ''),
    warn: (msg, data) => safeLogger.warn ? safeLogger.warn(prefix, msg, data || '') : safeLogger.log(prefix, msg, data || ''),
    error: (msg, data) => safeLogger.error ? safeLogger.error(prefix, msg, data || '') : safeLogger.log(prefix, msg, data || '')
  };
}

function extractLastOrderId(subscriptionData = {}) {
  return (
    subscriptionData.last_order_id ||
    subscriptionData.lastOrderId ||
    subscriptionData.order_id ||
    subscriptionData.metadata?.last_order_id ||
    subscriptionData.metadata?.order_id ||
    null
  );
}

function mergeMetadata(existingMetadata = {}, updates = {}) {
  const merged = { ...existingMetadata };
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  });
  return merged;
}

function extractOrderIdFromRecord(record) {
  const attributes = record?.attributes || {};
  const relationships = record?.relationships || {};
  return (
    attributes.order_id ||
    relationships?.order?.data?.id ||
    relationships?.orders?.data?.[0]?.id ||
    relationships?.first_order?.data?.id ||
    null
  );
}

function extractVariantId(record) {
  const attributes = record?.attributes || {};
  const relationships = record?.relationships || {};
  return (
    attributes.variant_id ||
    relationships?.variant?.data?.id ||
    attributes.product_variant_id ||
    null
  );
}

function extractProductId(record) {
  const attributes = record?.attributes || {};
  const relationships = record?.relationships || {};
  return (
    attributes.product_id ||
    relationships?.product?.data?.id ||
    null
  );
}

function buildSubscriptionUpdateFromRecord(record, existingData, admin) {
  if (!record || !record.id) {
    return null;
  }

  const attributes = record.attributes || {};
  const relationships = record.relationships || {};
  const normalizedStatus = normalizeStatus(attributes.status);
  const cancelAtPeriodEnd = attributes.cancel_at_period_end ?? attributes.cancelled ?? false;
  const endsAt =
    attributes.ends_at ||
    attributes.ends_at_formatted ||
    attributes.cancelled_at ||
    null;
  const renewsAt = attributes.renews_at || null;
  const orderId = extractOrderIdFromRecord(record);
  const variantId = extractVariantId(record);
  const productId = extractProductId(record);
  const storeId = attributes.store_id || relationships?.store?.data?.id || null;
  const customerId = attributes.customer_id || null;

  const existingMetadata = existingData?.metadata || {};
  const mergedMetadata = mergeMetadata(existingMetadata, {
    lemonCustomerId: customerId || existingMetadata.lemonCustomerId || null,
    lastOrderId: orderId || existingMetadata.lastOrderId || null
  });

  const updatePayload = {
    lemon_subscription_id: record.id.toString(),
    status: normalizedStatus || existingData?.status || null,
    variant_id: variantId ? variantId.toString() : existingData?.variant_id || null,
    product_id: productId ? productId.toString() : existingData?.product_id || null,
    store_id: storeId ? storeId.toString() : existingData?.store_id || null,
    cancel_at_period_end: !!cancelAtPeriodEnd,
    ends_at: endsAt || null,
    renews_at: renewsAt || null,
    last_synced_at: admin.firestore.FieldValue.serverTimestamp()
  };

  if (customerId) {
    updatePayload.lemon_customer_id = customerId.toString();
  }

  if (orderId) {
    updatePayload.last_order_id = orderId.toString();
  }

  if (Object.keys(mergedMetadata).length > 0) {
    updatePayload.metadata = mergedMetadata;
  }

  return {
    update: updatePayload,
    attributes,
    relationships,
    status: normalizedStatus,
    customerId: customerId ? customerId.toString() : null,
    orderId: orderId ? orderId.toString() : null
  };
}

async function listSubscriptions({ fetch, apiKey, storeId, status, mode, filters = {}, logger, requestId }) {
  const searchParams = new URLSearchParams();
  const log = buildLogger(logger, requestId);

  if (storeId) {
    searchParams.append('filter[store_id]', storeId.toString());
  }

  searchParams.append('filter[status]', status || 'active');
  searchParams.append('page[size]', '5');

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(`filter[${key}]`, value);
    }
  });

  const url = `https://api.lemonsqueezy.com/v1/subscriptions?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch (parseErr) {
        errorBody = await response.text();
      }

      log.warn('Lemon list subscriptions returned non-OK status', {
        url,
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      return { records: [], error: { status: response.status, body: errorBody } };
    }

    const data = await response.json();
    const records = Array.isArray(data?.data) ? data.data : [];
    return { records };
  } catch (err) {
    log.warn('Lemon list subscriptions request failed', { url, error: err?.message || err });
    return { records: [], error: err };
  }
}

async function fetchSubscriptionById({ fetch, apiKey, subscriptionId, storeId, logger, requestId }) {
  const log = buildLogger(logger, requestId);
  const searchParams = new URLSearchParams();
  if (storeId) {
    searchParams.append('filter[store_id]', storeId.toString());
  }
  searchParams.append('include', 'order');

  const url = `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch (parseErr) {
        errorBody = await response.text();
      }
      log.warn('Lemon fetch subscription by ID returned non-OK status', {
        subscriptionId,
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      return null;
    }

    const payload = await response.json();
    if (!payload || !payload.data) {
      log.warn('Lemon fetch subscription by ID returned empty payload', { subscriptionId });
      return null;
    }
    return payload.data;
  } catch (err) {
    log.warn('Failed to fetch subscription by ID', { subscriptionId, error: err?.message || err });
    return null;
  }
}

async function resolveSubscription(options) {
  const {
    db,
    admin,
    fetch,
    userId,
    userEmail,
    subscriptionDocRef,
    subscriptionData = {},
    apiKey,
    storeId,
    mode = 'live',
    requestId,
    logger
  } = options;

  const log = buildLogger(logger, requestId);
  const attempts = [];
  const lastOrderId = extractLastOrderId(subscriptionData);
  const storeIdToUse = storeId ? storeId.toString() : null;

  async function backfillFromRecord(record, source) {
    const existingData = subscriptionData;
    const built = buildSubscriptionUpdateFromRecord(record, existingData, admin);
    if (!built) {
      return null;
    }

    const updatePayload = built.update;
    updatePayload.last_synced_source = source;
    updatePayload.last_synced_mode = mode;

    try {
      if (subscriptionDocRef) {
        await subscriptionDocRef.set(updatePayload, { merge: true });
      }
      attempts.push({ type: source, success: true, subscriptionId: record.id.toString() });
      return {
        subscriptionId: record.id.toString(),
        source,
        attributes: built.attributes,
        relationships: built.relationships,
        update: updatePayload,
        status: built.status,
        attempts
      };
    } catch (err) {
      log.warn('Failed to backfill subscription doc', { source, error: err?.message || err });
      attempts.push({ type: source, success: false, reason: 'backfill_failed', error: err?.message || err });
      return null;
    }
  }

  async function resolveFromSubscriptionDoc() {
    if (!subscriptionData?.lemon_subscription_id) {
      return null;
    }
    const id = subscriptionData.lemon_subscription_id.toString();
    const record = await fetchSubscriptionById({
      fetch,
      apiKey,
      subscriptionId: id,
      storeId: storeIdToUse,
      logger,
      requestId
    });
    if (record) {
      return backfillFromRecord(record, 'subscription_doc');
    }
    attempts.push({ type: 'subscription_doc', success: false, reason: 'lookup_failed' });
    return null;
  }

  async function resolveFromPurchases() {
    try {
      const snapshot = await db
        .collection('purchases')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (snapshot.empty) {
        attempts.push({ type: 'purchases', success: false, reason: 'no_records' });
        return null;
      }

      for (const doc of snapshot.docs) {
        const purchase = doc.data() || {};
        const candidate =
          purchase.subscriptionId ||
          purchase.subscription_id ||
          purchase.subscriptionID ||
          purchase.metadata?.subscription_id ||
          purchase.metadata?.subscriptionId ||
          purchase.metadata?.subscription?.id;
        if (candidate) {
          const record = await fetchSubscriptionById({
            fetch,
            apiKey,
            subscriptionId: candidate,
            storeId: storeIdToUse,
            logger,
            requestId
          });
          if (record) {
            attempts.push({ type: 'purchases', success: true, subscriptionId: candidate.toString() });
            return backfillFromRecord(record, 'purchases');
          }
        }
      }

      attempts.push({ type: 'purchases', success: false, reason: 'no_subscription_id' });
      return null;
    } catch (err) {
      log.warn('Failed to resolve subscription via purchases', { error: err?.message || err });
      attempts.push({ type: 'purchases', success: false, reason: 'error', error: err?.message || err });
      return null;
    }
  }

  async function resolveFromLastOrderDoc() {
    const orderId = lastOrderId;
    if (!orderId) {
      attempts.push({ type: 'last_order_doc', success: false, reason: 'no_last_order_id' });
      return null;
    }

    try {
      const orderDoc = await db.collection('purchases').doc(orderId.toString()).get();
      if (!orderDoc.exists) {
        attempts.push({ type: 'last_order_doc', success: false, reason: 'order_doc_missing', orderId });
        return null;
      }
      const purchase = orderDoc.data() || {};
      const candidate =
        purchase.subscriptionId ||
        purchase.subscription_id ||
        purchase.subscriptionID ||
        purchase.metadata?.subscription_id ||
        purchase.metadata?.subscriptionId ||
        purchase.metadata?.subscription?.id;
      if (!candidate) {
        attempts.push({ type: 'last_order_doc', success: false, reason: 'no_subscription_id', orderId });
        return null;
      }

      const record = await fetchSubscriptionById({
        fetch,
        apiKey,
        subscriptionId: candidate,
        storeId: storeIdToUse,
        logger,
        requestId
      });

      if (record) {
        attempts.push({ type: 'last_order_doc', success: true, subscriptionId: candidate.toString() });
        return backfillFromRecord(record, 'last_order_doc');
      }
      attempts.push({ type: 'last_order_doc', success: false, reason: 'lookup_failed', orderId });
      return null;
    } catch (err) {
      log.warn('Failed to resolve subscription via last order doc', { error: err?.message || err, orderId });
      attempts.push({ type: 'last_order_doc', success: false, reason: 'error', error: err?.message || err });
      return null;
    }
  }

  async function resolveViaLemonOrderId() {
    if (!lastOrderId) {
      attempts.push({ type: 'subscriptions_api_order', success: false, reason: 'no_last_order_id' });
      return null;
    }

    const { records, error } = await listSubscriptions({
      fetch,
      apiKey,
      storeId: storeIdToUse,
      status: 'active',
      mode,
      filters: { order_id: lastOrderId.toString() },
      logger,
      requestId
    });

    if (records.length === 0) {
      attempts.push({ type: 'subscriptions_api_order', success: false, reason: error ? 'error' : 'no_records', error });
      return null;
    }

    const record = records.find((rec) => hasActiveStatus(rec?.attributes?.status)) || records[0];
    if (record) {
      attempts.push({ type: 'subscriptions_api_order', success: true, subscriptionId: record.id.toString() });
      return backfillFromRecord(record, 'subscriptions_api_order');
    }
    attempts.push({ type: 'subscriptions_api_order', success: false, reason: 'no_active_records' });
    return null;
  }

  async function resolveViaLemonEmailOrCustomer() {
    const candidateFilters = [];
    if (userEmail) {
      candidateFilters.push({ type: 'customer_email', value: userEmail });
    }
    const customerIds = [
      subscriptionData?.metadata?.lemonCustomerId,
      subscriptionData?.metadata?.lemonCustomerID,
      subscriptionData?.metadata?.customer_id,
      subscriptionData?.metadata?.customerId
    ].filter(Boolean);
    customerIds.forEach((value) => {
      candidateFilters.push({ type: 'customer_id', value: value.toString() });
    });

    for (const candidate of candidateFilters) {
      const { records, error } = await listSubscriptions({
        fetch,
        apiKey,
        storeId: storeIdToUse,
        status: 'active',
        mode,
        filters: { [candidate.type]: candidate.value },
        logger,
        requestId
      });

      if (records.length === 0) {
        attempts.push({
          type: `subscriptions_api_${candidate.type}`,
          success: false,
          reason: error ? 'error' : 'no_records',
          error
        });
        continue;
      }

      const record = records.find((rec) => hasActiveStatus(rec?.attributes?.status)) || records[0];
      if (record) {
        attempts.push({
          type: `subscriptions_api_${candidate.type}`,
          success: true,
          subscriptionId: record.id.toString()
        });
        return backfillFromRecord(record, `subscriptions_api_${candidate.type}`);
      }
    }
    return null;
  }

  async function fetchSubscriptionIdFromLemonOrder() {
    if (!lastOrderId || !apiKey) {
      attempts.push({ type: 'orders_api_lookup', success: false, reason: 'no_last_order_id_or_api_key' });
      return null;
    }

    const orderUrl = `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(lastOrderId)}`;
    try {
      const response = await fetch(orderUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (parseErr) {
          try {
            errorBody = await response.text();
          } catch (textErr) {
            errorBody = null;
          }
        }

        log.warn('Lemon order lookup returned non-OK status', {
          url: orderUrl,
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        attempts.push({ type: 'orders_api_lookup', success: false, reason: 'non_ok', status: response.status });
        return null;
      }

      const orderData = await response.json();
      const attributes = orderData?.data?.attributes || {};
      const relationships = orderData?.data?.relationships || {};

      const attrId =
        attributes.subscription_id ||
        attributes.subscriptionId ||
        attributes.subscription?.id ||
        null;

      const relId =
        relationships?.subscription?.data?.id ||
        relationships?.subscription_id?.data?.id ||
        relationships?.subscriptionId?.data?.id ||
        null;

      const resolvedId = attrId || relId || null;
      if (resolvedId) {
        log.info('Found subscriptionId via Lemon order lookup', {
          orderId: lastOrderId,
          subscriptionId: resolvedId.toString()
        });
        attempts.push({ type: 'orders_api_lookup', success: true, subscriptionId: resolvedId.toString() });
        return resolvedId.toString();
      }

      log.warn('Lemon order lookup did not include subscription reference', { orderId: lastOrderId });
      attempts.push({ type: 'orders_api_lookup', success: false, reason: 'missing_subscription_reference' });
      return null;
    } catch (err) {
      log.warn('Lemon order lookup failed', { orderId: lastOrderId, error: err?.message || err });
      attempts.push({ type: 'orders_api_lookup', success: false, reason: 'exception', error: err?.message || err });
      return null;
    }
  }

  async function resolveViaLemonOrderEndpoint() {
    if (!lastOrderId) {
      attempts.push({ type: 'orders_api', success: false, reason: 'no_last_order_id' });
      return null;
    }

    const subscriptionIdFromOrder = await fetchSubscriptionIdFromLemonOrder();
    if (!subscriptionIdFromOrder) {
      attempts.push({ type: 'orders_api', success: false, reason: 'no_subscription_reference' });
      return null;
    }

    const record = await fetchSubscriptionById({
      fetch,
      apiKey,
      subscriptionId: subscriptionIdFromOrder,
      storeId: storeIdToUse,
      logger,
      requestId
    });

    if (record && record.id) {
      attempts.push({ type: 'orders_api', success: true, subscriptionId: record.id.toString() });
      return backfillFromRecord(record, 'orders_api');
    }

    attempts.push({ type: 'orders_api', success: false, reason: 'lookup_failed' });
    return null;
  }

  // Execution pipeline
  const resolvers = [
    resolveFromSubscriptionDoc,
    resolveFromPurchases,
    resolveFromLastOrderDoc,
    resolveViaLemonOrderId,
    resolveViaLemonEmailOrCustomer,
    resolveViaLemonOrderEndpoint
  ];

  for (const resolver of resolvers) {
    const result = await resolver();
    if (result && result.subscriptionId) {
      result.attempts = attempts;
      return result;
    }
  }

  return null;
}

async function upsertSubscriptionFromWebhook({
  db,
  admin,
  fetch,
  userId,
  subscriptionRecord,
  existingSnapshot,
  storeId,
  mode = 'live',
  logger,
  requestId
}) {
  const log = buildLogger(logger, requestId);
  const subscriptionDocRef = db.collection('subscriptions').doc(userId);
  const snapshot = existingSnapshot && existingSnapshot.exists ? existingSnapshot : await subscriptionDocRef.get();
  const existingData = snapshot.exists ? snapshot.data() : {};
  const payload = buildSubscriptionUpdateFromRecord(subscriptionRecord, existingData, admin);

  if (!payload) {
    log.warn('Webhook upsert ignored because subscription record was invalid');
    return null;
  }

  payload.update.last_synced_source = 'webhook';
  payload.update.last_synced_mode = mode;
  payload.update.lemon_subscription_id = subscriptionRecord.id.toString();

  try {
    await subscriptionDocRef.set(payload.update, { merge: true });
    log.info('Subscription document updated from webhook', {
      userId,
      subscriptionId: subscriptionRecord.id.toString(),
      status: payload.status
    });
    return {
      userId,
      subscriptionId: subscriptionRecord.id.toString(),
      status: payload.status,
      attributes: payload.attributes,
      relationships: payload.relationships
    };
  } catch (err) {
    log.warn('Failed to update subscription document from webhook', { error: err?.message || err });
    return null;
  }
}

module.exports = {
  resolveSubscription,
  upsertSubscriptionFromWebhook,
  buildSubscriptionUpdateFromRecord,
  ACTIVE_STATUSES,
  CANCELLED_STATUSES,
  hasActiveStatus,
  hasCancelledStatus
};

