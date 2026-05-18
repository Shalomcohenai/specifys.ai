/**
 * Articles Automation
 * Automated article writing using OpenAI
 */

const { getISOWeek, getISOWeekYear } = require('date-fns');
const { AutomationJob } = require('./automation-service');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { generateAndSaveSitemap } = require('./sitemap-generator');
const { writeJekyllPostForArticle } = require('./jekyll-post-writer');

const ARTICLES_COLLECTION = 'articles';
const AUTOMATION_STATE_DOC = 'automation_state/weekly_articles';

// Article generation prompt (same shape as articles-routes.js)
const articleGenerationPrompt = {
  system: `You are a no-BS dev-tools writer in ${new Date().getFullYear()}.

Your readers are senior developers and indie hackers who hate fluff, love concrete examples, benchmarks, prompts, before/after code, and real numbers.

Write like swyx, levelsio or addy osmani – short sentences, zero corporate speak, maximum value per word.

Write everything in English only (titles, body, tags, SEO fields).

MANDATORY RESEARCH RULES (do not skip):
1. You MUST search the web before writing. Do not rely on training data alone.
2. Every concrete claim — tool name, version, pricing, benchmark, news event, release — MUST be grounded in a source published within the last 30 days (prefer the last 7 days).
3. If a fact is older than 30 days, drop it or replace it with something current. Do not say "in 2023..." or use stale data.
4. Inline link to the freshest source you used for each major claim (Markdown link format).
5. If you cannot find anything fresh on a sub-topic, change the angle — do not invent.
6. End the article with a "Sources" section listing the URLs you actually used, with their publish dates.`,

  developer: `Return ONLY a valid JSON object with this exact structure (no prose around it, no markdown fences):

{
  "title": "Clickbait-but-honest title, 55-70 chars, primary keyword first",
  "seo_title": "SEO title, 50-60 chars, keyword front-loaded",
  "short_title": "Short punchy title for previews, 35-50 chars",
  "teaser_90": "Exactly 90 characters teaser that makes people click",
  "description_160": "Meta description exactly 160 characters, includes main keyword + promise",
  "content_markdown": "Full article in clean Markdown. Requirements:
    • 800-1200 words max (brevity = respect)
    • DO NOT include an H1 / top-level heading. The page renders the JSON title field as the H1 already, so any line starting with a single hash + space in this body would produce a duplicate H1 and break SEO.
    • Use H2 (two hashes + space) and H3 (three hashes + space) only, no fluff intros
    • First H2 must appear in first 100 words
    • Every section has at least one real code block, prompt example, or screenshot-worthy result
    • Include exact prompts used
    • Before/after comparisons when relevant
    • Real numbers (time saved, tokens used, success rate)
    • Inline Markdown links to fresh sources (past 30 days) for every concrete claim
    • Zero philosophical rambling
    • Ends with a 'TL;DR' section + actionable next steps, then a 'Sources' section listing URLs you actually used with publish dates",
  "tags": ["array", "of", "5-8", "hyper-specific", "current-year-relevant", "tags"]
}`,

  user: (topic) => `Write a current, zero-fluff, example-heavy article about: ${topic}

Before writing, SEARCH THE WEB for:
- News, launches, releases, version bumps, or blog posts on this topic from the past 7-30 days.
- Recent benchmarks, pricing changes, or user reports.
- What practitioners on X/Twitter, Hacker News, Reddit, or Dev.to said in the past 30 days.

Then ground the entire article in those sources. Reject anything older than 30 days.

Target audience: developers who already know what vibe coding is and just want the new hotness, benchmarks, and copy-paste prompts.

Language: English only for all fields.`
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ARTICLE_REQUIRED_FIELDS = [
  'title', 'seo_title', 'short_title', 'teaser_90', 'description_160', 'content_markdown', 'tags'
];

const ARTICLE_GEN_MAX_ATTEMPTS = Math.min(
  Math.max(parseInt(process.env.ARTICLES_GEN_MAX_ATTEMPTS || '3', 10) || 3, 1),
  5
);

function classifyArticleJobError(message = '') {
  if (message.includes('Failed to parse article JSON')) return 'openai_json_parse';
  if (message.includes('Missing required fields')) return 'article_validation_missing';
  if (message.includes('Tags must be an array')) return 'article_validation_tags';
  if (message.includes('H1 heading')) return 'article_validation_h1';
  if (message.includes('at least one H2')) return 'article_validation_h2';
  if (message.includes('No content in OpenAI')) return 'openai_empty_response';
  return 'article_generation_other';
}

/**
 * Extract the first balanced {...} JSON object from model text (handles strings/escapes).
 */
function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse JSON from LLM output (prose, fences, citations). Returns { data, parseAttempts }.
 */
function extractJsonFromLlmContent(content) {
  const parseAttempts = [];

  if (!content || typeof content !== 'string') {
    parseAttempts.push({ stage: 'empty', error: 'No content string' });
    return { data: null, parseAttempts };
  }

  const trimmed = content.trim();

  const tryParse = (raw, stage) => {
    try {
      return JSON.parse(raw);
    } catch (e) {
      parseAttempts.push({ stage, error: e.message });
      return null;
    }
  };

  let data = tryParse(trimmed, 'direct');
  if (data) return { data, parseAttempts };

  const codeBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (let i = 0; i < codeBlocks.length; i++) {
    data = tryParse(codeBlocks[i][1].trim(), `code-block-${i}`);
    if (data) return { data, parseAttempts };
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) {
    data = tryParse(balanced, 'balanced-braces');
    if (data) return { data, parseAttempts };
  }

  const greedyObject = trimmed.match(/\{[\s\S]*\}/);
  if (greedyObject) {
    data = tryParse(greedyObject[0], 'greedy-object');
    if (data) return { data, parseAttempts };
  }

  return { data: null, parseAttempts };
}

function deriveTagsFromText(title, topic) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'with', 'your', 'how', 'what', 'why',
    'from', 'by', 'is', 'are', 'was', 'were', 'of', 'at', 'as', 'it', 'this', 'that', 'new', 'latest'
  ]);
  const text = `${title || ''} ${topic || ''}`.toLowerCase();
  const words = text
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  const unique = [...new Set(words)];
  const year = String(new Date().getFullYear());
  const tags = unique.slice(0, 6);
  if (!tags.includes('vibe-coding')) tags.push('vibe-coding');
  if (!tags.includes('ai-coding')) tags.push('ai-coding');
  if (!tags.some(t => t.includes(year))) tags.push(year);
  return tags.slice(0, 8);
}

