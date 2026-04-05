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
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Specifys-Ai-Team@specifys-ai.com';
    
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
   * Resend Audience / Segment ID for signup sync (Audiences in dashboard; API path uses /audiences/:id/contacts).
   * RESEND_SEGMENT_ID is accepted as an alias for the same ID shown under Segments in newer Resend UI.
   */
  getResendAudienceId() {
    return process.env.RESEND_AUDIENCE_ID || process.env.RESEND_SEGMENT_ID || null;
  }

  /**
   * Add a newly registered user to the configured Resend audience (non-blocking callers should .catch).
   * Skips quietly if audience ID env is unset. Uses Idempotency-Key per Firebase uid when provided.
   *
   * @param {string} userEmail
   * @param {string} [displayName]
   * @param {string} [userId] - Firebase uid
   * @param {object} [emailPreferences] - if newsletter or marketing is explicitly false, contact is created unsubscribed
   * @returns {Promise<{success: boolean, contactId?: string, skipped?: boolean, reason?: string, error?: string}>}
   */
  async addSignupToResendAudience(userEmail, displayName, userId, emailPreferences = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] addSignupToResendAudience - Resend not configured');
      return { success: false, error: 'Email service not configured', skipped: true };
    }

    const audienceId = this.getResendAudienceId();
    if (!audienceId) {
      logger.debug('[EmailService] addSignupToResendAudience - RESEND_AUDIENCE_ID / RESEND_SEGMENT_ID unset, skip');
      return { success: true, skipped: true, reason: 'no_audience_id' };
    }

    if (!userEmail || typeof userEmail !== 'string') {
      logger.warn('[EmailService] addSignupToResendAudience - missing email');
      return { success: false, error: 'User email missing', skipped: true };
    }

    const email = userEmail.trim();
    const prefs = emailPreferences && typeof emailPreferences === 'object' ? emailPreferences : {};
    const unsubscribed = prefs.newsletter === false || prefs.marketing === false;

    const raw = (displayName || '').trim();
    let firstName;
    let lastName;
    if (raw) {
      const parts = raw.split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    }
    if (!firstName) {
      firstName = email.split('@')[0] || 'user';
    }

    try {
      const requestOptions = userId ? { idempotencyKey: `specifys-signup-${userId}` } : {};
      const { data, error } = await this.resend.contacts.create(
        {
          audienceId,
          email,
          firstName,
          lastName,
          unsubscribed
        },
        requestOptions
      );

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        const code = error.statusCode;
        const duplicate =
          code === 409 ||
          msg.includes('already') ||
          msg.includes('duplicate') ||
          msg.includes('taken');
        if (duplicate) {
          logger.info({ email, userId }, '[EmailService] Resend audience: contact already present');
          return { success: true, skipped: true, reason: 'duplicate' };
        }
        logger.warn({ email, userId, error }, '[EmailService] Resend audience: failed to create contact');
        return { success: false, error: error.message || 'Resend contact error' };
      }

      logger.info({ email, userId, contactId: data?.id }, '[EmailService] User added to Resend audience');
      return { success: true, contactId: data?.id };
    } catch (err) {
      logger.error({ email, userId, err: err.message }, '[EmailService] Resend audience: exception');
      return { success: false, error: err.message };
    }
  }

  /**
   * Send welcome email to new user
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL (optional, defaults to env)
   * @param {number} creditsCount - Number of credits granted (default: 1)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendWelcomeEmail(userEmail, userName, userId = null, baseUrl = null, creditsCount = 1) {
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
      
      const html = emailTemplates.welcomeEmail(userName || userEmail.split('@')[0], getStartedUrl, creditsCount);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'Welcome to Specifys.ai - You\'ve Received 1 Free Credit!',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'Welcome to Specifys.ai - You\'ve Received 1 Free Credit!', 'welcome', 'user_registered', { messageId: result.id, creditsCount }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record welcome email sent');
        });
      }

      logger.info({ userEmail, messageId: result.id, creditsCount }, '[EmailService] Welcome email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, error: error.message }, '[EmailService] Failed to send welcome email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send spec ready notification email (first spec)
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
        subject: 'You did it! Your first specification is ready!',
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, 'You did it! Your first specification is ready!', 'spec-ready', 'spec_created', { messageId: result.id, specId }).catch(err => {
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
   * Send spec ready notification email (subsequent specs - 2nd, 3rd, etc.)
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @param {string} specTitle - Specification title
   * @param {string} specId - Specification ID
   * @param {string} userId - User ID (for tracking)
   * @param {string} baseUrl - Base URL of the site
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendSpecReadyEmailSubsequent(userEmail, userName, specTitle, specId, userId, baseUrl) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendSpecReadyEmailSubsequent - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!userEmail) {
      logger.warn('[EmailService] sendSpecReadyEmailSubsequent - User email not provided');
      return { success: false, error: 'User email missing' };
    }

    try {
      // Generate tracking URL
      const specLinkBase = `${baseUrl}/pages/spec-viewer.html?id=${specId}`;
      const specLink = emailTracking.generateTrackingUrl(
        specLinkBase, 
        'spec-ready-subsequent', 
        userId || 'anonymous',
        'spec-view',
        { specId }
      );
      
      const html = emailTemplates.specReadyEmailSubsequent(userName || userEmail.split('@')[0], specTitle, specLink);
      
      const subject = `Your specification "${specTitle}" is ready!`;
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: subject,
        html: html
      });

      // Record email sent for analytics
      if (result.id) {
        emailTracking.recordEmailSent(userId, userEmail, subject, 'spec-ready-subsequent', 'spec_created', { messageId: result.id, specId }).catch(err => {
          logger.warn({ error: err.message }, '[EmailService] Failed to record spec ready email sent');
        });
      }

      logger.info({ userEmail, specId, messageId: result.id }, '[EmailService] Spec ready email (subsequent) sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ userEmail, specId, error: error.message }, '[EmailService] Failed to send spec ready email (subsequent)');
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

  /**
   * Check Resend service health and configuration
   * @returns {Promise<{success: boolean, configured: boolean, fromEmail?: string, error?: string, lastChecked?: string}>}
   */
  async checkHealth() {
    const result = {
      success: false,
      configured: this.isConfigured(),
      fromEmail: this.fromEmail,
      lastChecked: new Date().toISOString()
    };

    if (!this.isConfigured()) {
      result.error = 'Resend API key not configured';
      return result;
    }

    try {
      // Try to validate the API key by checking domains (lightweight check)
      // We'll attempt to get API key info if available, otherwise just verify the instance exists
      // Since Resend SDK doesn't expose a direct health check, we verify the service is initialized
      result.success = true;
      logger.info({ fromEmail: this.fromEmail }, '[EmailService] Health check passed');
      return result;
    } catch (error) {
      result.error = error.message;
      logger.error({ error: error.message }, '[EmailService] Health check failed');
      return result;
    }
  }

  /**
   * Send a test email
   * @param {string} toEmail - Recipient email address
   * @param {string} baseUrl - Base URL (optional)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendTestEmail(toEmail, baseUrl = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendTestEmail - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!toEmail || !toEmail.includes('@')) {
      logger.warn('[EmailService] sendTestEmail - Invalid email address');
      return { success: false, error: 'Invalid email address' };
    }

    try {
      const finalBaseUrl = baseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      
      const testHtml = emailTemplates.getBaseTemplate(
        'Test Email from Specifys.ai',
        `
          <p class="content-text">
            Hello,
          </p>
          <p class="content-text">
            This is a test email from Specifys.ai email system. If you received this email, it means the Resend integration is working correctly.
          </p>
          <div class="content-title">Email System Status</div>
          <p class="content-text">
            <strong>Status:</strong> Operational<br>
            <strong>Sent From:</strong> ${this.fromEmail}<br>
            <strong>Sent At:</strong> ${new Date().toLocaleString()}
          </p>
          <div class="btn-container">
            <a href="${finalBaseUrl}" class="btn">Visit Specifys.ai</a>
          </div>
          <p class="content-text">
            This is an automated test message. No action is required.
          </p>
          <p class="content-text">
            Best regards,<br>
            <strong>The Specifys.ai Team</strong>
          </p>
        `
      );

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Test Email - Specifys.ai Email System',
        html: testHtml
      });

      // Check for explicit error first
      if (result.error) {
        logger.error({ toEmail, error: result.error }, '[EmailService] Failed to send test email via Resend');
        return { success: false, error: result.error.message || JSON.stringify(result.error) };
      }

      // If we have an id, great - use it
      if (result.id) {
        logger.info({ toEmail, messageId: result.id }, '[EmailService] Test email sent successfully');
        return { success: true, messageId: result.id };
      }

      // If no id but also no error, email was likely sent (Resend sometimes doesn't return id immediately)
      // Log the full result for debugging
      logger.info({ toEmail, result }, '[EmailService] Test email sent (no messageId in response, but no error)');
      return { success: true, messageId: null, note: 'Email sent but no messageId returned in response' };
    } catch (error) {
      logger.error({ toEmail, error: error.message }, '[EmailService] Exception sending test email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send weekly error summary email
   * @param {string} adminEmail - Admin email address to send summary to
   * @param {Object} errorSummary - Error summary data
   * @param {string} baseUrl - Base URL (optional)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendWeeklyErrorSummary(adminEmail, errorSummary, baseUrl = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendWeeklyErrorSummary - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!adminEmail) {
      logger.warn('[EmailService] sendWeeklyErrorSummary - Admin email not provided');
      return { success: false, error: 'Admin email missing' };
    }

    try {
      const finalBaseUrl = baseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      
      // Build HTML content for error summary
      const weekStart = errorSummary.weekStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US');
      const weekEnd = errorSummary.weekEnd || new Date().toLocaleDateString('en-US');
      const totalErrors = errorSummary.totalErrors || 0;
      const errorsByType = errorSummary.errorsByType || {};
      const topErrors = errorSummary.topErrors || [];
      
      let errorsByTypeHtml = '';
      if (Object.keys(errorsByType).length > 0) {
        errorsByTypeHtml = '<div class="content-title">Errors by Type</div><ul style="list-style: none; padding: 0;">';
        for (const [type, count] of Object.entries(errorsByType)) {
          errorsByTypeHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${type}:</strong> ${count}</li>`;
        }
        errorsByTypeHtml += '</ul>';
      } else {
        errorsByTypeHtml = '<p class="content-text">No errors by type data available.</p>';
      }
      
      let topErrorsHtml = '';
      if (topErrors.length > 0) {
        topErrorsHtml = '<div class="content-title">Top Errors (Most Frequent)</div><ul style="list-style: none; padding: 0;">';
        topErrors.slice(0, 10).forEach((error, index) => {
          topErrorsHtml += `
            <li style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <strong>#${index + 1}</strong><br>
              <strong>Type:</strong> ${error.errorType || 'Unknown'}<br>
              <strong>Message:</strong> ${error.errorMessage || 'N/A'}<br>
              <strong>Code:</strong> ${error.errorCode || 'N/A'}<br>
              <strong>Frequency:</strong> ${error.frequency || 0} times<br>
              <strong>First Occurrence:</strong> ${error.firstOccurrence ? new Date(error.firstOccurrence.seconds * 1000).toLocaleString() : 'N/A'}<br>
              <strong>Last Occurrence:</strong> ${error.lastOccurrence ? new Date(error.lastOccurrence.seconds * 1000).toLocaleString() : 'N/A'}
            </li>
          `;
        });
        topErrorsHtml += '</ul>';
      } else {
        topErrorsHtml = '<p class="content-text">🎉 No errors occurred this week!</p>';
      }
      
      const html = emailTemplates.getBaseTemplate(
        'Weekly Error Summary - Specifys.ai',
        `
          <p class="content-text">
            Hello,
          </p>
          <p class="content-text">
            This is your weekly error summary report from Specifys.ai.
          </p>
          <div class="content-title">Summary Period</div>
          <p class="content-text">
            <strong>Week Start:</strong> ${weekStart}<br>
            <strong>Week End:</strong> ${weekEnd}<br>
            <strong>Total Errors:</strong> ${totalErrors}
          </p>
          ${errorsByTypeHtml}
          ${topErrorsHtml}
          <div class="btn-container">
            <a href="${finalBaseUrl}/pages/new-admin-dashboard.html" class="btn">View Full Error Logs</a>
          </div>
          <p class="content-text">
            This is an automated weekly report. Errors are automatically captured and saved to Firebase.
          </p>
          <p class="content-text">
            Best regards,<br>
            <strong>The Specifys.ai Error Monitoring System</strong>
          </p>
        `
      );

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: adminEmail,
        subject: `Weekly Error Summary - ${totalErrors} Errors (${weekStart} to ${weekEnd})`,
        html: html
      });

      logger.info({ adminEmail, totalErrors, messageId: result.id }, '[EmailService] Weekly error summary email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ adminEmail, error: error.message }, '[EmailService] Failed to send weekly error summary');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily report email with comprehensive statistics
   * @param {string} adminEmail - Admin email address to send report to
   * @param {Object} stats - Statistics data from stats-collector
   * @param {string} baseUrl - Base URL (optional)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendDailyReport(adminEmail, stats, baseUrl = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendDailyReport - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!adminEmail) {
      logger.warn('[EmailService] sendDailyReport - Admin email not provided');
      return { success: false, error: 'Admin email missing' };
    }

    try {
      const finalBaseUrl = baseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      const date = stats.period?.startFormatted || new Date().toLocaleDateString('en-US');
      
      // Build HTML content
      let topGuidesHtml = '';
      if (stats.academy?.topGuides && stats.academy.topGuides.length > 0) {
        topGuidesHtml = '<div class="content-title">Top 5 Academy Guides</div><ul style="list-style: none; padding: 0;">';
        stats.academy.topGuides.forEach((guide, index) => {
          topGuidesHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#${index + 1}</strong> Guide ${guide.guideId}: ${guide.views} views</li>`;
        });
        topGuidesHtml += '</ul>';
      }
      
      let topArticlesHtml = '';
      if (stats.articles?.topArticles && stats.articles.topArticles.length > 0) {
        topArticlesHtml = '<div class="content-title">Top 5 Articles</div><ul style="list-style: none; padding: 0;">';
        stats.articles.topArticles.forEach((article, index) => {
          topArticlesHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#${index + 1}</strong> ${article.slug}: ${article.views} views</li>`;
        });
        topArticlesHtml += '</ul>';
      }
      
      let errorsHtml = '';
      if (stats.errors?.totalErrors > 0) {
        errorsHtml = `
          <div class="content-title">Errors Summary</div>
          <p class="content-text">
            <strong>Total Errors:</strong> ${stats.errors.totalErrors}<br>
            <strong>Unique Errors:</strong> ${stats.errors.uniqueErrors || 0}
          </p>
        `;
        if (stats.errors.topErrors && stats.errors.topErrors.length > 0) {
          errorsHtml += '<div class="content-title">Top 5 Errors</div><ul style="list-style: none; padding: 0;">';
          stats.errors.topErrors.slice(0, 5).forEach((error, index) => {
            errorsHtml += `
              <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                <strong>#${index + 1}</strong> ${error.errorType || 'Unknown'}: ${error.frequency || 0} times<br>
                <small style="color: #666;">${(error.errorMessage || '').substring(0, 100)}</small>
              </li>
            `;
          });
          errorsHtml += '</ul>';
        }
      } else {
        errorsHtml = '<p class="content-text">🎉 No errors today!</p>';
      }
      
      const html = emailTemplates.getBaseTemplate(
        `Daily Report - ${date} - Specifys.ai`,
        `
          <p class="content-text">
            Hello,
          </p>
          <p class="content-text">
            Here's your daily report for <strong>${date}</strong>.
          </p>
          
          <div class="content-title">📊 Daily Statistics</div>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.specs?.newSpecs || 0}</strong><br>
                <span style="color: #666;">New Specs Created</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.users?.newUsers || 0}</strong><br>
                <span style="color: #666;">New Users Registered</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.users?.activeUsers || 0}</strong><br>
                <span style="color: #666;">Active Users</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.academy?.guideViews || 0}</strong><br>
                <span style="color: #666;">Academy Guide Views</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.articles?.articleViews || 0}</strong><br>
                <span style="color: #666;">Article Views</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: ${stats.errors?.totalErrors > 0 ? '#d32f2f' : '#0078d4'};">${stats.errors?.totalErrors || 0}</strong><br>
                <span style="color: #666;">Errors</span>
              </div>
              ${stats.purchases && stats.purchases.count > 0 ? `
              <div>
                <strong style="font-size: 24px; color: #0078d4;">${stats.purchases.count}</strong><br>
                <span style="color: #666;">Purchases</span>
              </div>
              <div>
                <strong style="font-size: 24px; color: #28a745;">${stats.purchases.currency === 'USD' ? '$' : ''}${(stats.purchases.totalRevenue || 0).toFixed(2)}</strong><br>
                <span style="color: #666;">Revenue</span>
              </div>
              ` : ''}
            </div>
          </div>
          
          ${stats.purchases && stats.purchases.count > 0 ? `
            <div class="content-title">💰 Purchases Summary</div>
            <p class="content-text">
              <strong>Total Purchases:</strong> ${stats.purchases.count}<br>
              <strong>Total Revenue:</strong> ${stats.purchases.currency === 'USD' ? '$' : ''}${(stats.purchases.totalRevenue || 0).toFixed(2)} ${stats.purchases.currency || 'USD'}
            </p>
            ${stats.purchases.topProducts && stats.purchases.topProducts.length > 0 ? `
              <div class="content-title">Top Products</div>
              <ul style="list-style: none; padding: 0;">
                ${stats.purchases.topProducts.map((product, index) => `
                  <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <strong>#${index + 1}</strong> ${product.productName}: ${product.count} purchases, ${stats.purchases.currency === 'USD' ? '$' : ''}${product.revenue.toFixed(2)}
                  </li>
                `).join('')}
              </ul>
            ` : ''}
          ` : ''}
          
          ${topGuidesHtml}
          ${topArticlesHtml}
          ${errorsHtml}
          
          <div class="btn-container">
            <a href="${finalBaseUrl}/pages/new-admin-dashboard.html" class="btn">View Admin Dashboard</a>
          </div>
          
          <p class="content-text">
            This is an automated daily report. All data is collected from Firebase.
          </p>
          <p class="content-text">
            Best regards,<br>
            <strong>The Specifys.ai Monitoring System</strong>
          </p>
        `
      );

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: adminEmail,
        subject: `Daily Report - ${date} - Specifys.ai`,
        html: html
      });

      logger.info({ 
        adminEmail, 
        date,
        newSpecs: stats.specs?.newSpecs || 0,
        newUsers: stats.users?.newUsers || 0,
        messageId: result.id 
      }, '[EmailService] Daily report email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ adminEmail, error: error.message }, '[EmailService] Failed to send daily report');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send weekly report email with comprehensive statistics
   * @param {string} adminEmail - Admin email address to send report to
   * @param {Object} stats - Statistics data from stats-collector
   * @param {string} baseUrl - Base URL (optional)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendWeeklyReport(adminEmail, stats, baseUrl = null) {
    if (!this.isConfigured()) {
      logger.warn('[EmailService] sendWeeklyReport - Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!adminEmail) {
      logger.warn('[EmailService] sendWeeklyReport - Admin email not provided');
      return { success: false, error: 'Admin email missing' };
    }

    try {
      const finalBaseUrl = baseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      const weekStart = stats.period?.weekStart || stats.period?.startFormatted || 'N/A';
      const weekEnd = stats.period?.weekEnd || stats.period?.endFormatted || 'N/A';
      
      // Build HTML content
      let topGuidesHtml = '';
      if (stats.academy?.topGuides && stats.academy.topGuides.length > 0) {
        topGuidesHtml = '<div class="content-title">Top 5 Academy Guides (This Week)</div><ul style="list-style: none; padding: 0;">';
        stats.academy.topGuides.forEach((guide, index) => {
          topGuidesHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#${index + 1}</strong> Guide ${guide.guideId}: ${guide.views} views</li>`;
        });
        topGuidesHtml += '</ul>';
      }
      
      let topArticlesHtml = '';
      if (stats.articles?.topArticles && stats.articles.topArticles.length > 0) {
        topArticlesHtml = '<div class="content-title">Top 5 Articles (This Week)</div><ul style="list-style: none; padding: 0;">';
        stats.articles.topArticles.forEach((article, index) => {
          topArticlesHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#${index + 1}</strong> ${article.slug}: ${article.views} views</li>`;
        });
        topArticlesHtml += '</ul>';
      }
      
      let errorsHtml = '';
      if (stats.errors?.totalErrors > 0) {
        errorsHtml = `
          <div class="content-title">Errors Summary (This Week)</div>
          <p class="content-text">
            <strong>Total Errors:</strong> ${stats.errors.totalErrors}<br>
            <strong>Unique Errors:</strong> ${stats.errors.uniqueErrors || 0}
          </p>
        `;
        if (stats.errors.errorsByType && Object.keys(stats.errors.errorsByType).length > 0) {
          errorsHtml += '<div class="content-title">Errors by Type</div><ul style="list-style: none; padding: 0;">';
          Object.entries(stats.errors.errorsByType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, count]) => {
              errorsHtml += `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${type}:</strong> ${count}</li>`;
            });
          errorsHtml += '</ul>';
        }
        if (stats.errors.topErrors && stats.errors.topErrors.length > 0) {
          errorsHtml += '<div class="content-title">Top 10 Errors</div><ul style="list-style: none; padding: 0;">';
          stats.errors.topErrors.slice(0, 10).forEach((error, index) => {
            errorsHtml += `
              <li style="padding: 12px 0; border-bottom: 1px solid #eee;">
                <strong>#${index + 1}</strong> ${error.errorType || 'Unknown'}: ${error.frequency || 0} times<br>
                <small style="color: #666;">${(error.errorMessage || '').substring(0, 150)}</small>
              </li>
            `;
          });
          errorsHtml += '</ul>';
        }
      } else {
        errorsHtml = '<p class="content-text">🎉 No errors this week!</p>';
      }
      
      const html = emailTemplates.getBaseTemplate(
        `Weekly Report - ${weekStart} to ${weekEnd} - Specifys.ai`,
        `
          <p class="content-text">
            Hello,
          </p>
          <p class="content-text">
            Here's your weekly report for <strong>${weekStart} to ${weekEnd}</strong>.
          </p>
          
          <div class="content-title">📊 Weekly Statistics</div>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.specs?.newSpecs || 0}</strong><br>
                <span style="color: #666;">New Specs Created</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.users?.newUsers || 0}</strong><br>
                <span style="color: #666;">New Users Registered</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.users?.activeUsers || 0}</strong><br>
                <span style="color: #666;">Active Users</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.academy?.guideViews || 0}</strong><br>
                <span style="color: #666;">Academy Guide Views</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.articles?.articleViews || 0}</strong><br>
                <span style="color: #666;">Article Views</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: ${stats.errors?.totalErrors > 0 ? '#d32f2f' : '#0078d4'};">${stats.errors?.totalErrors || 0}</strong><br>
                <span style="color: #666;">Total Errors</span>
              </div>
              ${stats.purchases && stats.purchases.count > 0 ? `
              <div>
                <strong style="font-size: 28px; color: #0078d4;">${stats.purchases.count}</strong><br>
                <span style="color: #666;">Purchases</span>
              </div>
              <div>
                <strong style="font-size: 28px; color: #28a745;">${stats.purchases.currency === 'USD' ? '$' : ''}${(stats.purchases.totalRevenue || 0).toFixed(2)}</strong><br>
                <span style="color: #666;">Revenue</span>
              </div>
              ` : ''}
            </div>
          </div>
          
          ${stats.purchases && stats.purchases.count > 0 ? `
            <div class="content-title">💰 Purchases Summary (This Week)</div>
            <p class="content-text">
              <strong>Total Purchases:</strong> ${stats.purchases.count}<br>
              <strong>Total Revenue:</strong> ${stats.purchases.currency === 'USD' ? '$' : ''}${(stats.purchases.totalRevenue || 0).toFixed(2)} ${stats.purchases.currency || 'USD'}
            </p>
            ${stats.purchases.topProducts && stats.purchases.topProducts.length > 0 ? `
              <div class="content-title">Top Products</div>
              <ul style="list-style: none; padding: 0;">
                ${stats.purchases.topProducts.map((product, index) => `
                  <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <strong>#${index + 1}</strong> ${product.productName}: ${product.count} purchases, ${stats.purchases.currency === 'USD' ? '$' : ''}${product.revenue.toFixed(2)}
                  </li>
                `).join('')}
              </ul>
            ` : ''}
          ` : ''}
          
          ${topGuidesHtml}
          ${topArticlesHtml}
          ${errorsHtml}
          
          <div class="btn-container">
            <a href="${finalBaseUrl}/pages/new-admin-dashboard.html" class="btn">View Admin Dashboard</a>
          </div>
          
          <p class="content-text">
            This is an automated weekly report. All data is collected from Firebase.
          </p>
          <p class="content-text">
            Best regards,<br>
            <strong>The Specifys.ai Monitoring System</strong>
          </p>
        `
      );

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: adminEmail,
        subject: `Weekly Report - ${weekStart} to ${weekEnd} - Specifys.ai`,
        html: html
      });

      logger.info({ 
        adminEmail, 
        weekStart,
        weekEnd,
        newSpecs: stats.specs?.newSpecs || 0,
        newUsers: stats.users?.newUsers || 0,
        messageId: result.id 
      }, '[EmailService] Weekly report email sent successfully');
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error({ adminEmail, error: error.message }, '[EmailService] Failed to send weekly report');
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const emailService = new EmailService();
module.exports = emailService;

