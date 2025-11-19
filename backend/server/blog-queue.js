/**
 * Blog Post Queue System
 * Handles sequential publishing of blog posts with delays
 */

const { db } = require('./firebase-admin');

// In-memory queue (for single server instance)
// In production, use Redis or similar for multi-instance support
const blogQueue = {
  items: [],
  processing: false,
  currentItem: null
};

// Queue item statuses
const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Add post to queue
 * @param {Object} postData - Post data
 * @returns {Promise<Object>} Queue item
 */
async function addToQueue(postData) {
  const slug = postData?.slug;

  if (!slug) {
    throw new Error('Queue item requires a valid slug.');
  }

  // Check for duplicates in memory (current or pending)
  const duplicateInMemory =
    (blogQueue.currentItem &&
      blogQueue.currentItem.status !== QUEUE_STATUS.COMPLETED &&
      blogQueue.currentItem.status !== QUEUE_STATUS.FAILED &&
      blogQueue.currentItem.postData?.slug === slug) ||
    blogQueue.items.some(
      (item) =>
        item.postData?.slug === slug &&
        item.status !== QUEUE_STATUS.COMPLETED &&
        item.status !== QUEUE_STATUS.FAILED
    );

  if (duplicateInMemory) {
    const error = new Error(
      'A post with this slug is already queued or being published.'
    );
    error.code = 'duplicate-slug';
    throw error;
  }

  // Check for duplicates persisted in Firestore (handles restarts)
  try {
    const snapshot = await db
      .collection('blogQueue')
      .where('postData.slug', '==', slug)
      .where('status', 'in', [QUEUE_STATUS.PENDING, QUEUE_STATUS.PROCESSING])
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const error = new Error(
        'A post with this slug is already queued or being published.'
      );
      error.code = 'duplicate-slug';
      throw error;
    }
  } catch (firestoreCheckError) {
    console.error(
      '[Blog Queue] Failed to check for duplicate slug in Firestore',
      firestoreCheckError
    );
  }

  const queueItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: QUEUE_STATUS.PENDING,
    postData: postData,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    error: null,
    result: null
  };

  // Add to in-memory queue
  blogQueue.items.push(queueItem);

  // Save to Firestore for persistence
  try {
    await db.collection('blogQueue').doc(queueItem.id).set({
      ...queueItem,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    });
  } catch (error) {
    console.error('Error saving queue item to Firestore:', error);
  }

  return queueItem;
}

/**
 * Process a single queue item
 * @param {Object} item - Queue item
 * @param {Function} publishFunction - Function to publish the post
 * @returns {Promise<Object>} Result
 */
async function processQueueItem(item, publishFunction) {
  // If already processing, add to queue and return
  if (blogQueue.processing) {
    console.log(`[Blog Queue] Already processing, adding item ${item.id} to queue`);
    // Make sure item is in the queue
    const existsInQueue = blogQueue.items.some((queued) => queued.id === item.id);
    if (!existsInQueue) {
      blogQueue.items.push(item);
    }
    return;
  }

  try {
    blogQueue.processing = true;

    // Remove item from pending queue if it still exists there
    const pendingIndex = blogQueue.items.findIndex((queued) => queued.id === item.id);
    if (pendingIndex >= 0) {
      blogQueue.items.splice(pendingIndex, 1);
    }

    // Update status
    item.status = QUEUE_STATUS.PROCESSING;
    item.startedAt = new Date();
    blogQueue.currentItem = item;
    await updateQueueItemInFirestore(item);

    // Add delay between posts (5 seconds) - only if there are other items
    if (blogQueue.items.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Publish the post
    console.log(`[Blog Queue] Starting to publish post: ${item.postData?.title || item.id}`);
    const result = await publishFunction(item.postData);
    console.log(`[Blog Queue] Successfully published post: ${item.postData?.title || item.id}`);

    // Mark as completed
    item.status = QUEUE_STATUS.COMPLETED;
    item.result = result;
    item.completedAt = new Date();
    blogQueue.currentItem = null;
    await updateQueueItemInFirestore(item);
    console.log(`[Blog Queue] Marked item ${item.id} as completed`);

    // Process next item in queue
    if (blogQueue.items.length > 0) {
      const nextItem = blogQueue.items.shift();
      processQueueItem(nextItem, publishFunction).catch(error => {
        console.error('Error processing next queue item:', error);
      });
    } else {
      blogQueue.processing = false;
    }

    return result;
  } catch (error) {
    console.error(`[Blog Queue] Error processing item ${item.id}:`, error);
    item.status = QUEUE_STATUS.FAILED;
    item.error = error.message || String(error);
    item.completedAt = new Date();
    blogQueue.currentItem = null;
    await updateQueueItemInFirestore(item);
    console.log(`[Blog Queue] Marked item ${item.id} as failed: ${item.error}`);
    
    // Process next item even if this one failed
    if (blogQueue.items.length > 0) {
      const nextItem = blogQueue.items.shift();
      processQueueItem(nextItem, publishFunction).catch(err => {
        console.error('Error processing next queue item:', err);
      });
    } else {
      blogQueue.processing = false;
    }
    
    throw error;
  }
}

/**
 * Update queue item in Firestore
 */
async function updateQueueItemInFirestore(item) {
  try {
    const updateData = {
      status: item.status,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      error: item.error,
      result: item.result
    };

    if (item.startedAt) {
      updateData.startedAt = item.startedAt;
    }
    if (item.completedAt) {
      updateData.completedAt = item.completedAt;
    }

    await db.collection('blogQueue').doc(item.id).update(updateData);
  } catch (error) {
    console.error('Error updating queue item in Firestore:', error);
  }
}

/**
 * Get queue status
 * @returns {Object} Queue status
 */
function getQueueStatus() {
  return {
    total: blogQueue.items.length + (blogQueue.currentItem ? 1 : 0),
    pending: blogQueue.items.length,
    processing: blogQueue.processing,
    currentItem: blogQueue.currentItem ? {
      id: blogQueue.currentItem.id,
      title: blogQueue.currentItem.postData.title,
      status: blogQueue.currentItem.status
    } : null
  };
}

/**
 * Get all queue items from Firestore
 * @param {number} limit - Maximum number of items to retrieve
 * @returns {Promise<Array>} Queue items
 */
async function getQueueItems(limit = 50) {
  try {
    const snapshot = await db.collection('blogQueue')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt,
      startedAt: doc.data().startedAt?.toDate ? doc.data().startedAt.toDate() : doc.data().startedAt,
      completedAt: doc.data().completedAt?.toDate ? doc.data().completedAt.toDate() : doc.data().completedAt
    }));
  } catch (error) {
    console.error('Error getting queue items:', error);
    return [];
  }
}

/**
 * Clear completed items from Firestore (older than 7 days)
 */
async function clearOldQueueItems() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await db.collection('blogQueue')
      .where('status', 'in', [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.FAILED])
      .where('completedAt', '<', sevenDaysAgo)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[Blog Queue] Cleared ${snapshot.size} old queue items`);
  } catch (error) {
    console.error('Error clearing old queue items:', error);
  }
}

// Clear old items on startup
setTimeout(() => clearOldQueueItems(), 60000); // Run after 1 minute

module.exports = {
  addToQueue,
  processQueueItem,
  getQueueStatus,
  getQueueItems,
  QUEUE_STATUS
};

