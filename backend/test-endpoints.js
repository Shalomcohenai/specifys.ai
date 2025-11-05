/**
 * Comprehensive Endpoint Testing Script
 * Tests all critical endpoints to ensure they work correctly
 */

const fetch = typeof globalThis.fetch === 'function' 
  ? globalThis.fetch 
  : require('node-fetch');

const BASE_URL = process.env.TEST_BASE_URL || 'https://specifys-ai.onrender.com';

// Test colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.blue}=== ${title} ===${colors.reset}`);
}

async function testEndpoint(name, method, path, body = null, expectedStatus = 200) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const statusMatch = response.status === expectedStatus;
    
    if (statusMatch) {
      log(`✅ ${name}: PASS (${response.status})`, 'green');
      return { success: true, status: response.status, response };
    } else {
      log(`❌ ${name}: FAIL - Expected ${expectedStatus}, got ${response.status}`, 'red');
      const text = await response.text();
      log(`   Response: ${text.substring(0, 200)}`, 'yellow');
      return { success: false, status: response.status, response };
    }
  } catch (error) {
    log(`❌ ${name}: ERROR - ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  logSection('Starting Comprehensive Endpoint Tests');
  log(`Testing against: ${BASE_URL}\n`);

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test 1: Server Status
  logSection('1. Server Status');
  const statusTest = await testEndpoint('GET /api/status', 'GET', '/api/status');
  results.total++;
  if (statusTest.success) results.passed++; else results.failed++;

  // Test 2: Generate Spec - Basic validation
  logSection('2. Generate Spec Endpoint');
  const generateTest1 = await testEndpoint(
    'POST /api/generate-spec (missing userInput)',
    'POST',
    '/api/generate-spec',
    {},
    400
  );
  results.total++;
  if (generateTest1.success) results.passed++; else results.failed++;

  // Test 3: Generate Spec - With valid input
  logSection('3. Generate Spec with Valid Input');
  const generateTest2 = await testEndpoint(
    'POST /api/generate-spec (with userInput)',
    'POST',
    '/api/generate-spec',
    {
      userInput: 'Test app: A simple todo list application for managing daily tasks'
    },
    200
  );
  results.total++;
  if (generateTest2.success) {
    results.passed++;
    try {
      const data = await generateTest2.response.json();
      if (data.specification) {
        log(`   ✅ Response contains specification field`, 'green');
        log(`   ✅ Specification length: ${data.specification.length} chars`, 'green');
      } else {
        log(`   ⚠️  Response missing specification field`, 'yellow');
        log(`   Response keys: ${Object.keys(data).join(', ')}`, 'yellow');
      }
    } catch (e) {
      log(`   ⚠️  Could not parse response JSON: ${e.message}`, 'yellow');
    }
  } else {
    results.failed++;
  }

  // Test 4: CORS Headers
  logSection('4. CORS Configuration');
  const corsTest = await fetch(`${BASE_URL}/api/status`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://specifys-ai.com',
      'Access-Control-Request-Method': 'POST'
    }
  });
  results.total++;
  if (corsTest.status === 200) {
    log(`✅ CORS Preflight: PASS`, 'green');
    results.passed++;
  } else {
    log(`❌ CORS Preflight: FAIL (${corsTest.status})`, 'red');
    results.failed++;
  }

  // Test 5: Rate Limiting (should not block first request)
  logSection('5. Rate Limiting');
  const rateLimitTest = await testEndpoint(
    'POST /api/generate-spec (rate limit check)',
    'POST',
    '/api/generate-spec',
    {
      userInput: 'Test rate limiting'
    },
    200
  );
  results.total++;
  if (rateLimitTest.success) results.passed++; else results.failed++;

  // Test 6: Error Handling
  logSection('6. Error Handling');
  const errorTest = await testEndpoint(
    'POST /api/generate-spec (empty body)',
    'POST',
    '/api/generate-spec',
    null,
    400
  );
  results.total++;
  if (errorTest.success) results.passed++; else results.failed++;

  // Summary
  logSection('Test Summary');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
      results.passed === results.total ? 'green' : 'yellow');

  if (results.failed > 0) {
    log(`\n⚠️  Some tests failed. Please review the errors above.`, 'yellow');
    process.exit(1);
  } else {
    log(`\n✅ All tests passed!`, 'green');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test suite crashed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

