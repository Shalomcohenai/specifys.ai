#!/usr/bin/env node

/**
 * Test script to directly test the Cloudflare Worker
 * Usage: node backend/test-worker.js
 */

const fetch = typeof globalThis.fetch === 'function' 
  ? globalThis.fetch 
  : require('node-fetch');

const WORKER_URL = 'https://spspec.shalom-cohen-111.workers.dev/generate';

async function testWorker() {
  console.log('🧪 Testing Cloudflare Worker directly...\n');
  console.log('=' .repeat(60));
  
  const testPayload = {
    stage: 'overview',
    locale: 'en-US',
    prompt: {
      system: 'You are an expert application specification generator. Generate detailed, comprehensive specifications based on user requirements.',
      developer: 'Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. Follow the exact structure specified in the user prompt.',
      user: 'Create a simple task management app for teams'
    }
  };

  console.log('📤 Sending request to Worker:');
  console.log('URL:', WORKER_URL);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  console.log('='.repeat(60));
  console.log('');

  try {
    const startTime = Date.now();
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const requestTime = Date.now() - startTime;
    
    console.log('📥 Response received:');
    console.log('Status:', response.status, response.statusText);
    console.log('Time:', requestTime + 'ms');
    console.log('Headers:', {
      'content-type': response.headers.get('content-type'),
      'cf-ray': response.headers.get('cf-ray'),
      'cf-request-id': response.headers.get('cf-request-id')
    });
    console.log('');

    // Read response body
    const responseText = await response.text();
    console.log('📄 Response Body (first 1000 chars):');
    console.log(responseText.substring(0, 1000));
    console.log('');

    try {
      const responseJson = JSON.parse(responseText);
      console.log('✅ Parsed JSON:');
      console.log(JSON.stringify(responseJson, null, 2));
      
      if (responseJson.error) {
        console.log('\n❌ Worker returned error:');
        console.log('  Code:', responseJson.error.code);
        console.log('  Message:', responseJson.error.message);
        if (responseJson.error.issues) {
          console.log('  Issues:', responseJson.error.issues);
        }
        if (responseJson.correlationId) {
          console.log('  Correlation ID:', responseJson.correlationId);
        }
      } else if (responseJson.overview) {
        console.log('\n✅ Worker returned overview successfully!');
        console.log('  Has overview:', !!responseJson.overview);
        console.log('  Has meta:', !!responseJson.meta);
        console.log('  Correlation ID:', responseJson.correlationId || 'N/A');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse response as JSON:', parseError.message);
    }

  } catch (error) {
    console.error('❌ Error testing Worker:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run test
testWorker().catch(console.error);

