const REQUIRED_ENV = [
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_WEBHOOK_SECRET'
];

function hasFirebaseCredentials() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (process.env.FIREBASE_SA_PROJECT_ID && process.env.FIREBASE_SA_PRIVATE_KEY && process.env.FIREBASE_SA_CLIENT_EMAIL)
  );
}

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (!hasFirebaseCredentials()) {
    missing.push('FIREBASE_SERVICE_ACCOUNT or FIREBASE_SA_*');
  }

  if (missing.length === 0) return;
  const msg = `Missing required environment variables: ${missing.join(', ')}`;
  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error(msg);
  }
  console.warn(msg);
}

module.exports = { assertEnv };
