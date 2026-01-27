/**
 * Articles Automation
 * Automated article writing using OpenAI
 */

const { AutomationJob } = require('./automation-service');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { generateAndSaveSitemap } = require('./sitemap-generator');

const ARTICLES_COLLECTION = 'articles';

// Article generation prompt (same as articles-routes.js)
const articleGenerationPrompt = {
  system: `You are a no-BS dev-tools writer in 2025. 

Your readers are senior developers and indie hackers who hate fluff, love concrete examples, benchmarks, prompts, before/after code, and real numbers. 

Write like swyx, levelsio or addy osmani – short sentences, zero corporate speak, maximum value per word.`,

  developer: `Return ONLY a valid JSON object with this exact structure:

{
  "title": "Clickbait-but-honest title, 55-70 chars, primary keyword first",
  "seo_title": "SEO title, 50-60 chars, keyword front-loaded",
  "short_title": "Short punchy title for previews, 35-50 chars",
  "teaser_90": "Exactly 90 characters teaser that makes people click",
  "description_160": "Meta description exactly 160 characters, includes main keyword + promise",
  "content_markdown": "Full article in clean Markdown. Requirements:
    • 800-1200 words max (brevity = respect)
    • H2/H3 only, no fluff intros
    • First H2 must appear in first 100 words
    • Every section has at least one real code block, prompt example, or screenshot-worthy result
    • Include exact prompts used
    • Before/after comparisons when relevant
    • Real numbers (time saved, tokens used, success rate)
    • Zero philosophical rambling
    • Ends with 'TL;DR' section + actionable next steps
    • Tone: direct, slightly sarcastic when something sucks",
  "tags": ["array", "of", "5-8", "hyper-specific", "2025-relevant", "tags"]
}`,

  user: (topic) => `Write a 2025-style, zero-fluff, example-heavy article about: ${topic}

Target audience: developers who already know what vibe coding is and just want the new hotness, benchmarks, and copy-paste prompts.`
};

