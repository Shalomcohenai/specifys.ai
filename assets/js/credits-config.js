/**
 * Credits System Configuration - Specifys.ai
 * Central configuration for credits system behavior
 */

window.CREDITS_CONFIG = {
  // Set to false to disable Pro default for new users
  // When false, new users will get free plan with 1 free spec
  DEFAULT_PRO_FOR_NEW_USERS: true,
  
  // Set to true to enable payment system integration (Lemon Squeezy, etc.)
  // When false, payment providers will not grant credits automatically
  ENABLE_PAYMENT_SYSTEM: false
};

