#!/usr/bin/env node

/**
 * Test script for prompts worker
 * Tests the promtmaker worker endpoint with detailed logging
 * 
 * Usage:
 *   node scripts/test-prompts-worker.js
 *   node scripts/test-prompts-worker.js --minimal  # Use minimal test payload
 */

const WORKER_URL = 'https://promtmaker.shalom-cohen-111.workers.dev/generate';
const TIMEOUT_MS = 300000; // 5 minutes

// Minimal test payload
const minimalPayload = {
    stage: 'prompts',
    locale: 'en-US',
    temperature: 0,
    prompt: {
        system: 'You are an expert software development prompt engineer.',
        developer: 'Create a detailed development prompt.',
        user: 'Test prompt for worker health check.'
    }
};

// Full test payload (simulates real request)
const fullPayload = {
    stage: 'prompts',
    locale: 'en-US',
    temperature: 0,
    prompt: {
        system: 'You are an expert software development prompt engineer. Create EXTREMELY DETAILED, PRACTICAL development prompts that guide developers to build complete applications perfectly on the first try. Focus on operational implementation details, not high-level concepts. You MUST include ALL details from the provided specifications - do not summarize, shorten, or omit any information.',
        developer: 'CRITICAL REQUIREMENTS - READ CAREFULLY:\n\n' +
        '1. MINIMUM LENGTH: The fullPrompt MUST be at least 25,000 characters (ideally 30,000-50,000+). This is NOT optional - if your response is shorter, you have FAILED the task.\n\n' +
        '2. ALL 10 STAGES REQUIRED: You MUST include ALL 10 development stages in this exact order:\n' +
        '   - STAGE 1: PROJECT SETUP & BASIC STRUCTURE\n' +
        '   - STAGE 2: FRONTEND CORE FUNCTIONALITY\n' +
        '   - STAGE 3: AUTHENTICATION & USER MANAGEMENT\n' +
        '   - STAGE 4: BACKEND API DEVELOPMENT\n' +
        '   - STAGE 5: AI INTEGRATION (if applicable)\n' +
        '   - STAGE 6: REAL-TIME COLLABORATION (if applicable)\n' +
        '   - STAGE 7: THIRD-PARTY INTEGRATIONS\n' +
        '   - STAGE 8: MOBILE APP DEVELOPMENT (if applicable)\n' +
        '   - STAGE 9: TESTING & QUALITY ASSURANCE\n' +
        '   - STAGE 10: DEPLOYMENT & DEVOPS\n\n' +
        '3. Each stage MUST have detailed sub-steps (1.1, 1.2, 2.1, 2.2, etc.) with specific implementation instructions.\n\n' +
        '4. INCLUDE ALL DETAILS FROM SPECIFICATIONS:\n' +
        '   - ALL features from overview.coreFeaturesOverview (list each one with full description)\n' +
        '   - ALL screens from overview.screenDescriptions.screens (describe each screen with purpose, key elements, user interactions)\n' +
        '   - ALL database entities from technical.databaseSchema.tables (list EVERY table with ALL fields, data types, constraints, relationships)\n' +
        '   - ALL API endpoints from technical.apiEndpoints (describe each with method, path, parameters, request body, response format)\n' +
        '   - ALL UI components from overview.screenDescriptions.uiComponents (describe purpose, placement, behavior)\n' +
        '   - ALL colors from design.visualStyleGuide.colors (list each color with hex code and usage)\n' +
        '   - ALL typography from design.visualStyleGuide.typography (font families, sizes, weights, line heights)\n' +
        '   - ALL spacing values and layout grid system\n' +
        '   - ALL third-party integrations with detailed setup instructions\n\n' +
        '5. REPLACE ALL PLACEHOLDERS: Replace [APPLICATION_NAME], [FRAMEWORK], [MAIN_FEATURE_1], [MAIN_ENTITY_1], etc. with ACTUAL values from the specifications.\n\n' +
        '6. OPERATIONAL DETAILS ONLY: Focus on WHAT TO BUILD and HOW TO BUILD IT with:\n' +
        '   - Exact function signatures with parameters\n' +
        '   - Specific component props and structure\n' +
        '   - Detailed API endpoint formats\n' +
        '   - Complete database schemas with relationships\n' +
        '   - Step-by-step implementation flows\n' +
        '   - Do NOT include abstract concepts or high-level descriptions\n\n' +
        '7. DO NOT SUMMARIZE: Include the COMPLETE ideaSummary, problemStatement, userJourneySummary, navigationStructure - do not shorten them.\n\n' +
        'The prompt must be so detailed that a developer can build the complete application from scratch on the first attempt without asking any questions.',
        user: JSON.stringify({
            overview: {
                ideaSummary: 'A test application for worker health check',
                coreFeaturesOverview: ['Feature 1', 'Feature 2'],
                screenDescriptions: {
                    screens: ['Screen 1', 'Screen 2'],
                    uiComponents: ['Component 1']
                }
            },
            technical: {
                techStack: {
                    frontend: 'React',
                    backend: 'Node.js',
                    database: 'PostgreSQL'
                },
                databaseSchema: {
                    tables: [
                        {
                            name: 'users',
                            fields: [
                                { name: 'id', type: 'string', required: true },
                                { name: 'email', type: 'string', required: true }
                            ]
                        }
                    ]
                },
                apiEndpoints: [
                    { method: 'GET', path: '/api/users', description: 'Get all users' }
                ]
            },
            design: {
                visualStyleGuide: {
                    colors: {
                        primary: '#007bff',
                        secondary: '#6c757d'
                    },
                    typography: {
                        fontFamily: 'Arial',
                        fontSize: '16px'
                    }
                }
            }
        }, null, 2)
    }
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
}

