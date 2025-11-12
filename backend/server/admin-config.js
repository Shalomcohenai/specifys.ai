/**
 * Admin Configuration
 * Centralized admin email list
 */

const ADMIN_EMAILS = [
  'specifysai@gmail.com',
  'admin@specifys.ai',
  'shalom@specifys.ai'
];

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

module.exports = {
  ADMIN_EMAILS,
  isAdminEmail
};

