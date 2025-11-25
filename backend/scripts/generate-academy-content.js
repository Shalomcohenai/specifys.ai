// Script to generate Academy guide content using AI
// Run with: node backend/scripts/generate-academy-content.js
// 
// This script works in 3 stages:
// Stage 1: Generate content for all Beginner level guides
// Stage 2: Generate content for all Intermediate level guides  
// Stage 3: Generate content for all Advanced level guides
//
// Setup:
// 1. Add OPENAI_API_KEY to backend/.env file
// 2. Run: node backend/scripts/generate-academy-content.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db } = require('../server/firebase-admin');
const readline = require('readline');

// Use node-fetch for Node.js compatibility
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

// Setup readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask user for input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Function to delay (avoid rate limits)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o'; // or 'gpt-4-turbo'

// Base prompt template - adjusted per level
function getPromptForLevel(title, level, categoryName) {
  const basePrompt = `You are an expert educational content creator for a coding academy that teaches "vibe coders" - people who want to understand how modern apps work without writing code.

🎯 THE CORE MISSION:
Your goal is to create deep, intuitive, and practical understanding of what happens "behind the scenes" when AI generates a feature, website, or application.

📚 TEACHING PHILOSOPHY:
- The content does NOT teach how to write code — it teaches how to UNDERSTAND code
- It does NOT teach development — it teaches HOW development works and WHY things work the way they do
- It does NOT teach programming — it teaches how to be a modern AI developer who understands systems and plans correctly what to ask from the engine

✨ WHAT EACH GUIDE MUST DELIVER:

1. **Systemic Understanding**
   Explain a process or mechanism — how it works, what its role is, and why it's important in modern AI-driven development.

2. **Simple Mental Model**
   Include a "thinking model" that simplifies concepts like Backend, API, DB, DevOps, Tokens, Dependencies, etc.
   Make complex ideas accessible through clear mental frameworks.

3. **Real-World Examples & Analogies**
   Every concept must have a clear analogy from daily life:
   - "Database is like a closed notebook in a drawer"
   - "Frontend is the storefront window, Backend is the warehouse"
   - "API is a conversation between two employees in a store"
   These analogies allow understanding complex things — without a single line of code.

4. **Understanding How AI Thinks**
   Explain how AI breaks down a feature request, how it generates files, what its limitations are, and what happens behind the scenes when asking it to build an application.

📝 CONTENT REQUIREMENTS FOR "${title}" (${level} level):`;

  // Level-specific adjustments
  let levelSpecificGuidance = '';
  if (level === 'Beginner') {
    levelSpecificGuidance = `
BEGINNER LEVEL GUIDANCE:
- Start with the most basic concepts - assume zero prior knowledge
- Use the simplest analogies possible
- Break down complex ideas into very small, digestible pieces
- Focus on "what" and "why" before "how"
- Use everyday examples that everyone can relate to
- Keep language extremely simple and accessible
- Explain terms as you introduce them
- Build understanding step by step, layer by layer`;
  } else if (level === 'Intermediate') {
    levelSpecificGuidance = `
INTERMEDIATE LEVEL GUIDANCE:
- Build upon beginner concepts - assume basic understanding exists
- Introduce more nuanced concepts and relationships
- Show how different parts connect and interact
- Explain "how" things work in more detail
- Use more technical analogies while keeping them accessible
- Discuss trade-offs and considerations
- Show practical applications and real-world scenarios
- Connect concepts to AI development workflows`;
  } else if (level === 'Advanced') {
    levelSpecificGuidance = `
ADVANCED LEVEL GUIDANCE:
- Assume solid understanding of intermediate concepts
- Dive deep into mechanisms and architectures
- Explain complex interactions and edge cases
- Discuss optimization, scalability, and best practices
- Show advanced patterns and sophisticated approaches
- Connect multiple concepts together
- Explain how AI handles complex scenarios
- Provide insights into professional-level considerations`;
  }

  return `${basePrompt}
${levelSpecificGuidance}

Write in clear, simple language with clear mental models, accompanied by real-world examples, analogies, and flow descriptions.

NOT dry theory — explanations that capture what happens behind the scenes, live.

The content should be:
- Engaging and practical
- Suitable for ${level} level students
- Focused on understanding systems, not coding
- Rich with analogies and mental models
- Explaining the "why" behind the "what"

Category context: ${categoryName}
Guide title: ${title}
Level: ${level}

Return ONLY a valid JSON object with this exact structure:
{
  "whatYouLearn": [
    "First learning point (what the user will understand)",
    "Second learning point",
    "Third learning point",
    "Fourth learning point (if applicable)"
  ],
  "content": "<h2>Introduction</h2><p>Start with a clear analogy or mental model...</p><h2>What is [Concept]?</h2><p>Explain using real-world examples...</p><h2>How It Works Behind the Scenes</h2><p>Describe the process, flow, and mechanisms...</p><h2>Why It Matters</h2><p>Explain the importance in modern AI development...</p><h2>How AI Thinks About This</h2><p>Explain how AI approaches this concept...</p>",
  "summary": "A brief 1-2 sentence summary that captures the essence of understanding this concept",
  "seoTitle": "SEO-optimized title (60 characters max)",
  "seoDescription": "SEO-optimized meta description (155-160 characters)",
  "seoKeywords": "keyword1, keyword2, keyword3, keyword4",
  "questions": [
    {
      "q": "Question that tests understanding of the concept (not memorization)",
      "answers": [
        "Answer option 1",
        "Answer option 2",
        "Answer option 3",
        "Answer option 4"
      ],
      "correctIndex": 0
    },
    {
      "q": "Question that tests understanding of how this works in practice",
      "answers": [
        "Answer option 1",
        "Answer option 2",
        "Answer option 3",
        "Answer option 4"
      ],
      "correctIndex": 2
    }
  ]
}

IMPORTANT:
- Use HTML tags: <h2> for sections, <p> for paragraphs, <ul>/<ol> for lists, <strong> for emphasis
- Include at least one clear analogy in the introduction
- Explain the "behind the scenes" process clearly
- Make questions test understanding, not memorization
- Keep language simple and accessible
- Focus on mental models and practical understanding
- SEO title should be compelling and include the main keyword
- SEO description should be engaging and include a call to action`;
}

