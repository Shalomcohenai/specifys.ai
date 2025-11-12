/**
 * Admin Configuration
 * Centralized admin email list
 */

module.exports = {
  ADMIN_EMAILS: [
    'specifysai@gmail.com',
    'admin@specifys.ai',
    'shalom@specifys.ai'
  ],

  isAdminEmail(email) {
    if (!email) return false;
    return this.ADMIN_EMAILS.includes(email.toLowerCase());
  }
};

