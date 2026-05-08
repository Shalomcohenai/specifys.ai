const REQUIRED_ENV = [
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'LEMON_SQUEEZY_API_KEY'
];

function hasFirebaseCredentials() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE ||
    (process.env.FIREBASE_SA_PROJECT_ID && process.env.FIREBASE_SA_PRIVATE_KEY && process.env.FIREBASE_SA_CLIENT_EMAIL)
  );
}

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  const warnings = [];
  if (!process.env.LEMON_SQUEEZY_WEBHOOK_SECRET) warnings.push('LEMON_SQUEEZY_WEBHOOK_SECRET');
  if (!hasFirebaseCredentials()) warnings.push('FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_SERVICE_ACCOUNT_KEY_FILE (or FIREBASE_SA_*)');

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if ((process.env.NODE_ENV || 'development') === 'production') {
      throw new Error(msg);
    }
    console.warn(msg);
  }

  if (warnings.length > 0) {
    console.warn(`Missing optional environment variables (features may be limited): ${warnings.join(', ')}`);
  }
}

module.exports = { assertEnv };