/**
 * Coerce / fill optional gaps before validation (logs what was auto-fixed).
 */
function normalizeArticleData(data, topic) {
  const applied = [];
  if (!data || typeof data !== 'object') {
    return { data, applied };
  }

  for (const field of ['title', 'seo_title', 'short_title', 'teaser_90', 'description_160', 'content_markdown']) {
    if (typeof data[field] === 'string') {
      const trimmed = data[field].trim();
      if (trimmed !== data[field]) {
        data[field] = trimmed;
        applied.push(`${field}:trimmed`);
      }
    }
  }

  if (typeof data.tags === 'string') {
    data.tags = data.tags.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
    applied.push('tags:coerced_from_string');
  }

  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    data.tags = deriveTagsFromText(data.title, topic);
    applied.push('tags:derived_from_title');
  } else {
    data.tags = data.tags
      .map(t => (typeof t === 'string' ? t.trim() : String(t)))
      .filter(Boolean)
      .slice(0, 8);
    if (data.tags.length < 3) {
      const extra = deriveTagsFromText(data.title, topic).filter(t => !data.tags.includes(t));
      data.tags = [...data.tags, ...extra].slice(0, 8);
      applied.push('tags:padded_from_title');
    }
  }

  return { data, applied };
}

function summarizeArticlePayload(data) {
  if (!data || typeof data !== 'object') {
    return { keys: [], fieldLengths: {} };
  }
  const fieldLengths = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === 'string') fieldLengths[key] = val.length;
    else if (Array.isArray(val)) fieldLengths[key] = val.length;
    else fieldLengths[key] = typeof val;
  }
  return { keys: Object.keys(data), fieldLengths };
}

