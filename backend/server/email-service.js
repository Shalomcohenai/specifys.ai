const { Resend } = require('resend');
const { logger } = require('./logger');
const emailTemplates = require('./email-templates');
const emailTracking = require('./email-tracking-service');

/**
 * Email Service using Resend
 * Handles all email sending operations
 */
class EmailService {
  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@specifys-ai.com';
    
    if (!apiKey) {
      logger.warn('[EmailService] RESEND_API_KEY not configured - email service disabled');
      this.resend = null;
      this.fromEmail = fromEmail;
      return;
    }
    
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
    logger.info({ fromEmail }, '[EmailService] Initialized with Resend');
  }

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return this.resend !== null;
  }

  /**
   * Send welcome email to new user
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL (optional, defaults to env)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendWelcomeEmail(userEmail, userName, userId = null, baseUrl = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendWelcomeEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendWelcomeEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      const finalBaseUrl = baseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      
      // Generate tracking URL
      const getStartedUrl = emailTracking.generateTrackingUrl(
        finalBaseUrl, 
        'welcome', 
        userId || 'anonymous',
        'get-started'
      );
      
      const html = emailTemplates.welcomeEmail(userName || userEmail.split('@')[0], getStartedUrl);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'Welcome to Specifys.ai',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'Welcome to Specifys.ai', 'welcome', 'user_registered', { messageId: result.id }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record welcome email sent');
        });
      }

      logger.info({ userEmail, messageId: result.id }, '[EmailService] Welcome email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send welcome email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send spec ready notification email
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} specTitle - Specification title
   * @param {string} specId - Specification ID
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendSpecReadyEmail(userEmail, userName, specTitle, specId, userId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendSpecReadyEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendSpecReadyEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URL
      const specLinkBase = `${baseUrl}/pages/spec-viewer.html?id=${specId}`;
      const specLink = emailTracking.generateTrackingUrl(
        specLinkBase, 
        'spec-ready', 
        userId || 'anonymous',
        'spec-view',
        { specId }
      );
      
      const html = emailTemplates.specReadyEmail(userName || userEmail.split('@')[0], specTitle, specLink);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: `Your specification "${specTitle}" is ready!`,
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, `Your specification "${specTitle}" is ready!`, 'spec-ready', 'spec_created', { messageId: result.id, specId }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record spec ready email sent');
        });
      }

      logger.info({ userEmail, specId, messageId: result.id }, '[EmailService] Spec ready email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, specId, error: error.message }, '[EmailService] Failed to send spec ready email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send newsletter email
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} subject - Newsletter subject
   * @param {string} htmlContent - Newsletter HTML content
   * @param {string} unsubscribeUrl - Unsubscribe URL
   * @param {string} userId - User ID (for tracking, optional)
   * @param {string} emailType - Email type for tracking (optional, defaults to 'newsletter')
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendNewsletterEmail(userEmail, userName, subject, htmlContent, unsubscribeUrl, userId = null, emailType = 'newsletter') {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendNewsletterEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendNewsletterEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Add tracking to unsubscribe URL if not already tracked
      let finalUnsubscribeUrl = unsubscribeUrl;
      if (userId && !unsubscribeUrl.includes('et=')) {
        finalUnsubscribeUrl = emailTracking.generateTrackingUrl(
          unsubscribeUrl,
          emailType,
          userId,
          'unsubscribe'
        );
      }
      
      const html = emailTemplates.newsletterEmail(userName || userEmail.split('@')[0], htmlContent, finalUnsubscribeUrl);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: subject,
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, subject, 'newsletter', eventName || 'newsletter_sent', { messageId: result.id, emailType }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record newsletter email sent');
        });
      }

      logger.info({ userEmail, messageId: result.id, emailType }, '[EmailService] Newsletter email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send newsletter email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send generic notification email
   * @param {string} userEmail - User's email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - Email HTML content
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendNotificationEmail(userEmail, subject, htmlContent) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendNotificationEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendNotificationEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      const html = emailTemplates.notificationEmail(htmlContent);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: subject,
        html: html
      });

      logger.info({ userEmail, messageId: result.id }, '[EmailService] Notification email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send notification email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send inactive user email (after 30 days)
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendInactiveUserEmail(userEmail, userName, userId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendInactiveUserEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendInactiveUserEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URL for return button
      const returnUrl = emailTracking.generateTrackingUrl(
        baseUrl, 
        'inactive-user', 
        userId || 'anonymous',
        'return'
      );
      
      const html = emailTemplates.inactiveUserEmail(userName || userEmail.split('@')[0], returnUrl, baseUrl);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'We Miss You at Specifys.ai',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'We Miss You at Specifys.ai', 'inactive-user', 'inactive_user_30_days', { messageId: result.id }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record inactive user email sent');
        });
      }

      logger.info({ userEmail, messageId: result.id }, '[EmailService] Inactive user email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send inactive user email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send purchase confirmation email
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} userId - User ID (for tracking)
   * @param {string} productName - Product name
   * @param {number} amount - Purchase amount
   * @param {string} currency - Currency code
   * @param {string} orderId - Order ID
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendPurchaseConfirmationEmail(userEmail, userName, userId, productName, amount, currency, orderId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendPurchaseConfirmationEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendPurchaseConfirmationEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URL for account view
      const accountUrl = emailTracking.generateTrackingUrl(
        `${baseUrl}/pages/profile.html`, 
        'purchase-confirmation', 
        userId || 'anonymous',
        'account-view',
        { orderId }
      );
      
      const html = emailTemplates.purchaseConfirmationEmail(
        userName || userEmail.split('@')[0],
        productName,
        amount,
        currency,
        orderId,
        accountUrl
      );
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'Thank You for Your Purchase',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'Thank You for Your Purchase', 'purchase-confirmation', 'purchase_confirmed', { messageId: result.id, orderId, productName, amount, currency }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record purchase confirmation email sent');
        });
      }

      logger.info({ userEmail, orderId, messageId: result.id }, '[EmailService] Purchase confirmation email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, orderId, error: error.message }, '[EmailService] Failed to send purchase confirmation email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send advanced spec ready email
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} specTitle - Specification title
   * @param {string} specId - Specification ID
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendAdvancedSpecReadyEmail(userEmail, userName, specTitle, specId, userId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendAdvancedSpecReadyEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendAdvancedSpecReadyEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URL
      const specLinkBase = `${baseUrl}/pages/spec-viewer.html?id=${specId}`;
      const specLink = emailTracking.generateTrackingUrl(
        specLinkBase, 
        'advanced-spec-ready', 
        userId || 'anonymous',
        'spec-view',
        { specId }
      );
      
      const html = emailTemplates.advancedSpecReadyEmail(userName || userEmail.split('@')[0], specTitle, specLink);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: `Your advanced specification "${specTitle}" is ready!`,
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, `Your advanced specification "${specTitle}" is ready!`, 'advanced-spec-ready', 'advanced_spec_created', { messageId: result.id, specId }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record advanced spec ready email sent');
        });
      }

      logger.info({ userEmail, specId, messageId: result.id }, '[EmailService] Advanced spec ready email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, specId, error: error.message }, '[EmailService] Failed to send advanced spec ready email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Tool Finder usage email
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendToolFinderUsageEmail(userEmail, userName, userId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendToolFinderUsageEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendToolFinderUsageEmail - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URLs
      const toolFinderUrl = emailTracking.generateTrackingUrl(
        `${baseUrl}/pages/ToolPicker.html`, 
        'tool-finder', 
        userId || 'anonymous',
        'tool-finder-again'
      );
      
      const createSpecUrl = emailTracking.generateTrackingUrl(
        baseUrl, 
        'tool-finder', 
        userId || 'anonymous',
        'create-spec'
      );
      
      const html = emailTemplates.toolFinderUsageEmail(userName || userEmail.split('@')[0], toolFinderUrl, createSpecUrl);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'Tools Found for You',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'Tools Found for You', 'tool-finder', 'tool_finder_used', { messageId: result.id }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record tool finder email sent');
        });
      }

      logger.info({ userEmail, messageId: result.id }, '[EmailService] Tool Finder usage email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send Tool Finder usage email');
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const emailService = new EmailService();
module.exports = emailService;

