// Test script to verify server configuration
const config = require('./config');

console.log('🔧 Testing Specifys.ai server configuration...\n');

console.log('✅ Configuration loaded successfully');
console.log(`📡 Port: ${config.port}`);
console.log(`🔗 Google Apps Script URL: ${config.googleAppsScriptUrl}`);
console.log(`🌐 Production Server URL: ${config.productionServerUrl}`);
console.log(`🔒 Allowed Origins: ${config.allowedOrigins.join(', ')}`);

console.log('\n✅ Configuration test completed successfully!');
console.log('🚀 You can now start the server with: node server.js');
