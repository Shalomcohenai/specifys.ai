const geoip = require('geoip-lite');

function resolveLocale(req) {
  const acceptLanguage = req.get('accept-language') || '';
  const first = acceptLanguage.split(',')[0] || 'en';
  return first.trim() || 'en';
}

function geoMiddleware(req, res, next) {
  const headerCountry = (req.get('cf-ipcountry') || '').toUpperCase();
  if (headerCountry) {
    req.geo = { country: headerCountry, region: null, locale: resolveLocale(req), source: 'cf-ipcountry' };
    return next();
  }

  const lookup = geoip.lookup(req.ip);
  if (lookup) {
    req.geo = {
      country: (lookup.country || '').toUpperCase() || 'US',
      region: lookup.region || null,
      locale: resolveLocale(req),
      source: 'geoip-lite'
    };
    return next();
  }

  req.geo = { country: 'US', region: null, locale: resolveLocale(req), source: 'fallback' };
  next();
}

module.exports = { geoMiddleware };
