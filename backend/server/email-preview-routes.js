const express = require('express');
const router = express.Router();
const emailTemplates = require('./email-templates');

/**
 * Email Preview Routes
 * Preview email templates in browser
 * GET /api/email/preview/:template
 */

// Helper function to generate preview data
function getPreviewData(template) {
  const baseUrl = 'https://specifys-ai.com';
  
  switch (template) {
    case 'welcome':
      return emailTemplates.welcomeEmail('John Doe', `${baseUrl}?utm_source=email&utm_medium=email&utm_campaign=welcome`);
    
    case 'spec-ready':
      return emailTemplates.specReadyEmail(
        'John Doe',
        'My Amazing App',
        `${baseUrl}/pages/spec-viewer.html?id=preview-123&utm_source=email&utm_medium=email&utm_campaign=spec-ready`
      );
    
    case 'advanced-spec-ready':
      return emailTemplates.advancedSpecReadyEmail(
        'John Doe',
        'My Advanced App Specification',
        `${baseUrl}/pages/spec-viewer.html?id=preview-advanced-123&utm_source=email&utm_medium=email&utm_campaign=advanced-spec-ready`
      );
    
    case 'inactive-user':
      return emailTemplates.inactiveUserEmail(
        'John Doe',
        `${baseUrl}?utm_source=email&utm_medium=email&utm_campaign=inactive-user`,
        baseUrl
      );
    
    case 'purchase-confirmation':
      return emailTemplates.purchaseConfirmationEmail(
        'John Doe',
        '5 Spec Credits Pack',
        '49.00',
        'USD',
        'ORDER-12345',
        `${baseUrl}/pages/profile.html?utm_source=email&utm_medium=email&utm_campaign=purchase-confirmation`
      );
    
    case 'tool-finder':
      return emailTemplates.toolFinderUsageEmail(
        'John Doe',
        `${baseUrl}/pages/ToolPicker.html?utm_source=email&utm_medium=email&utm_campaign=tool-finder`,
        `${baseUrl}?utm_source=email&utm_medium=email&utm_campaign=tool-finder`
      );
    
    case 'newsletter':
      return emailTemplates.newsletterEmail(
        'John Doe',
        `
          <div class="content-title">What's New This Week</div>
          <p class="content-text">
            We've added amazing new features to help you build better apps!
          </p>
          <ul style="color: #333; font-size: 16px; line-height: 1.8; font-family: 'Inter', sans-serif;">
            <li>New AI-powered tool recommendations</li>
            <li>Enhanced specification templates</li>
            <li>Improved market research insights</li>
          </ul>
          <div class="btn-container">
            <a href="${baseUrl}" class="btn">Explore New Features</a>
          </div>
        `,
        `${baseUrl}/pages/profile.html?action=unsubscribe`
      );
    
    default:
      return null;
  }
}

/**
 * GET /api/email/preview/:template
 * Preview email template
 */
router.get('/preview/:template', (req, res) => {
  const { template } = req.params;
  
  const html = getPreviewData(template);
  
  if (!html) {
    return res.status(404).json({
      error: 'Template not found',
      availableTemplates: [
        'welcome',
        'spec-ready',
        'advanced-spec-ready',
        'inactive-user',
        'purchase-confirmation',
        'tool-finder',
        'newsletter'
      ]
    });
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * GET /api/email/preview
 * List all available templates
 */
router.get('/preview', (req, res) => {
  res.json({
    availableTemplates: [
      {
        name: 'welcome',
        description: 'Welcome email for new users',
        url: '/api/email/preview/welcome'
      },
      {
        name: 'spec-ready',
        description: 'Email when a regular spec is ready',
        url: '/api/email/preview/spec-ready'
      },
      {
        name: 'advanced-spec-ready',
        description: 'Email when an advanced spec is ready',
        url: '/api/email/preview/advanced-spec-ready'
      },
      {
        name: 'inactive-user',
        description: 'Email to inactive users (30 days)',
        url: '/api/email/preview/inactive-user'
      },
      {
        name: 'purchase-confirmation',
        description: 'Email after purchase confirmation',
        url: '/api/email/preview/purchase-confirmation'
      },
      {
        name: 'tool-finder',
        description: 'Email after using Tool Finder',
        url: '/api/email/preview/tool-finder'
      },
      {
        name: 'newsletter',
        description: 'Newsletter email template',
        url: '/api/email/preview/newsletter'
      }
    ],
    usage: 'Visit /api/email/preview/:template to see a specific template'
  });
});

module.exports = router;