// Function to call OpenAI API
async function generateGuideContent(title, level, categoryName) {
  const prompt = getPromptForLevel(title, level, categoryName);

  try {
    console.log(`   🤖 Calling OpenAI API for: ${title}...`);
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content creator. You write clear, engaging guides that teach understanding, not coding. You always use analogies, mental models, and real-world examples. You return ONLY valid JSON - never markdown code blocks or explanations, only the JSON object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    
    console.log(`   ✅ Generated content for: ${title}`);
    return content;
  } catch (error) {
    console.error(`   ❌ Error generating content for ${title}:`, error.message);
    throw error;
  }
}

// Function to update a guide with generated content
async function updateGuide(guideId, guideData, content) {
  try {
    const updateData = {
      whatYouLearn: content.whatYouLearn,
      content: content.content,
      summary: content.summary,
      questions: content.questions,
      updatedAt: new Date().toISOString(),
      aiGenerated: true,
      aiGeneratedAt: new Date().toISOString()
    };

    // Add SEO fields if provided
    if (content.seoTitle) {
      updateData.seoTitle = content.seoTitle;
    }
    if (content.seoDescription) {
      updateData.seoDescription = content.seoDescription;
    }
    if (content.seoKeywords) {
      updateData.seoKeywords = content.seoKeywords;
    }

    await db.collection('academy_guides').doc(guideId).update(updateData);
    console.log(`   ✅ Updated guide: ${guideData.title}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating guide ${guideId}:`, error.message);
    return false;
  }
}

// Function to check if guide needs content generation
function needsContentGeneration(guide) {
  // Check if guide has no content or very minimal content
  const hasNoContent = !guide.content || guide.content.trim().length < 100;
  
  // Check if guide has no "what you learn" section
  const hasNoWhatYouLearn = !guide.whatYouLearn || 
                            !Array.isArray(guide.whatYouLearn) || 
                            guide.whatYouLearn.length === 0;
  
  // Check if guide has no questions
  const hasNoQuestions = !guide.questions || 
                         !Array.isArray(guide.questions) || 
                         guide.questions.length === 0;
  
  // Check if guide was not AI-generated (old content)
  const notAiGenerated = guide.aiGenerated !== true;
  
  // Check if content seems like placeholder/template
  const isPlaceholder = guide.content && (
    guide.content.includes('Welcome to our guide') && 
    guide.content.length < 500
  );
  
  return hasNoContent || hasNoWhatYouLearn || hasNoQuestions || notAiGenerated || isPlaceholder;
}

