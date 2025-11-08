const fs = require('fs');
const path = require('path');

let cachedConfig = null;
let lastLoadedAt = 0;

const CONFIG_RELATIVE_PATH = '../../assets/data/lemon-products.json';
const RELOAD_INTERVAL_MS = 60 * 1000;

function loadConfig(force = false) {
  const now = Date.now();

  if (!force && cachedConfig && now - lastLoadedAt < RELOAD_INTERVAL_MS) {
    return cachedConfig;
  }

  const filePath = path.resolve(__dirname, CONFIG_RELATIVE_PATH);

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    cachedConfig = JSON.parse(fileContents);
    lastLoadedAt = now;
    return cachedConfig;
  } catch (error) {
    console.error('Failed to load Lemon products configuration:', {
      filePath,
      message: error.message
    });
    cachedConfig = { products: {} };
    return cachedConfig;
  }
}

function getProductsConfig() {
  const config = loadConfig();
  return config.products || {};
}

function getProductByKey(productKey) {
  if (!productKey) {
    return null;
  }
  const products = getProductsConfig();
  return products[productKey] || null;
}

function getProductKeyByVariantId(variantId) {
  if (!variantId) {
    return null;
  }
  const products = getProductsConfig();
  const entry = Object.entries(products).find(([, value]) => value.variant_id?.toString() === variantId.toString());
  return entry ? entry[0] : null;
}

function getProductByVariantId(variantId) {
  const key = getProductKeyByVariantId(variantId);
  if (!key) {
    return null;
  }
  return getProductByKey(key);
}

module.exports = {
  loadConfig,
  getProductsConfig,
  getProductByKey,
  getProductByVariantId,
  getProductKeyByVariantId
};

