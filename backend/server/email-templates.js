/**
 * Email Templates for Specifys.ai
 * All templates use modern HTML/CSS and are responsive
 */

/**
 * Base template wrapper with common styles and structure
 */
function getBaseTemplate(headerTitle, bodyContent, showUnsubscribe = false, unsubscribeUrl = null) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Specifys.ai</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: #FF6B35;
      padding: 40px 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .logo {
      font-family: 'Montserrat', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 20px;
      letter-spacing: -0.5px;
    }
    .logo-dot {
      color: #ffffff;
    }
    .logo-text {
      color: #ffffff;
    }
    .email-header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      font-family: 'Montserrat', sans-serif;
    }
    .email-body {
      padding: 40px;
      background-color: #ffffff;
    }
    .email-footer {
      padding: 30px 40px;
      background-color: #f5f5f5;
      border-top: 1px solid #dee2e6;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-radius: 0 0 10px 10px;
    }
    .email-footer a {
      color: #FF6B35;
      text-decoration: none;
    }
    .email-footer a:hover {
      color: #FF8551;
    }
    .btn {
      display: inline-block;
      background: #FF6B35;
      color: #ffffff !important;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
      margin: 20px 0;
      font-family: 'Montserrat', sans-serif;
      transition: background 0.3s ease;
    }
    .btn:hover {
      background: #FF8551;
    }
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .content-text {
      color: #333;
      font-size: 16px;
      line-height: 1.6;
      margin: 20px 0;
      font-family: 'Montserrat', sans-serif;
    }
    .content-title {
      color: #333;
      font-size: 18px;
      font-weight: 600;
      margin: 20px 0 10px 0;
      font-family: 'Montserrat', sans-serif;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 20px;
      }
      .email-header {
        padding: 30px 20px;
      }
      .logo {
        font-size: 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .btn {
        padding: 12px 30px;
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="logo">
        <span class="logo-text">Specifys<span class="logo-dot">.</span>AI</span>
      </div>
      ${headerTitle ? `<h1>${headerTitle}</h1>` : ''}
    </div>
    <div class="email-body">
      ${bodyContent}
    </div>
    <div class="email-footer">
      <p>This email was sent by <a href="https://specifys-ai.com">Specifys.ai</a></p>
      ${showUnsubscribe && unsubscribeUrl ? `
      <p style="margin-top: 15px;">
        <a href="${unsubscribeUrl}">Unsubscribe from emails</a>
      </p>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Welcome email template for new users
 */
function welcomeEmail(userName, getStartedUrl, creditsCount = 1) {
  const headerTitle = 'Welcome to Specifys.ai';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        We're thrilled to have you join Specifys.ai! You're now part of a community that's building the future of app development with AI-powered specifications.
      </p>
      <div style="background: #FFF4E6; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 8px;">
        <div class="content-title" style="color: #F59E0B; margin-top: 0;">🎉 You've Received ${creditsCount} Free Credit${creditsCount !== 1 ? 's' : ''}!</div>
        <p class="content-text" style="margin: 10px 0;">
          As a welcome gift, we've added <strong>${creditsCount} specification credit${creditsCount !== 1 ? 's' : ''}</strong> to your account. You can use ${creditsCount === 1 ? 'it' : 'them'} to create your first comprehensive app specification right away!
        </p>
        <p class="content-text" style="margin: 10px 0;">
          Our AI will help you build detailed specifications including technical requirements, market research, and design guidelines.
        </p>
      </div>
      <div class="content-title">What's Next?</div>
      <p class="content-text">
        You can start creating your first specification right away. Our AI will help you build comprehensive app specifications including technical requirements, market research, and design guidelines.
      </p>
      <div class="btn-container">
        <a href="${getStartedUrl || 'https://specifys-ai.com'}" class="btn">Get Started</a>
      </div>
      <p class="content-text">
        If you have any questions, feel free to reach out to us. We're here to help!
      </p>
      <p class="content-text">
        Happy building,<br>
        <strong>The Specifys.ai Team</strong>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

/**
 * Spec ready email template (first spec)
 */
function specReadyEmail(userName, specTitle, specLink) {
  const headerTitle = 'You did it! Your first specification is ready!';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        Your specification is ready! You can always access it to view and upgrade it.
      </p>
      <div class="btn-container">
        <a href="${specLink}" class="btn">View Your Specification</a>
      </div>
      <p class="content-text" style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${specLink}" style="color: #FF6B35; word-break: break-all;">${specLink}</a>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

/**
 * Spec ready email template (subsequent specs - 2nd, 3rd, etc.)
 */
function specReadyEmailSubsequent(userName, specTitle, specLink) {
  const headerTitle = 'Your specification is ready!';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        Great news! Your specification <strong>"${specTitle}"</strong> is ready and waiting for you.
      </p>
      <div class="btn-container">
        <a href="${specLink}" class="btn">View Your Specification</a>
      </div>
      <p class="content-text" style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${specLink}" style="color: #FF6B35; word-break: break-all;">${specLink}</a>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

/**
 * Newsletter email template
 */
function newsletterEmail(userName, newsletterContent, unsubscribeUrl) {
  const headerTitle = 'Specifys.ai Newsletter';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      ${newsletterContent}
  `;
  return getBaseTemplate(headerTitle, bodyContent, true, unsubscribeUrl);
}

/**
 * Generic notification email template
 */
function notificationEmail(content) {
  const headerTitle = '';
  return getBaseTemplate(headerTitle, content);
}

/**
 * Inactive user email template (after 30 days)
 */
function inactiveUserEmail(userName, returnUrl, baseUrl) {
  const headerTitle = 'We Miss You';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        It's been a while since you last visited Specifys.ai. We wanted to check in and see if there's anything we can help you with.
      </p>
      <div class="content-title">Continue Your Journey</div>
      <p class="content-text">
        Whether you're ready to create your first app specification or you have questions about our tools, we're here to help you bring your ideas to life.
      </p>
      <div class="btn-container">
        <a href="${returnUrl}" class="btn">Return to Specifys.ai</a>
      </div>
      <p class="content-text">
        If you need any assistance, don't hesitate to reach out!
      </p>
      <p class="content-text">
        Best regards,<br>
        <strong>The Specifys.ai Team</strong>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent, true, `${baseUrl}/pages/profile.html?action=unsubscribe`);
}

/**
 * Purchase confirmation email template
 */
function purchaseConfirmationEmail(userName, productName, amount, currency, orderId, accountUrl) {
  const headerTitle = 'Thank You for Your Purchase';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        Thank you for your purchase! Your order has been confirmed and your credits have been added to your account.
      </p>
      <div class="content-title">Order Details</div>
      <p class="content-text">
        <strong>Product:</strong> ${productName}<br>
        <strong>Amount:</strong> ${amount} ${currency}<br>
        <strong>Order ID:</strong> ${orderId}
      </p>
      <div class="btn-container">
        <a href="${accountUrl}" class="btn">View Your Account</a>
      </div>
      <p class="content-text">
        You can now start creating specifications with your new credits. Happy building!
      </p>
      <p class="content-text">
        Best regards,<br>
        <strong>The Specifys.ai Team</strong>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

/**
 * Advanced spec ready email template
 */
function advancedSpecReadyEmail(userName, specTitle, specLink) {
  const headerTitle = 'Your Advanced Specification is Ready';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        Great news! Your advanced specification <strong>"${specTitle}"</strong> is ready! This comprehensive specification includes technical requirements, market research, and design guidelines.
      </p>
      <div class="btn-container">
        <a href="${specLink}" class="btn">View Your Advanced Specification</a>
      </div>
      <p class="content-text" style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${specLink}" style="color: #FF6B35; word-break: break-all;">${specLink}</a>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

/**
 * Tool Finder usage email template
 */
function toolFinderUsageEmail(userName, toolFinderUrl, createSpecUrl) {
  const headerTitle = 'Tools Found for You';
  const bodyContent = `
      <p class="content-text">
        Hello ${userName},
      </p>
      <p class="content-text">
        We noticed you used our Tool Finder. We hope it helped you discover the perfect tools for your project!
      </p>
      <div class="content-title">Continue Exploring</div>
      <p class="content-text">
        Ready to plan your app? Create a comprehensive specification with Specifys.ai to bring your idea to life!
      </p>
      <div class="btn-container">
        <a href="${toolFinderUrl}" class="btn" style="margin-right: 10px;">Use Tool Finder Again</a>
        <a href="${createSpecUrl}" class="btn">Create a Specification</a>
      </div>
      <p class="content-text">
        If you have any questions or need help choosing the right tools, feel free to reach out!
      </p>
      <p class="content-text">
        Best regards,<br>
        <strong>The Specifys.ai Team</strong>
      </p>
  `;
  return getBaseTemplate(headerTitle, bodyContent);
}

module.exports = {
  getBaseTemplate,
  welcomeEmail,
  specReadyEmail,
  specReadyEmailSubsequent,
  advancedSpecReadyEmail,
  newsletterEmail,
  notificationEmail,
  inactiveUserEmail,
  purchaseConfirmationEmail,
  toolFinderUsageEmail
};