// Function to process guides by level
async function processGuidesByLevel(level, options = {}) {
  const { forceUpdate = false, skipExisting = false } = options;
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 STAGE: Processing ${level} Level Guides`);
    console.log(`${'='.repeat(60)}\n`);

    // Get all guides for this level
    const guidesSnapshot = await db.collection('academy_guides')
      .where('level', '==', level)
      .get();

    if (guidesSnapshot.empty) {
      console.log(`⚠️  No ${level} level guides found.`);
      return { processed: 0, failed: 0, skipped: 0 };
    }

    console.log(`Found ${guidesSnapshot.size} ${level} level guides\n`);

    // Filter guides that need content generation
    const guidesToProcess = [];
    const guidesToSkip = [];

    for (const doc of guidesSnapshot.docs) {
      const guide = doc.data();
      
      if (forceUpdate) {
        // Force update all guides
        guidesToProcess.push({ doc, guide });
      } else if (skipExisting && guide.aiGenerated === true && 
                 guide.content && guide.content.length > 100 &&
                 guide.questions && guide.questions.length > 0) {
        // Skip guides that already have good content
        guidesToSkip.push({ doc, guide });
      } else if (needsContentGeneration(guide)) {
        // Guide needs content generation
        guidesToProcess.push({ doc, guide });
      } else {
        // Guide has content, skip it
        guidesToSkip.push({ doc, guide });
      }
    }

    console.log(`📊 Analysis:`);
    console.log(`   - Guides that need content: ${guidesToProcess.length}`);
    console.log(`   - Guides with existing content: ${guidesToSkip.length}\n`);

    if (guidesToProcess.length === 0) {
      console.log(`✅ All ${level} level guides already have content. Nothing to process.\n`);
      return { processed: 0, failed: 0, skipped: guidesToSkip.length };
    }

    let processed = 0;
    let failed = 0;

    // Process each guide that needs content
    for (let i = 0; i < guidesToProcess.length; i++) {
      const { doc, guide } = guidesToProcess[i];
      
      // Get category name for context
      let categoryName = 'Unknown';
      try {
        const categoryDoc = await db.collection('academy_categories').doc(guide.category).get();
        if (categoryDoc.exists) {
          categoryName = categoryDoc.data().title;
        }
      } catch (error) {
        console.log(`   ⚠️  Could not fetch category name: ${error.message}`);
      }

      console.log(`\n📝 [${i + 1}/${guidesToProcess.length}] Processing: ${guide.title}`);
      console.log(`   Category: ${categoryName}`);
      console.log(`   Level: ${guide.level}`);
      
      // Show why this guide is being processed
      if (!guide.content || guide.content.trim().length < 100) {
        console.log(`   Reason: Missing or minimal content`);
      } else if (!guide.questions || guide.questions.length === 0) {
        console.log(`   Reason: Missing questions`);
      } else if (guide.aiGenerated !== true) {
        console.log(`   Reason: Not AI-generated (old content)`);
      } else {
        console.log(`   Reason: Content needs refresh`);
      }

      try {
        // Generate content
        const content = await generateGuideContent(
          guide.title,
          guide.level,
          categoryName
        );

        // Update guide
        const success = await updateGuide(doc.id, guide, content);
        
        if (success) {
          processed++;
        } else {
          failed++;
        }

        // Delay to avoid rate limits (1 second between requests)
        if (i < guidesToProcess.length - 1) {
          await delay(1000);
        }
      } catch (error) {
        console.error(`   ❌ Failed to process ${guide.title}:`, error.message);
        failed++;
        
        // Still delay even on error
        if (i < guidesToProcess.length - 1) {
          await delay(1000);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ STAGE COMPLETE: ${level} Level`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped: ${guidesToSkip.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return { processed, failed, skipped: guidesToSkip.length };
  } catch (error) {
    console.error(`❌ Error processing ${level} level guides:`, error);
    return { processed: 0, failed: 0, skipped: 0 };
  }
}

