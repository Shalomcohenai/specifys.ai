const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const emailService = require('./email-service');
const emailTracking = require('./email-tracking-service');

/**
 * GET /api/admin/newsletters
 * Get all newsletters
 */
router.get('/', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-list-${Date.now()}`;
  
  try {
    const { limit = 50, status } = req.query;
    
    let query = db.collection('newsletters').orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.limit(parseInt(limit, 10)).get();
    
    const newsletters = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        sentAt: data.sentAt?.toDate?.()?.toISOString() || data.sentAt
      };
    });
    
    logger.info({ requestId, count: newsletters.length }, '[newsletter-routes] Newsletters retrieved');
    
    res.json({
      success: true,
      newsletters
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[newsletter-routes] Failed to get newsletters');
    next(createError('Failed to get newsletters', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/newsletters/:id
 * Get a specific newsletter
 */
router.get('/:id', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-get-${Date.now()}`;
  const { id } = req.params;
  
  try {
    const doc = await db.collection('newsletters').doc(id).get();
    
    if (!doc.exists) {
      return next(createError('Newsletter not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    const data = doc.data();
    const newsletter = {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      sentAt: data.sentAt?.toDate?.()?.toISOString() || data.sentAt
    };
    
    logger.info({ requestId, newsletterId: id }, '[newsletter-routes] Newsletter retrieved');
    
    res.json({
      success: true,
      newsletter
    });
  } catch (error) {
    logger.error({ requestId, newsletterId: id, error: error.message }, '[newsletter-routes] Failed to get newsletter');
    next(createError('Failed to get newsletter', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/newsletters/:id/stats
 * Get statistics for a specific newsletter
 */
router.get('/:id/stats', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-stats-${Date.now()}`;
  const { id } = req.params;
  
  try {
    const doc = await db.collection('newsletters').doc(id).get();
    
    if (!doc.exists) {
      return next(createError('Newsletter not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    // Get clicks for this newsletter (using newsletter email type)
    const stats = await emailTracking.getEmailClickStats({
      emailType: `newsletter-${id}`,
      startDate: doc.data().sentAt?.toDate?.()?.toISOString() || doc.data().createdAt?.toDate?.()?.toISOString()
    });
    
    const newsletterData = doc.data();
    const sentTo = newsletterData.sentTo || 0;
    const clicks = stats.total;
    const uniqueClicks = stats.uniqueUsers;
    
    logger.info({ requestId, newsletterId: id, sentTo, clicks }, '[newsletter-routes] Newsletter stats retrieved');
    
    res.json({
      success: true,
      stats: {
        sentTo,
        clicks,
        uniqueClicks,
        clickRate: sentTo > 0 ? ((clicks / sentTo) * 100).toFixed(2) : 0,
        uniqueClickRate: sentTo > 0 ? ((uniqueClicks / sentTo) * 100).toFixed(2) : 0,
        byLinkType: stats.byLinkType,
        topUsers: stats.topUsers
      }
    });
  } catch (error) {
    logger.error({ requestId, newsletterId: id, error: error.message }, '[newsletter-routes] Failed to get newsletter stats');
    next(createError('Failed to get newsletter stats', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/admin/newsletters
 * Create or send a newsletter
 */
router.post('/', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-create-${Date.now()}`;
  
  try {
    const { subject, content, sendNow = false } = req.body;
    const adminUserId = req.adminUser.uid;
    const adminEmail = req.adminUser.email;
    
    if (!subject || !content) {
      return next(createError('Subject and content are required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Create newsletter document
    const newsletterData = {
      subject,
      content,
      status: sendNow ? 'sending' : 'draft',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUserId,
      createdByEmail: adminEmail,
      sentTo: 0,
      clicks: 0
    };
    
    if (sendNow) {
      newsletterData.sentAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    const docRef = await db.collection('newsletters').add(newsletterData);
    const newsletterId = docRef.id;
    
    logger.info({ requestId, newsletterId, sendNow }, '[newsletter-routes] Newsletter created');
    
    // If sendNow is true, send the newsletter
    if (sendNow) {
      // Send newsletter asynchronously (don't block response)
      sendNewsletterToUsers(newsletterId, subject, content, requestId).catch(err => {
        logger.error({ requestId, newsletterId, error: err.message }, '[newsletter-routes] Failed to send newsletter');
      });
      
      res.json({
        success: true,
        message: 'Newsletter created and sending started',
        newsletter: {
          id: newsletterId,
          ...newsletterData,
          status: 'sending'
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Newsletter saved as draft',
        newsletter: {
          id: newsletterId,
          ...newsletterData,
          status: 'draft'
        }
      });
    }
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[newsletter-routes] Failed to create newsletter');
    next(createError('Failed to create newsletter', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * PUT /api/admin/newsletters/:id
 * Update a newsletter
 */
router.put('/:id', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-update-${Date.now()}`;
  const { id } = req.params;
  
  try {
    const { subject, content, sendNow } = req.body;
    
    const doc = await db.collection('newsletters').doc(id).get();
    
    if (!doc.exists) {
      return next(createError('Newsletter not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    const updateData = {};
    if (subject !== undefined) updateData.subject = subject;
    if (content !== undefined) updateData.content = content;
    if (sendNow) {
      updateData.status = 'sending';
      updateData.sentAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await db.collection('newsletters').doc(id).update(updateData);
    
    logger.info({ requestId, newsletterId: id, sendNow }, '[newsletter-routes] Newsletter updated');
    
    // If sendNow is true, send the newsletter
    if (sendNow) {
      const newsletterData = doc.data();
      const finalSubject = subject || newsletterData.subject;
      const finalContent = content || newsletterData.content;
      
      sendNewsletterToUsers(id, finalSubject, finalContent, requestId).catch(err => {
        logger.error({ requestId, newsletterId: id, error: err.message }, '[newsletter-routes] Failed to send newsletter');
      });
      
      res.json({
        success: true,
        message: 'Newsletter updated and sending started'
      });
    } else {
      res.json({
        success: true,
        message: 'Newsletter updated'
      });
    }
  } catch (error) {
    logger.error({ requestId, newsletterId: id, error: error.message }, '[newsletter-routes] Failed to update newsletter');
    next(createError('Failed to update newsletter', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/admin/newsletters/:id/send
 * Send an existing newsletter
 */
router.post('/:id/send', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `newsletter-send-${Date.now()}`;
  const { id } = req.params;
  
  try {
    const doc = await db.collection('newsletters').doc(id).get();
    
    if (!doc.exists) {
      return next(createError('Newsletter not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    const data = doc.data();
    
    if (data.status === 'sent') {
      return next(createError('Newsletter already sent', ERROR_CODES.INVALID_REQUEST, 400));
    }
    
    // Update status
    await db.collection('newsletters').doc(id).update({
      status: 'sending',
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send newsletter asynchronously
    sendNewsletterToUsers(id, data.subject, data.content, requestId).catch(err => {
      logger.error({ requestId, newsletterId: id, error: err.message }, '[newsletter-routes] Failed to send newsletter');
    });
    
    logger.info({ requestId, newsletterId: id }, '[newsletter-routes] Newsletter send initiated');
    
    res.json({
      success: true,
      message: 'Newsletter sending started'
    });
  } catch (error) {
    logger.error({ requestId, newsletterId: id, error: error.message }, '[newsletter-routes] Failed to send newsletter');
    next(createError('Failed to send newsletter', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Helper function to send newsletter to all subscribed users
 */
async function sendNewsletterToUsers(newsletterId, subject, content, requestId) {
  try {
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    let sentCount = 0;
    let failedCount = 0;
    
    // Get all users subscribed to newsletter
    const usersSnapshot = await db.collection('users')
      .where('newsletterSubscribed', '==', true)
      .get();
    
    logger.info({ requestId, newsletterId, totalUsers: usersSnapshot.size }, '[newsletter-routes] Starting newsletter send');
    
    // Send to each user (in batches to avoid rate limits)
    const batchSize = 10;
    const users = usersSnapshot.docs;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      await Promise.allSettled(batch.map(async (userDoc) => {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const userEmail = userData.email;
          const userName = userData.displayName || userEmail.split('@')[0];
          
          // Check if user wants newsletter emails
          if (userData.emailPreferences?.newsletter !== false) {
            // Generate unsubscribe URL with tracking
            const unsubscribeUrl = emailTracking.generateTrackingUrl(
              `${baseUrl}/pages/unsubscribe.html`,
              `newsletter-${newsletterId}`,
              userId,
              'unsubscribe'
            );
            
            // Send email with newsletter ID in subject or metadata for tracking
            // The email type will be 'newsletter' but we'll track with newsletter ID
            await emailService.sendNewsletterEmail(
              userEmail,
              userName,
              subject,
              content,
              unsubscribeUrl,
              userId, // Pass userId for tracking
              `newsletter-${newsletterId}` // Use newsletter ID as email type for tracking
            );
            
            sentCount++;
            
            if (sentCount % 50 === 0) {
              logger.info({ requestId, newsletterId, sentCount }, '[newsletter-routes] Newsletter sending progress');
            }
          }
        } catch (error) {
          failedCount++;
          logger.warn({ requestId, newsletterId, userId: userDoc.id, error: error.message }, '[newsletter-routes] Failed to send newsletter to user');
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Update newsletter document
    await db.collection('newsletters').doc(newsletterId).update({
      status: 'sent',
      sentTo: sentCount,
      failedToSend: failedCount,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info({ requestId, newsletterId, sentCount, failedCount }, '[newsletter-routes] Newsletter send completed');
  } catch (error) {
    // Update status to failed
    await db.collection('newsletters').doc(newsletterId).update({
      status: 'failed',
      error: error.message
    });
    
    logger.error({ requestId, newsletterId, error: error.message }, '[newsletter-routes] Newsletter send failed');
    throw error;
  }
}

/**
 * POST /api/newsletter/unsubscribe
 * Unsubscribe a user from newsletter by email
 * Public endpoint - no authentication required
 */
router.post('/unsubscribe', async (req, res, next) => {
  const requestId = req.requestId || `newsletter-unsubscribe-${Date.now()}`;
  
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return next(createError('Valid email address is required', ERROR_CODES.INVALID_INPUT, 400));
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    logger.info({ requestId, email: normalizedEmail }, '[newsletter-routes] Processing unsubscribe request');
    
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      // User not found, but return success anyway (security best practice - don't reveal if email exists)
      logger.info({ requestId, email: normalizedEmail }, '[newsletter-routes] Email not found in system, but returning success');
      return res.json({
        success: true,
        message: 'You have been unsubscribed from our newsletter.'
      });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // Update user email preferences
    const updateData = {
      newsletterSubscribed: false,
      'emailPreferences.newsletter': false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).update(updateData);
    
    logger.info({ requestId, userId, email: normalizedEmail }, '[newsletter-routes] User unsubscribed from newsletter');
    
    res.json({
      success: true,
      message: 'You have been unsubscribed from our newsletter.'
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[newsletter-routes] Failed to unsubscribe user');
    next(createError('Failed to unsubscribe', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