// Helper: Slugify text for URL-friendly slugs
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Validate article data
function validateArticleData(data) {
  const requiredFields = ['title', 'seo_title', 'short_title', 'teaser_90', 'description_160', 'content_markdown', 'tags'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (!Array.isArray(data.tags)) {
    throw new Error('Tags must be an array');
  }
  
  return true;
}

// Helper: Format article data for Firebase
function formatArticleForFirebase(articleData, topic) {
  const articleSlug = slugify(articleData.title);
  
  return {
    topic: topic.trim(),
    title: articleData.title,
    seo_title: articleData.seo_title,
    short_title: articleData.short_title,
    teaser_90: articleData.teaser_90,
    description_160: articleData.description_160,
    content_markdown: articleData.content_markdown,
    tags: articleData.tags || [],
    slug: articleSlug,
    status: 'published',
    views: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'automation'
  };
}

/**
 * Article Writer Job
 * Writes articles automatically using OpenAI
 */
class ArticleWriterJob extends AutomationJob {
  constructor(config = {}) {
    super('article-writer', config);
  }

  /**
   * Generate topic suggestions
   * @returns {Promise<string>} Selected topic
   */
  async generateTopic() {
    const openaiClient = this.getOpenAIClient();
    const requestId = `topic-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info({ requestId }, '[articles-automation] Generating article topic');
    
    try {
      // Get recent tools to base topic on
      const recentToolsSnapshot = await db.collection('tools')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const recentTools = recentToolsSnapshot.docs.map(doc => doc.data().name);
      
      const topicPrompt = `Generate a compelling article topic for a developer tools blog. The topic should be:
- Relevant to developers and indie hackers in 2025
- Focused on practical tools, techniques, or trends
- Specific enough to be actionable
- Not covered in recent articles

${recentTools.length > 0 ? `Recent tools we've covered: ${recentTools.join(', ')}` : ''}

Return ONLY a single topic string (no JSON, no quotes, just the topic text). The topic should be 5-10 words and be specific enough to write a detailed article about.

Examples of good topics:
- "Building a SaaS MVP with Bolt.new in 30 minutes"
- "5 AI coding assistants that actually save time in 2025"
- "How to deploy a Next.js app to Vercel with zero config"

Generate a topic now:`;

      const response = await openaiClient.chatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content strategist for a developer tools blog. You generate compelling, specific article topics.'
          },
          {
            role: 'user',
            content: topicPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 100
      });
      
      const topic = response.choices[0]?.message?.content?.trim();
      
      if (!topic) {
        throw new Error('No topic generated');
      }
      
      // Clean up topic (remove quotes, extra whitespace)
      const cleanTopic = topic.replace(/^["']|["']$/g, '').trim();
      
      logger.info({ requestId, topic: cleanTopic }, '[articles-automation] Topic generated');
      
      return cleanTopic;
    } catch (error) {
      logger.error({ requestId, error: error.message }, '[articles-automation] Failed to generate topic');
      // Fallback to default topic
      return 'Latest AI coding tools and techniques for 2025';
    }
  }

  /**
   * Check if article with slug already exists
   * @param {string} slug - Article slug
   * @returns {Promise<boolean>} True if exists
   */
  async articleExists(slug) {
    try {
      const snapshot = await db.collection(ARTICLES_COLLECTION)
        .where('slug', '==', slug)
        .limit(1)
        .get();
      
      return !snapshot.empty;
    } catch (error) {
      logger.error({ error: error.message, slug }, '[articles-automation] Error checking if article exists');
      return false;
    }
  }

  /**
   * Execute the job
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Job result
   */
  async execute(options = {}) {
    const { dryRun = false, topic: providedTopic = null } = options;
    const requestId = `article-writer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();
    
    logger.info({ requestId, dryRun, providedTopic }, '[articles-automation] Starting article writer job');
    
    try {
      // Get OpenAI client
      const openaiClient = this.getOpenAIClient();
      
      // Generate or use provided topic
      const topic = providedTopic || await this.generateTopic();
      
      if (!topic || topic.trim().length === 0) {
        throw new Error('No topic available for article generation');
      }
      
      logger.info({ requestId, topic }, '[articles-automation] Using topic for article');
      
      // Build prompt
      const prompt = {
        system: articleGenerationPrompt.system,
        developer: articleGenerationPrompt.developer,
        user: articleGenerationPrompt.user(topic)
      };
      
      // Call OpenAI
      logger.info({ requestId }, '[articles-automation] Calling OpenAI API for article generation');
      const response = await openaiClient.chatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: prompt.system
          },
          {
            role: 'user',
            content: `${prompt.developer}\n\n${prompt.user}`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });
      
      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
      
      logger.debug({ requestId, contentLength: content.length }, '[articles-automation] Received OpenAI response');
      
      // Parse JSON
      let articleData;
      try {
        const parsed = JSON.parse(content);
        articleData = parsed;
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          articleData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse JSON: ${parseError.message}`);
        }
      }
      
      // Validate article data
      validateArticleData(articleData);
      
      logger.info({ requestId, title: articleData.title }, '[articles-automation] Article data validated');
      
      // Format for Firebase
      const articleFirebase = formatArticleForFirebase(articleData, topic);
      
      // Check if slug already exists
      const exists = await this.articleExists(articleFirebase.slug);
      
      if (exists) {
        // Append timestamp to make unique
        articleFirebase.slug = `${articleFirebase.slug}-${Date.now()}`;
        logger.warn({ requestId, newSlug: articleFirebase.slug }, '[articles-automation] Slug conflict resolved');
      }
      
      // Save article (unless dry run)
      let articleId = null;
      if (!dryRun) {
        // Double-check slug before saving
        const existsAgain = await this.articleExists(articleFirebase.slug);
        
        if (existsAgain) {
          articleFirebase.slug = `${articleFirebase.slug}-${Date.now()}`;
        }
        
        const docRef = await db.collection(ARTICLES_COLLECTION).add(articleFirebase);
        articleId = docRef.id;
        
        logger.info({ requestId, articleId, slug: articleFirebase.slug, title: articleData.title }, '[articles-automation] Article saved');
        
        // Update sitemap
        try {
          await generateAndSaveSitemap();
          logger.debug({ requestId }, '[articles-automation] Sitemap updated');
        } catch (sitemapError) {
          logger.warn({ requestId, error: sitemapError.message }, '[articles-automation] Failed to update sitemap (non-critical)');
        }
      } else {
        logger.debug({ requestId, slug: articleFirebase.slug, title: articleData.title }, '[articles-automation] Article would be saved (dry run)');
      }
      
      const duration = Date.now() - startedAt.getTime();
      
      logger.info({ 
        requestId, 
        articleId,
        topic,
        title: articleData.title,
        duration: `${duration}ms`,
        dryRun 
      }, '[articles-automation] Article writer job completed');
      
      return {
        success: true,
        requestId,
        article: {
          id: articleId,
          topic,
          title: articleData.title,
          slug: articleFirebase.slug,
          ...articleFirebase
        },
        duration,
        dryRun
      };
    } catch (error) {
      logger.error({ 
        requestId, 
        error: { 
          message: error.message, 
          stack: error.stack 
        } 
      }, '[articles-automation] Article writer job failed');
      
      throw error;
    }
  }
}

module.exports = {
  ArticleWriterJob
};

