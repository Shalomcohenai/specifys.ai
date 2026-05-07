const { auth } = require('../firebase-admin');
const { createError, ERROR_CODES } = require('../error-handler');
const { requireAdmin } = require('../security');

async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

async function verifyFirebaseTokenOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = {
  verifyFirebaseToken,
  verifyFirebaseTokenOptional,
  requireAdmin
};
