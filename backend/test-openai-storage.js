/**
 * Comprehensive OpenAI Storage Service Testing Script
 * Tests all OpenAI storage operations to ensure they work correctly
 */

require('dotenv').config();

const OpenAIStorageService = require('./server/openai-storage-service');

// Test colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.blue}=== ${title} ===${colors.reset}`);
}

function logSubsection(title) {
  console.log(`\n${colors.cyan}--- ${title} ---${colors.reset}`);
}

async function testOpenAIStorage() {
  logSection('OpenAI Storage Service Test Suite');
  
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    log('❌ OPENAI_API_KEY not found in environment variables', 'red');
    log('   Please set OPENAI_API_KEY in your .env file', 'yellow');
    process.exit(1);
  }
  
  log(`✅ OpenAI API Key configured: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`);
  
  const openaiStorage = new OpenAIStorageService(process.env.OPENAI_API_KEY);
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    warnings: 0
  };
  
  // Test data
  const testSpecId = `test-spec-${Date.now()}`;
  const testSpecData = {
    title: 'Test Application Specification',
    overview: {
      description: 'This is a test application for OpenAI storage testing',
      purpose: 'Testing OpenAI storage functionality',
      targetAudience: 'Developers and testers'
    },
    technical: {
      stack: ['Node.js', 'Express', 'Firebase'],
      architecture: 'RESTful API',
      database: 'Firestore'
    },
    market: {
      competitors: ['App1', 'App2'],
      uniqueValue: 'Testing capabilities'
    },
    design: {
      theme: 'Modern',
      colors: ['#000000', '#FFFFFF']
    }
  };
  
  let uploadedFileId = null;
  let createdAssistantId = null;
  let createdThreadId = null;
  
  try {
    // Test 1: Upload Spec
    logSection('Test 1: Upload Spec to OpenAI');
    try {
      logSubsection('Uploading test spec...');
      const uploadStart = Date.now();
      uploadedFileId = await openaiStorage.uploadSpec(testSpecId, testSpecData);
      const uploadTime = Date.now() - uploadStart;
      
      if (uploadedFileId) {
        log(`✅ Upload Spec: PASS (${uploadTime}ms)`, 'green');
        log(`   File ID: ${uploadedFileId}`, 'cyan');
        results.passed++;
      } else {
        log(`❌ Upload Spec: FAIL - No file ID returned`, 'red');
        results.failed++;
      }
      results.total++;
    } catch (error) {
      log(`❌ Upload Spec: ERROR - ${error.message}`, 'red');
      log(`   Stack: ${error.stack}`, 'yellow');
      results.failed++;
      results.total++;
    }
    
    // Test 2: Get File Info
    if (uploadedFileId) {
      logSection('Test 2: Get File Info');
      try {
        logSubsection('Retrieving file info...');
        const fileInfoStart = Date.now();
        const fileInfo = await openaiStorage.getFileInfo(uploadedFileId);
        const fileInfoTime = Date.now() - fileInfoStart;
        
        if (fileInfo && fileInfo.id === uploadedFileId) {
          log(`✅ Get File Info: PASS (${fileInfoTime}ms)`, 'green');
          log(`   File: ${fileInfo.filename || 'N/A'}, Bytes: ${fileInfo.bytes || 'N/A'}`, 'cyan');
          results.passed++;
        } else {
          log(`❌ Get File Info: FAIL - Invalid file info`, 'red');
          results.failed++;
        }
        results.total++;
      } catch (error) {
        log(`❌ Get File Info: ERROR - ${error.message}`, 'red');
        results.failed++;
        results.total++;
      }
    } else {
      log(`⚠️  Skipping Get File Info test (no file ID)`, 'yellow');
      results.warnings++;
    }
    
    // Test 3: Create Assistant
    if (uploadedFileId) {
      logSection('Test 3: Create Assistant');
      try {
        logSubsection('Creating assistant...');
        const assistantStart = Date.now();
        const assistant = await openaiStorage.createAssistant(testSpecId, uploadedFileId);
        const assistantTime = Date.now() - assistantStart;
        createdAssistantId = assistant?.id;
        
        if (createdAssistantId) {
          log(`✅ Create Assistant: PASS (${assistantTime}ms)`, 'green');
          log(`   Assistant ID: ${createdAssistantId}`, 'cyan');
          log(`   Name: ${assistant.name || 'N/A'}`, 'cyan');
          log(`   Model: ${assistant.model || 'N/A'}`, 'cyan');
          
          // Check if vector store is configured
          const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
          if (vectorStoreIds.length > 0) {
            log(`   Vector Store IDs: ${vectorStoreIds.join(', ')}`, 'cyan');
            results.passed++;
          } else {
            log(`   ⚠️  Warning: No vector stores configured`, 'yellow');
            results.warnings++;
            results.passed++; // Still pass, but warn
          }
        } else {
          log(`❌ Create Assistant: FAIL - No assistant ID returned`, 'red');
          results.failed++;
        }
        results.total++;
      } catch (error) {
        log(`❌ Create Assistant: ERROR - ${error.message}`, 'red');
        log(`   Stack: ${error.stack}`, 'yellow');
        results.failed++;
        results.total++;
      }
    } else {
      log(`⚠️  Skipping Create Assistant test (no file ID)`, 'yellow');
      results.warnings++;
    }
    
    // Test 4: Ensure Assistant Has Vector Store
    if (createdAssistantId && uploadedFileId) {
      logSection('Test 4: Ensure Assistant Has Vector Store');
      try {
        logSubsection('Ensuring vector store...');
        const ensureStart = Date.now();
        const assistant = await openaiStorage.ensureAssistantHasVectorStore(createdAssistantId, uploadedFileId);
        const ensureTime = Date.now() - ensureStart;
        
        const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
        if (vectorStoreIds.length > 0) {
          log(`✅ Ensure Vector Store: PASS (${ensureTime}ms)`, 'green');
          log(`   Vector Store IDs: ${vectorStoreIds.join(', ')}`, 'cyan');
          results.passed++;
        } else {
          log(`❌ Ensure Vector Store: FAIL - No vector stores found`, 'red');
          results.failed++;
        }
        results.total++;
      } catch (error) {
        log(`❌ Ensure Vector Store: ERROR - ${error.message}`, 'red');
        results.failed++;
        results.total++;
      }
    } else {
      log(`⚠️  Skipping Ensure Vector Store test (no assistant or file ID)`, 'yellow');
      results.warnings++;
    }
    
    // Test 5: Create Thread
    logSection('Test 5: Create Thread');
    try {
      logSubsection('Creating thread...');
      const threadStart = Date.now();
      const thread = await openaiStorage.createThread();
      const threadTime = Date.now() - threadStart;
      createdThreadId = thread?.id;
      
      if (createdThreadId) {
        log(`✅ Create Thread: PASS (${threadTime}ms)`, 'green');
        log(`   Thread ID: ${createdThreadId}`, 'cyan');
        results.passed++;
      } else {
        log(`❌ Create Thread: FAIL - No thread ID returned`, 'red');
        results.failed++;
      }
      results.total++;
    } catch (error) {
      log(`❌ Create Thread: ERROR - ${error.message}`, 'red');
      results.failed++;
      results.total++;
    }
    
    // Test 6: Send Message (if assistant and thread are ready)
    if (createdAssistantId && createdThreadId) {
      logSection('Test 6: Send Message');
      try {
        logSubsection('Sending test message...');
        const message = 'What is the purpose of this test application?';
        log(`   Message: "${message}"`, 'cyan');
        
        const messageStart = Date.now();
        const response = await openaiStorage.sendMessage(createdThreadId, createdAssistantId, message);
        const messageTime = Date.now() - messageStart;
        
        if (response && response.length > 0) {
          log(`✅ Send Message: PASS (${messageTime}ms)`, 'green');
          log(`   Response length: ${response.length} characters`, 'cyan');
          log(`   Response preview: ${response.substring(0, 100)}...`, 'cyan');
          results.passed++;
        } else {
          log(`❌ Send Message: FAIL - No response received`, 'red');
          results.failed++;
        }
        results.total++;
      } catch (error) {
        log(`❌ Send Message: ERROR - ${error.message}`, 'red');
        log(`   Stack: ${error.stack}`, 'yellow');
        results.failed++;
        results.total++;
      }
    } else {
      log(`⚠️  Skipping Send Message test (no assistant or thread)`, 'yellow');
      results.warnings++;
    }
    
    // Test 7: Generate Diagrams (if assistant is ready)
    if (createdAssistantId) {
      logSection('Test 7: Generate Diagrams');
      try {
        logSubsection('Generating diagrams...');
        log(`   This may take 30-60 seconds...`, 'yellow');
        
        const diagramsStart = Date.now();
        const diagrams = await openaiStorage.generateDiagrams(testSpecId, createdAssistantId);
        const diagramsTime = Date.now() - diagramsStart;
        
        if (diagrams && Array.isArray(diagrams) && diagrams.length > 0) {
          log(`✅ Generate Diagrams: PASS (${diagramsTime}ms)`, 'green');
          log(`   Diagrams count: ${diagrams.length}`, 'cyan');
          diagrams.forEach((diagram, index) => {
            log(`   Diagram ${index + 1}: ${diagram.type || 'unknown'} - ${diagram.title || 'untitled'}`, 'cyan');
          });
          results.passed++;
        } else {
          log(`❌ Generate Diagrams: FAIL - Invalid diagrams array`, 'red');
          results.failed++;
        }
        results.total++;
      } catch (error) {
        log(`❌ Generate Diagrams: ERROR - ${error.message}`, 'red');
        log(`   Stack: ${error.stack}`, 'yellow');
        results.failed++;
        results.total++;
      }
    } else {
      log(`⚠️  Skipping Generate Diagrams test (no assistant)`, 'yellow');
      results.warnings++;
    }
    
    // Test 8: List Files
    logSection('Test 8: List Files');
    try {
      logSubsection('Listing files...');
      const listStart = Date.now();
      const files = await openaiStorage.listFiles();
      const listTime = Date.now() - listStart;
      
      if (Array.isArray(files)) {
        log(`✅ List Files: PASS (${listTime}ms)`, 'green');
        log(`   Files count: ${files.length}`, 'cyan');
        if (files.length > 0 && files.length <= 5) {
          files.forEach((file, index) => {
            log(`   File ${index + 1}: ${file.filename || file.id} (${file.bytes || 0} bytes)`, 'cyan');
          });
        }
        results.passed++;
      } else {
        log(`❌ List Files: FAIL - Invalid response`, 'red');
        results.failed++;
      }
      results.total++;
    } catch (error) {
      log(`❌ List Files: ERROR - ${error.message}`, 'red');
      results.failed++;
      results.total++;
    }
    
    // Cleanup: Delete test resources
    logSection('Cleanup: Deleting Test Resources');
    try {
      if (createdAssistantId) {
        logSubsection('Deleting assistant...');
        try {
          await openaiStorage.deleteAssistant(createdAssistantId);
          log(`✅ Deleted assistant: ${createdAssistantId}`, 'green');
        } catch (error) {
          log(`⚠️  Failed to delete assistant: ${error.message}`, 'yellow');
          results.warnings++;
        }
      }
      
      if (uploadedFileId) {
        logSubsection('Deleting file...');
        try {
          await openaiStorage.deleteFile(uploadedFileId);
          log(`✅ Deleted file: ${uploadedFileId}`, 'green');
        } catch (error) {
          log(`⚠️  Failed to delete file: ${error.message}`, 'yellow');
          results.warnings++;
        }
      }
    } catch (error) {
      log(`⚠️  Cleanup error: ${error.message}`, 'yellow');
      results.warnings++;
    }
    
  } catch (error) {
    log(`\n❌ Fatal Error: ${error.message}`, 'red');
    log(`   Stack: ${error.stack}`, 'yellow');
    results.failed++;
  }
  
  // Print summary
  logSection('Test Summary');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'blue');
  
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
  
  if (results.failed > 0) {
    log(`\n❌ Some tests failed. Please check the errors above.`, 'red');
    process.exit(1);
  } else if (results.warnings > 0) {
    log(`\n⚠️  Some tests passed with warnings. Review the output above.`, 'yellow');
    process.exit(0);
  } else {
    log(`\n✅ All tests passed!`, 'green');
    process.exit(0);
  }
}

// Run tests
testOpenAIStorage().catch(error => {
  log(`\n❌ Unhandled Error: ${error.message}`, 'red');
  log(`   Stack: ${error.stack}`, 'yellow');
  process.exit(1);
});