// Main function
async function main() {
  console.log('\n🚀 Academy Guide Content Generator');
  console.log('===================================\n');

  // Check API key
  if (!OPENAI_API_KEY) {
    console.log('⚠️  No OPENAI_API_KEY found in .env file');
    const apiKey = await askQuestion('Enter your OpenAI API key: ');
    if (!apiKey) {
      console.log('❌ API key is required. Exiting...');
      process.exit(1);
    }
    process.env.OPENAI_API_KEY = apiKey;
  } else {
    console.log('✅ OpenAI API key found\n');
  }

  // Ask for confirmation
  console.log('This script will generate content for all guides in 3 stages:');
  console.log('  1. Beginner level guides');
  console.log('  2. Intermediate level guides');
  console.log('  3. Advanced level guides\n');
  console.log('⚠️  This will UPDATE existing guides with AI-generated content.\n');

  const confirm = await askQuestion('Continue? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled by user.');
    process.exit(0);
  }

  // Ask for processing mode
  console.log('\nSelect processing mode:');
  console.log('1. Smart mode (default) - Only process guides missing content');
  console.log('2. Force update all - Regenerate content for all guides');
  console.log('3. Skip existing - Only process guides without AI-generated content');
  
  const mode = await askQuestion('\nEnter mode (1/2/3, default: 1): ') || '1';
  
  const options = {
    forceUpdate: mode === '2',
    skipExisting: mode === '3'
  };

  const results = {
    beginner: { processed: 0, failed: 0, skipped: 0 },
    intermediate: { processed: 0, failed: 0, skipped: 0 },
    advanced: { processed: 0, failed: 0, skipped: 0 }
  };

  // Stage 1: Beginner
  console.log('\n\n🎯 STAGE 1: BEGINNER LEVEL GUIDES\n');
  const beginnerResult = await processGuidesByLevel('Beginner', options);
  results.beginner = beginnerResult;

  // Ask before proceeding to next stage
  if (beginnerResult.processed > 0 || beginnerResult.failed > 0) {
    const continueStage2 = await askQuestion('\nContinue to Stage 2 (Intermediate)? (yes/no): ');
    if (continueStage2.toLowerCase() !== 'yes') {
      console.log('\n✅ Stopped after Stage 1.');
      printSummary(results);
      rl.close();
      process.exit(0);
    }
  }

  // Stage 2: Intermediate
  console.log('\n\n🎯 STAGE 2: INTERMEDIATE LEVEL GUIDES\n');
  const intermediateResult = await processGuidesByLevel('Intermediate', options);
  results.intermediate = intermediateResult;

  // Ask before proceeding to next stage
  if (intermediateResult.processed > 0 || intermediateResult.failed > 0) {
    const continueStage3 = await askQuestion('\nContinue to Stage 3 (Advanced)? (yes/no): ');
    if (continueStage3.toLowerCase() !== 'yes') {
      console.log('\n✅ Stopped after Stage 2.');
      printSummary(results);
      rl.close();
      process.exit(0);
    }
  }

  // Stage 3: Advanced
  console.log('\n\n🎯 STAGE 3: ADVANCED LEVEL GUIDES\n');
  const advancedResult = await processGuidesByLevel('Advanced', options);
  results.advanced = advancedResult;

  // Print final summary
  printSummary(results);

  rl.close();
  process.exit(0);
}

function printSummary(results) {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Beginner:    ${results.beginner.processed} processed, ${results.beginner.failed} failed, ${results.beginner.skipped} skipped`);
  console.log(`Intermediate: ${results.intermediate.processed} processed, ${results.intermediate.failed} failed, ${results.intermediate.skipped} skipped`);
  console.log(`Advanced:     ${results.advanced.processed} processed, ${results.advanced.failed} failed, ${results.advanced.skipped} skipped`);
  console.log('='.repeat(60));
  const totalProcessed = results.beginner.processed + results.intermediate.processed + results.advanced.processed;
  const totalFailed = results.beginner.failed + results.intermediate.failed + results.advanced.failed;
  const totalSkipped = results.beginner.skipped + results.intermediate.skipped + results.advanced.skipped;
  console.log(`Total: ${totalProcessed} processed, ${totalFailed} failed, ${totalSkipped} skipped\n`);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  rl.close();
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});