function getArticleValidationIssues(data) {
  const issues = [];
  if (!data || typeof data !== 'object') {
    return [{ code: 'invalid_payload', message: 'Response is not a JSON object' }];
  }

  for (const field of ARTICLE_REQUIRED_FIELDS) {
    if (!data[field]) {
      issues.push({ code: 'missing', field });
    }
  }

  if (data.tags != null && !Array.isArray(data.tags)) {
    issues.push({ code: 'invalid_type', field: 'tags', actual: typeof data.tags });
  }

  if (data.tags && Array.isArray(data.tags) && data.tags.length === 0) {
    issues.push({ code: 'empty_array', field: 'tags' });
  }

  const markdown = String(data.content_markdown || '');
  const markdownWithoutCode = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');

  if (/^#\s+/m.test(markdownWithoutCode)) {
    issues.push({ code: 'h1_in_body', field: 'content_markdown' });
  }
  if (data.content_markdown && !/^##\s+/m.test(markdownWithoutCode)) {
    issues.push({ code: 'missing_h2', field: 'content_markdown' });
  }

  return issues;
}

function buildArticleRetryUserMessage(issues) {
  const parts = issues.map((issue) => {
    if (issue.code === 'missing') return `missing "${issue.field}"`;
    if (issue.code === 'empty_array') return `"${issue.field}" must be a non-empty array`;
    if (issue.code === 'invalid_type') return `"${issue.field}" must be an array (got ${issue.actual})`;
    if (issue.code === 'h1_in_body') return 'content_markdown must not contain H1 (# heading); use H2/H3 only';
    if (issue.code === 'missing_h2') return 'content_markdown must include at least one H2 (## heading)';
    return issue.message || issue.code;
  });
  return `Your previous reply was invalid. Fix and return ONLY the complete JSON object (no markdown fences, no prose). Problems: ${parts.join('; ')}. Required top-level keys: ${ARTICLE_REQUIRED_FIELDS.join(', ')}. tags must be an array of 5-8 English strings.`;
}

function validateArticleData(data) {
  const issues = getArticleValidationIssues(data);
  const missingFields = issues.filter(i => i.code === 'missing').map(i => i.field);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  if (!Array.isArray(data.tags)) {
    throw new Error('Tags must be an array');
  }

  const h1Issue = issues.find(i => i.code === 'h1_in_body');
  if (h1Issue) {
    throw new Error('content_markdown must NOT contain an H1 heading — the `title` field is rendered as the page H1. Use H2/H3 inside the body.');
  }

  const h2Issue = issues.find(i => i.code === 'missing_h2');
  if (h2Issue) {
    throw new Error('Article must include at least one H2 heading');
  }

  return true;
}