async function testWorker(useMinimal = false) {
    const requestId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payload = useMinimal ? minimalPayload : fullPayload;
    const payloadSize = JSON.stringify(payload).length;
    
    console.log('\n' + '='.repeat(80));
    console.log(`[${requestId}] Testing Prompts Worker`);
    console.log('='.repeat(80));
    console.log(`Worker URL: ${WORKER_URL}`);
    console.log(`Timeout: ${formatDuration(TIMEOUT_MS)}`);
    console.log(`Payload size: ${formatBytes(payloadSize)}`);
    console.log(`Test mode: ${useMinimal ? 'MINIMAL' : 'FULL'}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('-'.repeat(80));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`\n[${requestId}] ⏱️  TIMEOUT: Request exceeded ${formatDuration(TIMEOUT_MS)}`);
        controller.abort();
    }, TIMEOUT_MS);
    
    const startTime = Date.now();
    
    try {
        console.log(`[${requestId}] 📤 Sending request...`);
        console.log(`[${requestId}] Request body preview:`, {
            stage: payload.stage,
            locale: payload.locale,
            temperature: payload.temperature,
            systemPromptLength: payload.prompt.system.length,
            developerPromptLength: payload.prompt.developer.length,
            userPromptLength: payload.prompt.user.length
        });
        
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - startTime;
        
        console.log(`\n[${requestId}] ✅ Response received`);
        console.log(`[${requestId}] Duration: ${formatDuration(fetchDuration)}`);
        console.log(`[${requestId}] Status: ${response.status} ${response.statusText}`);
        console.log(`[${requestId}] Headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`\n[${requestId}] ❌ Response not OK`);
            console.error(`[${requestId}] Error text (first 500 chars):`, errorText.substring(0, 500));
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseReadStart = Date.now();
        const responseText = await response.text();
        const responseReadDuration = Date.now() - responseReadStart;
        
        console.log(`\n[${requestId}] 📥 Response body read`);
        console.log(`[${requestId}] Response size: ${formatBytes(responseText.length)}`);
        console.log(`[${requestId}] Read duration: ${formatDuration(responseReadDuration)}`);
        console.log(`[${requestId}] Response preview (first 200 chars):`, responseText.substring(0, 200) + '...');
        
        const parseStart = Date.now();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error(`\n[${requestId}] ❌ Failed to parse JSON`);
            console.error(`[${requestId}] Parse error:`, parseError.message);
            console.error(`[${requestId}] Response text (first 1000 chars):`, responseText.substring(0, 1000));
            throw parseError;
        }
        
        const parseDuration = Date.now() - parseStart;
        console.log(`\n[${requestId}] ✅ JSON parsed successfully`);
        console.log(`[${requestId}] Parse duration: ${formatDuration(parseDuration)}`);
        console.log(`[${requestId}] Response keys:`, Object.keys(data));
        
        if (data.prompts) {
            console.log(`\n[${requestId}] ✅ Prompts data found`);
            console.log(`[${requestId}] Has fullPrompt:`, !!data.prompts.fullPrompt);
            if (data.prompts.fullPrompt) {
                console.log(`[${requestId}] FullPrompt length: ${formatBytes(data.prompts.fullPrompt.length)}`);
                console.log(`[${requestId}] FullPrompt preview (first 300 chars):`, data.prompts.fullPrompt.substring(0, 300) + '...');
            }
            console.log(`[${requestId}] Has thirdPartyIntegrations:`, !!data.prompts.thirdPartyIntegrations);
            if (data.prompts.thirdPartyIntegrations) {
                console.log(`[${requestId}] ThirdPartyIntegrations count:`, data.prompts.thirdPartyIntegrations.length);
            }
        } else {
            console.error(`\n[${requestId}] ❌ Missing prompts field in response`);
            console.error(`[${requestId}] Response structure:`, JSON.stringify(data, null, 2).substring(0, 1000));
        }
        
        const totalDuration = Date.now() - startTime;
        console.log('\n' + '='.repeat(80));
        console.log(`[${requestId}] ✅ TEST SUCCESSFUL`);
        console.log(`[${requestId}] Total duration: ${formatDuration(totalDuration)}`);
        console.log('='.repeat(80) + '\n');
        
        return {
            success: true,
            requestId,
            duration: totalDuration,
            status: response.status,
            responseSize: responseText.length,
            hasPrompts: !!data.prompts,
            fullPromptLength: data.prompts?.fullPrompt?.length || 0
        };
        
    } catch (error) {
        clearTimeout(timeoutId);
        const totalDuration = Date.now() - startTime;
        
        console.error('\n' + '='.repeat(80));
        console.error(`[${requestId}] ❌ TEST FAILED`);
        console.error('='.repeat(80));
        console.error(`[${requestId}] Error name:`, error.name);
        console.error(`[${requestId}] Error message:`, error.message);
        console.error(`[${requestId}] Error stack:`, error.stack);
        console.error(`[${requestId}] Duration before failure: ${formatDuration(totalDuration)}`);
        console.error(`[${requestId}] Is abort error:`, error.name === 'AbortError' || error.message?.includes('aborted'));
        console.error('='.repeat(80) + '\n');
        
        return {
            success: false,
            requestId,
            duration: totalDuration,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        };
    }
}

// Main execution
(async () => {
    const useMinimal = process.argv.includes('--minimal');
    
    console.log('\n🔍 Prompts Worker Test Script');
    console.log('This script tests the promtmaker worker endpoint');
    console.log(`Using ${useMinimal ? 'MINIMAL' : 'FULL'} test payload\n`);
    
    const result = await testWorker(useMinimal);
    
    process.exit(result.success ? 0 : 1);
})();

