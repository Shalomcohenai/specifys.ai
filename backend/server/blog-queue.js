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

  // Start processing if not already processing
  if (!blogQueue.processing) {
    processQueue();
  }

  return queueItem;
}

/**
 * Process queue items sequentially
 */
async function processQueue() {
  if (blogQueue.processing) {
    return;
  }

  blogQueue.processing = true;

  while (blogQueue.items.length > 0 || blogQueue.currentItem) {
    let item;
    
    if (blogQueue.currentItem) {
      // Continue processing current item
      item = blogQueue.currentItem;
    } else if (blogQueue.items.length > 0) {
      // Get next item from queue
      item = blogQueue.items.shift();
      blogQueue.currentItem = item;
    } else {
      break;
    }

    try {
      // Update status to processing
      if (item.status === QUEUE_STATUS.PENDING) {
        item.status = QUEUE_STATUS.PROCESSING;
        item.startedAt = new Date();
        await updateQueueItemInFirestore(item);
      }

      console.log(`[Blog Queue] Processing item ${item.id}: ${item.postData.title}`);

      // Wait for the actual processing to complete
      // The processing will be done by calling processQueueItem from blog-routes.js
      // We'll wait a bit and check if it's completed
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`[Blog Queue] Error processing item ${item.id}:`, error);
      item.status = QUEUE_STATUS.FAILED;
      item.error = error.message;
      item.completedAt = new Date();
      await updateQueueItemInFirestore(item);
      blogQueue.currentItem = null;
    }
  }

  blogQueue.currentItem = null;
  blogQueue.processing = false;
}

/**
 * Process a single queue item
 * @param {Object} item - Queue item
 * @param {Function} publishFunction - Function to publish the post
 * @returns {Promise<Object>} Result
 */
async function processQueueItem(item, publishFunction) {
  try {
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
    const result = await publishFunction(item.postData);

    // Mark as completed
    item.status = QUEUE_STATUS.COMPLETED;
    item.result = result;
    item.completedAt = new Date();
    blogQueue.currentItem = null;
    await updateQueueItemInFirestore(item);

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
    item.status = QUEUE_STATUS.FAILED;
    item.error = error.message;
    item.completedAt = new Date();
    blogQueue.currentItem = null;
    await updateQueueItemInFirestore(item);
    
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
  processQueue,
  processQueueItem,
  getQueueStatus,
  getQueueItems,
  QUEUE_STATUS
};

