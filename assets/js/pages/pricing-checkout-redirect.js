/**
 * Logged-out pricing checkout sends the visitor to auth and back to this page
 * with a product key so checkout can resume after login.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PricingCheckoutRedirect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PRODUCT_KEY = /^[a-z0-9_]+$/i;

  function buildPricingAuthUrl(productKey) {
    var key = String(productKey || '').trim();
    if (!PRODUCT_KEY.test(key)) {
      return '/pages/auth.html';
    }
    var next = '/pages/pricing.html?resumeCheckout=' + encodeURIComponent(key);
    return '/pages/auth.html?next=' + encodeURIComponent(next);
  }

  function readResumeCheckout(search) {
    var raw = search;
    if (search && typeof search.get === 'function') {
      raw = search.get('resumeCheckout');
    } else {
      var text = String(search || '');
      var params = new URLSearchParams(text.charAt(0) === '?' ? text : ('?' + text));
      raw = params.get('resumeCheckout');
    }
    if (!raw || !PRODUCT_KEY.test(raw)) {
      return null;
    }
    return raw;
  }

  return {
    buildPricingAuthUrl: buildPricingAuthUrl,
    readResumeCheckout: readResumeCheckout
  };
});
