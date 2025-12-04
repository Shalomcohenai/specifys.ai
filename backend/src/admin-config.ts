/**
 * Admin Configuration
 * Centralized admin email list
 */

export const ADMIN_EMAILS: string[] = [
  'specifysai@gmail.com',
  'admin@specifys.ai',
  'shalom@specifys.ai'
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}