function formatArticleForFirebase(articleData, topic) {
  const articleSlug = slugify(articleData.title);

  return {
    topic: topic.trim(),
    title: articleData.title,
    seo_title: articleData.seo_title,
    short_title: articleData.short_title,
    teaser_90: articleData.teaser_90,
    description_160: articleData.description_160,
    metaDescription: articleData.description_160,
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
 * ISO week key (e.g. 2026-W14) for "today" in a given IANA timezone.
 */
function getIsoWeekKeyForTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const dt = new Date(utcNoon);
  const wy = getISOWeekYear(dt);
  const ww = getISOWeek(dt);
  return `${wy}-W${String(ww).padStart(2, '0')}`;
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
   * Single generic topic (legacy): tools context + one line.
   */
  async generateTopic() {
    const openaiClient = this.getOpenAIClient();
    const requestId = `topic-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info({ requestId }, '[articles-automation] Generating article topic');

    try {
      const recentToolsSnapshot = await db.collection('tools')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const recentTools = recentToolsSnapshot.docs.map(doc => doc.data().name);

      const topicPrompt = `SEARCH THE WEB right now for the freshest news in developer tools, vibe coding, AI-assisted development, agentic workflows, and AI coding agents from the last 7-30 days.

Then propose ONE article topic anchored in an actual launch, release, version bump, benchmark, controversy, or trend from that window.

Hard rules:
- The topic MUST be tied to a real event published within the last 30 days. No evergreen / generic topics.
- Do NOT invent or paraphrase events that don't exist.
- Specific enough to write a detailed, example-heavy article around (5-12 words).

${recentTools.length > 0 ? `Recent tools we already covered (avoid duplicates): ${recentTools.join(', ')}` : ''}

Return ONLY the topic string in English (no JSON, no quotes, no prefix). One line only.`;

      const response = await openaiClient.chatCompletion({
        model: process.env.ARTICLES_OPENAI_MODEL || 'gpt-4o-mini-search-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a content strategist for a developer tools blog. You MUST use the web search tool to ground every suggestion in events from the past 7-30 days. Output English only.'
          },
          {
            role: 'user',
            content: topicPrompt
          }
        ],
        max_tokens: 200,
        web_search_options: {}
      });

      const rawTopic = response.choices[0]?.message?.content?.trim();

      if (!rawTopic) {
        throw new Error('No topic generated');
      }

      // Search-preview models may prefix the topic with a sentence (e.g. "Based on recent news: 'X'.").
      // Take the first non-empty line and strip wrapping quotes / trailing punctuation.
      const firstLine = rawTopic.split(/\r?\n/).map(l => l.trim()).find(Boolean) || rawTopic;
      const cleanTopic = firstLine
        .replace(/^(?:topic\s*[:\-]\s*|here(?:'s| is) (?:a |the )?topic\s*[:\-]\s*)/i, '')
        .replace(/^["'`“”‘’]+|["'`“”‘’.!?\s]+$/g, '')
        .trim();

      logger.info({ requestId, topic: cleanTopic, raw: rawTopic.substring(0, 200) }, '[articles-automation] Topic generated');

      return cleanTopic;
    } catch (error) {
      logger.error({ requestId, error: error.message }, '[articles-automation] Failed to generate topic');
      return 'Latest AI coding tools and techniques for 2025';
    }
  }

  /**
   * Weekly batch: topics grounded in vibe coding + AI (model knowledge; not live web).
   */
  async generateWeeklyTopics(count, recentTitles) {
    const openaiClient = this.getOpenAIClient();
    const requestId = `weekly-topics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const titlesBlock = recentTitles.length
      ? `Recent article titles to avoid duplicating themes:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : 'No recent titles available.';

    const userPrompt = `You are planning ${count} distinct blog posts.

MANDATORY: SEARCH THE WEB right now. Every topic must be grounded in something real that happened in the last 7-30 days — a launch, release, version bump, benchmark, controversy, blog post, or trend in:
- vibe coding / AI-assisted development
- AI coding agents, agentic workflows, CLI assistants
- IDE integrations (Cursor, Windsurf, Copilot, Zed, etc.)
- Spec-driven dev, prompt engineering, RAG, evals

${titlesBlock}

Return ONLY a valid JSON object (no prose, no markdown fences) of the form:
{"topics":["Topic one in English","Topic two", ...]}

Hard rules:
- Exactly ${count} topics in the array.
- Each topic: 6-14 words, specific, article-ready, English only.
- Each topic MUST tie to an actual event from the past 30 days. No evergreen / generic topics.
- Do NOT fabricate events. If you can't find ${count} fresh angles, repeat-search; if still short, return as many real ones as you found.
- No overlap with each other or with the recent titles above.`;

    logger.info({ requestId, count }, '[articles-automation] Generating fresh topic list');

    const response = await openaiClient.chatCompletion({
      model: process.env.ARTICLES_OPENAI_MODEL || 'gpt-4o-mini-search-preview',
      messages: [
        {
          role: 'system',
          content: 'You output only valid JSON. All topic strings must be English and grounded in events from the past 7-30 days. Use the web search tool.'
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 1200,
      web_search_options: {}
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response for weekly topics');
    }

    const { data: parsed, parseAttempts } = extractJsonFromLlmContent(content);
    if (!parsed) {
      logger.error({
        requestId,
        parseAttempts,
        contentLength: content.length,
        contentPreview: content.substring(0, 600)
      }, '[articles-automation] Failed to extract weekly topics JSON');
      throw new Error(`Failed to parse topics JSON (${parseAttempts.map(a => a.stage).join(', ')})`);
    }

    const topics = Array.isArray(parsed.topics) ? parsed.topics : null;
    if (!topics || topics.length === 0) {
      throw new Error('Weekly topics response missing non-empty "topics" array');
    }

    const cleaned = topics
      .map(t => (typeof t === 'string' ? t.replace(/^["']|["']$/g, '').trim() : ''))
      .filter(Boolean);

    if (cleaned.length === 0) {
      throw new Error('No usable topics after parsing');
    }

    return cleaned.slice(0, count);
  }

  async fetchRecentArticleTitles(limit = 25) {
    try {
      const snapshot = await db.collection(ARTICLES_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data().title).filter(Boolean);
    } catch (err) {
      logger.warn({ error: err.message }, '[articles-automation] Could not load recent titles (orderBy); falling back');
      const snapshot = await db.collection(ARTICLES_COLLECTION).limit(limit).get();
      return snapshot.docs.map(doc => doc.data().title).filter(Boolean);
    }
  }

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
   * Generate one article from a topic; optionally skip per-article sitemap (batch updates once).
   */
  async generateAndSaveArticle(requestId, topic, dryRun, skipSitemap) {
    const openaiClient = this.getOpenAIClient();
    const model = process.env.ARTICLES_OPENAI_MODEL || 'gpt-4o-mini-search-preview';

    const prompt = {
      system: articleGenerationPrompt.system,
      developer: articleGenerationPrompt.developer,
      user: articleGenerationPrompt.user(topic)
    };

    const baseUserContent = `${prompt.developer}\n\n${prompt.user}`;
    let messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: baseUserContent }
    ];

    let articleData = null;
    let lastContent = null;
    let lastParseAttempts = [];
    let lastValidationIssues = [];

    for (let attempt = 1; attempt <= ARTICLE_GEN_MAX_ATTEMPTS; attempt++) {
      logger.info({
        requestId,
        topic,
        attempt,
        maxAttempts: ARTICLE_GEN_MAX_ATTEMPTS,
        model
      }, '[articles-automation] Calling OpenAI API for article generation');

      const response = await openaiClient.chatCompletion({
        model,
        messages,
        max_tokens: 4000,
        web_search_options: {}
      });

      const content = response.choices[0]?.message?.content;
      lastContent = content;

      if (!content) {
        logger.warn({
          requestId,
          attempt,
          model,
          finishReason: response.choices[0]?.finish_reason,
          usage: response.usage
        }, '[articles-automation] OpenAI returned empty article content');

        if (attempt < ARTICLE_GEN_MAX_ATTEMPTS) {
          messages = [
            ...messages,
            { role: 'user', content: 'Your previous response was empty. Return ONLY the full JSON object for the article (all required keys).' }
          ];
          continue;
        }
        throw new Error('No content in OpenAI response');
      }

      const { data, parseAttempts } = extractJsonFromLlmContent(content);
      lastParseAttempts = parseAttempts;

      if (!data) {
        logger.warn({
          requestId,
          attempt,
          model,
          parseAttempts,
          contentLength: content.length,
          contentPreview: content.substring(0, 800),
          finishReason: response.choices[0]?.finish_reason
        }, '[articles-automation] Could not extract article JSON from model response');

        if (attempt < ARTICLE_GEN_MAX_ATTEMPTS) {
          messages = [
            ...messages,
            { role: 'assistant', content },
            {
              role: 'user',
              content: 'Return ONLY a single valid JSON object matching the required schema. No markdown fences, no prose before or after the JSON.'
            }
          ];
          continue;
        }

        logger.error({
          requestId,
          attempt,
          model,
          parseAttempts,
          contentLength: content.length,
          contentPreview: content.substring(0, 1200),
          contentTail: content.length > 400 ? content.substring(content.length - 400) : undefined
        }, '[articles-automation] Failed to extract article JSON after all attempts');

        throw new Error('Failed to parse article JSON from OpenAI response');
      }

      const { data: normalized, applied } = normalizeArticleData(data, topic);
      if (applied.length > 0) {
        logger.warn({
          requestId,
          attempt,
          applied,
          payloadSummary: summarizeArticlePayload(normalized)
        }, '[articles-automation] Applied article field fallbacks before validation');
      }

      const validationIssues = getArticleValidationIssues(normalized);
      lastValidationIssues = validationIssues;

      if (validationIssues.length > 0) {
        logger.warn({
          requestId,
          attempt,
          model,
          validationIssues,
          payloadSummary: summarizeArticlePayload(normalized),
          parseAttempts
        }, '[articles-automation] Article JSON failed validation');

        if (attempt < ARTICLE_GEN_MAX_ATTEMPTS) {
          messages = [
            ...messages,
            { role: 'assistant', content },
            { role: 'user', content: buildArticleRetryUserMessage(validationIssues) }
          ];
          continue;
        }

        logger.error({
          requestId,
          attempt,
          model,
          validationIssues,
          payloadSummary: summarizeArticlePayload(normalized),
          parseAttempts,
          contentPreview: content.substring(0, 800)
        }, '[articles-automation] Article validation failed after all attempts');

        validateArticleData(normalized);
      }

      articleData = normalized;
      if (attempt > 1) {
        logger.info({ requestId, attempt, topic }, '[articles-automation] Article generation succeeded after retry');
      }
      break;
    }

    if (!articleData) {
      logger.error({
        requestId,
        model,
        lastParseAttempts,
        lastValidationIssues,
        contentLength: lastContent ? lastContent.length : 0,
        contentPreview: lastContent ? lastContent.substring(0, 1200) : null
      }, '[articles-automation] Article generation exhausted retries without valid payload');
      throw new Error('Failed to parse article JSON from OpenAI response');
    }

    const articleFirebase = formatArticleForFirebase(articleData, topic);

    let exists = await this.articleExists(articleFirebase.slug);
    if (exists) {
      articleFirebase.slug = `${articleFirebase.slug}-${Date.now()}`;
      logger.warn({ requestId, newSlug: articleFirebase.slug }, '[articles-automation] Slug conflict resolved');
    }

    let articleId = null;
    if (!dryRun) {
      const existsAgain = await this.articleExists(articleFirebase.slug);
      if (existsAgain) {
        articleFirebase.slug = `${articleFirebase.slug}-${Date.now()}`;
      }

      const docRef = await db.collection(ARTICLES_COLLECTION).add(articleFirebase);
      articleId = docRef.id;

      logger.info({ requestId, articleId, slug: articleFirebase.slug, title: articleData.title }, '[articles-automation] Article saved');

      try {
        const jekyllResult = await writeJekyllPostForArticle(articleFirebase);
        await docRef.update({
          jekyll_permalink: jekyllResult.jekyll_permalink,
          jekyll_post_path: jekyllResult.jekyll_post_path
        });
        logger.info({
          requestId,
          slug: articleFirebase.slug,
          jekyll_permalink: jekyllResult.jekyll_permalink
        }, '[articles-automation] Jekyll post published');
      } catch (jekyllError) {
        logger.warn({
          requestId,
          slug: articleFirebase.slug,
          error: jekyllError.message
        }, '[articles-automation] Jekyll post write failed (non-critical)');
      }

      if (!skipSitemap) {
        try {
          await generateAndSaveSitemap();
          logger.debug({ requestId }, '[articles-automation] Sitemap updated');
        } catch (sitemapError) {
          logger.warn({ requestId, error: sitemapError.message }, '[articles-automation] Failed to update sitemap (non-critical)');
        }
      }
    }

    return {
      articleId,
      topic,
      title: articleData.title,
      slug: articleFirebase.slug,
      articleFirebase
    };
  }

  async executeWeeklyBatch(options = {}) {
    const {
      dryRun = false,
      articleCount: articleCountOpt = null,
      skipWeekCheck = false
    } = options;

    const timezone = process.env.WEEKLY_ARTICLES_TIMEZONE
      || process.env.REPORT_TIMEZONE
      || 'UTC';

    let count = articleCountOpt != null
      ? parseInt(String(articleCountOpt), 10)
      : parseInt(process.env.WEEKLY_ARTICLES_COUNT || '3', 10);

    if (Number.isNaN(count) || count < 1) {
      count = 3;
    }
    count = Math.min(count, 10);

    const weekKey = getIsoWeekKeyForTimezone(timezone);
    const requestId = `article-writer-weekly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    logger.info({ requestId, weekKey, count, dryRun, skipWeekCheck }, '[articles-automation] Starting weekly article batch');

    const skipDup = process.env.WEEKLY_ARTICLES_SKIP_DUPLICATE_WEEK !== 'false';
    if (skipDup && !skipWeekCheck && !dryRun) {
      const stateRef = db.doc(AUTOMATION_STATE_DOC);
      const stateSnap = await stateRef.get();
      const lastKey = stateSnap.exists ? stateSnap.data().lastSuccessfulWeekKey : null;
      if (lastKey === weekKey) {
        logger.info({ requestId, weekKey }, '[articles-automation] Weekly batch skipped (already completed this ISO week)');
        return {
          success: true,
          skipped: true,
          reason: 'already_ran_this_week',
          weekKey,
          dryRun
        };
      }
    }

    const recentTitles = await this.fetchRecentArticleTitles(25);
    const topics = await this.generateWeeklyTopics(count, recentTitles);

    const results = [];
    const errors = [];

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const subId = `${requestId}-t${i + 1}`;
      try {
        const one = await this.generateAndSaveArticle(subId, topic, dryRun, true);
        results.push(one);
      } catch (err) {
        logger.error({
          requestId: subId,
          topic,
          failureKind: classifyArticleJobError(err.message),
          error: { message: err.message, stack: err.stack }
        }, '[articles-automation] Weekly batch article failed');
        errors.push({ topic, message: err.message, failureKind: classifyArticleJobError(err.message) });
      }
    }

    if (!dryRun && results.length > 0) {
      try {
        await generateAndSaveSitemap();
        logger.debug({ requestId }, '[articles-automation] Sitemap updated after weekly batch');
      } catch (sitemapError) {
        logger.warn({ requestId, error: sitemapError.message }, '[articles-automation] Batch sitemap update failed (non-critical)');
      }
    }

    if (errors.length === topics.length && topics.length > 0) {
      throw new Error(`Weekly batch failed for all ${topics.length} topic(s): ${errors.map(e => e.message).join('; ')}`);
    }

    const allRequestedOk = errors.length === 0 && results.length === topics.length;
    if (allRequestedOk && !dryRun && skipDup) {
      await db.doc(AUTOMATION_STATE_DOC).set({
        lastSuccessfulWeekKey: weekKey,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastTopics: topics,
        lastArticleIds: results.map(r => r.articleId).filter(Boolean)
      }, { merge: true });
    }

    const duration = Date.now() - startedAt.getTime();

    logger.info({
      requestId,
      weekKey,
      published: results.length,
      failed: errors.length,
      duration: `${duration}ms`,
      dryRun
    }, '[articles-automation] Weekly article batch finished');

    return {
      success: true,
      weeklyBatch: true,
      weekKey,
      topics,
      articles: results,
      errors,
      duration,
      dryRun,
      skipped: false
    };
  }

  /**
   * Execute the job
   * @param {Object} options - dryRun, topic, weeklyBatch, articleCount, skipWeekCheck
   */
  async execute(options = {}) {
    const {
      dryRun = false,
      topic: providedTopic = null,
      weeklyBatch = false,
      articleCount = null,
      skipWeekCheck = false
    } = options;

    if (weeklyBatch) {
      return this.executeWeeklyBatch({ dryRun, articleCount, skipWeekCheck });
    }

    const requestId = `article-writer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    logger.info({ requestId, dryRun, providedTopic }, '[articles-automation] Starting article writer job (single)');

    try {
      const topic = providedTopic || await this.generateTopic();

      if (!topic || topic.trim().length === 0) {
        throw new Error('No topic available for article generation');
      }

      const one = await this.generateAndSaveArticle(requestId, topic, dryRun, false);

      const duration = Date.now() - startedAt.getTime();

      logger.info({
        requestId,
        articleId: one.articleId,
        topic,
        title: one.title,
        duration: `${duration}ms`,
        dryRun
      }, '[articles-automation] Article writer job completed');

      return {
        success: true,
        requestId,
        article: {
          id: one.articleId,
          topic,
          title: one.title,
          slug: one.slug,
          ...one.articleFirebase
        },
        duration,
        dryRun
      };
    } catch (error) {
      logger.error({
        requestId,
        topic: providedTopic,
        dryRun,
        failureKind: classifyArticleJobError(error.message),
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
  ArticleWriterJob,
  getIsoWeekKeyForTimezone,
  extractJsonFromLlmContent,
  normalizeArticleData,
  getArticleValidationIssues,
  classifyArticleJobError
};
