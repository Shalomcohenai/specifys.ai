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
    return this.ADMIN_EMAILS.includes(email);
  }
};

