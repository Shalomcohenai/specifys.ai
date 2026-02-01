/**
 * Payments Cache Service
 * Manages caching of Lemon Squeezy payments data in Firestore
 * Refreshes every 24 hours automatically
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { listOrders, listCustomers, listSubscriptions, listSubscriptionInvoices } = require('./lemon-subscription-resolver');

const PAYMENTS_CACHE_COLLECTION = 'payments_cache';
const CACHE_EXPIRY_HOURS = 24;

/**
 * Get cache expiry timestamp (24 hours from now)
 */
function getCacheExpiry() {
  const now = new Date();
  const expiry = new Date(now.getTime() + CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
  return admin.firestore.Timestamp.fromDate(expiry);
}

/**
 * Check if cache is expired or needs refresh
 */
function isCacheExpired(cacheDoc) {
  if (!cacheDoc || !cacheDoc.exists) {
    return true;
  }

  const data = cacheDoc.data();
  const lastSynced = data.last_synced_at?.toDate();
  
  if (!lastSynced) {
    return true;
  }

  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceSync >= CACHE_EXPIRY_HOURS;
}

/**
 * Sync all payments data from Lemon Squeezy API
 */
async function syncPaymentsData({ apiKey, storeId, logger: logService, requestId }) {
  const log = logService || logger;
  const reqId = requestId || `sync-${Date.now()}`;

  log.info({ requestId: reqId, storeId }, '[payments-cache] Starting payments data sync from Lemon Squeezy API');

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const now = admin.firestore.Timestamp.now();
    const expiry = getCacheExpiry();

    // Fetch all data from Lemon API
    const [ordersResult, customersResult, subscriptionsResult] = await Promise.all([
      listOrders({ fetch, apiKey, storeId, logger: log, requestId: reqId }),
      listCustomers({ fetch, apiKey, storeId, logger: log, requestId: reqId }),
      listSubscriptions({ fetch, apiKey, storeId, logger: log, requestId: reqId })
    ]);

    // Process orders
    const orders = ordersResult.records || [];
    const ordersData = orders.map(order => {
      const attributes = order.attributes || {};
      const relationships = order.relationships || {};
      
      return {
        id: order.id,
        orderNumber: attributes.order_number || null,
        total: attributes.total || 0,
        currency: attributes.currency || 'USD',
        status: attributes.status || null,
        refunded: attributes.refunded || false,
        refundedAt: attributes.refunded_at || null,
        createdAt: attributes.created_at || null,
        customerId: attributes.customer_id || relationships?.customer?.data?.id || null,
        subscriptionId: attributes.subscription_id || relationships?.subscription?.data?.id || null,
        testMode: attributes.test_mode || false,
        productName: attributes.first_order_item?.product_name || null,
        variantName: attributes.first_order_item?.variant_name || null,
        customerEmail: attributes.customer_email || null,
        raw: order
      };
    });

    // Process customers
    const customers = customersResult.records || [];
    const customersData = customers.map(customer => ({
      id: customer.id,
      email: customer.attributes?.email || null,
      name: customer.attributes?.name || null,
      totalSpent: customer.attributes?.total_spent || 0,
      totalOrders: customer.attributes?.total_orders || 0,
      createdAt: customer.attributes?.created_at || null,
      updatedAt: customer.attributes?.updated_at || null,
      testMode: customer.attributes?.test_mode || false,
      raw: customer
    }));

    // Process subscriptions
    const subscriptions = subscriptionsResult.records || [];
    const subscriptionsData = subscriptions.map(sub => ({
      id: sub.id,
      status: sub.attributes?.status || null,
      productName: sub.attributes?.product_name || null,
      variantName: sub.attributes?.variant_name || null,
      customerId: sub.attributes?.customer_id || null,
      orderId: sub.attributes?.order_id || null,
      renewsAt: sub.attributes?.renews_at || null,
      endsAt: sub.attributes?.ends_at || null,
      trialEndsAt: sub.attributes?.trial_ends_at || null,
      cancelled: sub.attributes?.cancelled || false,
      cancelAtPeriodEnd: sub.attributes?.cancel_at_period_end || false,
      createdAt: sub.attributes?.created_at || null,
      updatedAt: sub.attributes?.updated_at || null,
      testMode: sub.attributes?.test_mode || false,
      raw: sub
    }));

      // Fetch invoices for all subscriptions (in batches to avoid rate limiting)
      const invoicesData = [];
      const BATCH_SIZE = 5; // Smaller batches to avoid rate limiting
      
      for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
        const batch = subscriptions.slice(i, i + BATCH_SIZE);
        const invoicePromises = batch.map(sub => 
          listSubscriptionInvoices({ 
            fetch, 
            apiKey, 
            storeId, 
            subscriptionId: sub.id,
            logger: log, 
            requestId: reqId 
          })
        );
        
        const invoiceResults = await Promise.all(invoicePromises);
        invoiceResults.forEach((result, index) => {
          const invoices = result.records || [];
          const subscriptionId = batch[index].id;
          invoices.forEach(invoice => {
            invoicesData.push({
              id: invoice.id,
              subscriptionId: subscriptionId,
              status: invoice.attributes?.status || null,
              total: invoice.attributes?.total || 0,
              currency: invoice.attributes?.currency || 'USD',
              refunded: invoice.attributes?.refunded || false,
              refundedAt: invoice.attributes?.refunded_at || null,
              createdAt: invoice.attributes?.created_at || null,
              paidAt: invoice.attributes?.paid_at || null,
              testMode: invoice.attributes?.test_mode || false,
              raw: invoice
            });
          });
        });
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < subscriptions.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

    // Save to Firestore cache
    const cacheRef = db.collection(PAYMENTS_CACHE_COLLECTION).doc('main');
    
    const cacheData = {
      orders: ordersData,
      customers: customersData,
      subscriptions: subscriptionsData,
      invoices: invoicesData,
      last_synced_at: now,
      expires_at: expiry,
      sync_status: 'success',
      sync_error: null,
      stats: {
        totalOrders: ordersData.length,
        totalCustomers: customersData.length,
        totalSubscriptions: subscriptionsData.length,
        totalInvoices: invoicesData.length,
        // Convert from cents to dollars (Lemon Squeezy stores amounts in cents)
        totalRevenue: ordersData.reduce((sum, order) => sum + ((order.total || 0) / 100), 0),
        activeSubscriptions: subscriptionsData.filter(sub => 
          sub.status === 'active' || sub.status === 'on_trial'
        ).length,
        cancelledSubscriptions: subscriptionsData.filter(sub => 
          sub.status === 'cancelled' || sub.cancelled
        ).length,
        refundedOrders: ordersData.filter(order => order.refunded).length
      },
      updated_at: now
    };

    await cacheRef.set(cacheData, { merge: false });

    log.info({
      requestId: reqId,
      orders: ordersData.length,
      customers: customersData.length,
      subscriptions: subscriptionsData.length,
      invoices: invoicesData.length
    }, '[payments-cache] Payments data synced successfully');

    return cacheData;
  } catch (error) {
    log.error({
      requestId: reqId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[payments-cache] Failed to sync payments data');

    // Save error status
    const cacheRef = db.collection(PAYMENTS_CACHE_COLLECTION).doc('main');
    await cacheRef.set({
      sync_status: 'error',
      sync_error: error.message,
      last_synced_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now()
    }, { merge: true });

    throw error;
  }
}

/**
 * Get cached payments data
 */
async function getCachedPaymentsData({ forceRefresh = false, apiKey, storeId, logger: logService, requestId } = {}) {
  const log = logService || logger;
  const reqId = requestId || `get-cache-${Date.now()}`;

  try {
    const cacheRef = db.collection(PAYMENTS_CACHE_COLLECTION).doc('main');
    const cacheDoc = await cacheRef.get();

    // Check if we need to refresh
    if (forceRefresh || isCacheExpired(cacheDoc)) {
      log.info({ requestId: reqId, forceRefresh, expired: !forceRefresh && isCacheExpired(cacheDoc) }, 
        '[payments-cache] Cache expired or force refresh requested, syncing...');
      
      if (!apiKey || !storeId) {
        throw new Error('API key and store ID required for sync');
      }

      await syncPaymentsData({ apiKey, storeId, logger: log, requestId: reqId });
      const refreshedDoc = await cacheRef.get();
      
      if (refreshedDoc.exists) {
        return refreshedDoc.data();
      }
    }

    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      log.debug({ requestId: reqId, cached: true }, '[payments-cache] Returning cached payments data');
      return data;
    }

    // No cache exists - need to sync
    if (apiKey && storeId) {
      log.info({ requestId: reqId }, '[payments-cache] No cache exists, syncing...');
      await syncPaymentsData({ apiKey, storeId, logger: log, requestId: reqId });
      const newCacheDoc = await cacheRef.get();
      
      if (newCacheDoc.exists) {
        return newCacheDoc.data();
      }
    }

    return null;
  } catch (error) {
    log.error({
      requestId: reqId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[payments-cache] Failed to get cached payments data');

    // Return existing cache even if expired, if available
    const cacheRef = db.collection(PAYMENTS_CACHE_COLLECTION).doc('main');
    const cacheDoc = await cacheRef.get();
    
    if (cacheDoc.exists) {
      return cacheDoc.data();
    }

    throw error;
  }
}

/**
 * Get payments summary statistics
 */
async function getPaymentsSummary({ apiKey, storeId, logger: logService, requestId } = {}) {
  const data = await getCachedPaymentsData({ apiKey, storeId, logger: logService, requestId });
  
  if (!data) {
    return null;
  }

  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter orders by date
  const recentOrders = (data.orders || []).filter(order => {
    if (!order.createdAt) return false;
    const orderDate = new Date(order.createdAt);
    return orderDate >= last30Days;
  });

  const last7DaysOrders = recentOrders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= last7Days;
  });

  // Filter new subscribers (subscriptions created in last 30 days)
  const newSubscribers = (data.subscriptions || []).filter(sub => {
    if (!sub.createdAt) return false;
    const subDate = new Date(sub.createdAt);
    return subDate >= last30Days;
  });

  // Find errors (cancelled, refunded, past_due)
  const errors = {
    cancelledSubscriptions: (data.subscriptions || []).filter(sub => 
      sub.status === 'cancelled' || sub.cancelled
    ),
    refundedOrders: (data.orders || []).filter(order => order.refunded),
    pastDueSubscriptions: (data.subscriptions || []).filter(sub => 
      sub.status === 'past_due'
    ),
    expiredSubscriptions: (data.subscriptions || []).filter(sub => 
      sub.status === 'expired'
    )
  };

  return {
    summary: {
      totalRevenue: data.stats?.totalRevenue || 0,
      totalOrders: data.stats?.totalOrders || 0,
      totalCustomers: data.stats?.totalCustomers || 0,
      activeSubscriptions: data.stats?.activeSubscriptions || 0,
      // Convert from cents to dollars (Lemon Squeezy stores amounts in cents)
      revenueLast30Days: recentOrders.reduce((sum, order) => sum + ((order.total || 0) / 100), 0),
      revenueLast7Days: last7DaysOrders.reduce((sum, order) => sum + ((order.total || 0) / 100), 0),
      ordersLast30Days: recentOrders.length,
      ordersLast7Days: last7DaysOrders.length,
      newSubscribers30Days: newSubscribers.length
    },
    errors: {
      cancelled: errors.cancelledSubscriptions.length,
      refunded: errors.refundedOrders.length,
      pastDue: errors.pastDueSubscriptions.length,
      expired: errors.expiredSubscriptions.length,
      total: errors.cancelledSubscriptions.length + errors.refundedOrders.length + 
             errors.pastDueSubscriptions.length + errors.expiredSubscriptions.length
    },
    // Include full data for frontend use
    customers: data.customers || [],
    subscriptions: data.subscriptions || [],
    lastSynced: data.last_synced_at,
    syncStatus: data.sync_status
  };
}

module.exports = {
  syncPaymentsData,
  getCachedPaymentsData,
  getPaymentsSummary,
  isCacheExpired,
  PAYMENTS_CACHE_COLLECTION
};

