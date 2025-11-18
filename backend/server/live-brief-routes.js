const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// In-memory storage for session summaries (in production, use Redis or database)
const sessionSummaries = new Map();

/**
 * POST /api/live-brief/transcribe-audio
 * Accept audio file and transcribe using OpenAI Whisper API
 */
router.post('/transcribe-audio', upload.single('audio'), async (req, res, next) => {
  const requestId = req.requestId || `transcribe-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  logger.info({ requestId }, '[live-brief-routes] POST /transcribe-audio - Starting audio transcription');
  
  try {
    if (!req.file) {
      logger.warn({ requestId }, '[live-brief-routes] Audio file is required');
      return next(createError('Audio file is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    const { sessionId } = req.body;
    
    if (!sessionId) {
      logger.warn({ requestId }, '[live-brief-routes] sessionId is required');
      return next(createError('sessionId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    logger.debug({ requestId, sessionId, audioSize: req.file.size, audioType: req.file.mimetype }, '[live-brief-routes] Processing audio');
    
    // Transcribe using OpenAI Whisper API
    const transcript = await transcribeWithWhisper(req.file.buffer, req.file.mimetype, requestId);
    
    if (!transcript || transcript.trim().length === 0) {
      logger.debug({ requestId }, '[live-brief-routes] Empty transcript');
      return res.json({
        transcript: '',
        sessionId: sessionId
      });
    }
    
    const processingTime = Date.now() - startTime;
    logger.info({ requestId, processingTime, transcriptLength: transcript.length }, '[live-brief-routes] POST /transcribe-audio - Success');
    
    res.json({
      transcript: transcript,
      sessionId: sessionId
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error({ requestId, error: { message: error.message, stack: error.stack }, processingTime }, '[live-brief-routes] POST /transcribe-audio - Error');
    next(createError('Failed to transcribe audio', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/live-brief/transcribe
 * Accept transcript chunks and return updated summary
 */
router.post('/transcribe', async (req, res, next) => {
  const requestId = req.requestId || `transcribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  logger.info({ requestId }, '[live-brief-routes] POST /transcribe - Processing transcript');
  
  try {
    const { sessionId, fullTranscript } = req.body;
    
    if (!sessionId) {
      logger.warn({ requestId }, '[live-brief-routes] sessionId is required');
      return next(createError('sessionId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    if (!fullTranscript || fullTranscript.trim().length === 0) {
      return res.json({
        summary: '',
        updatedAt: new Date().toISOString()
      });
    }
    
    logger.debug({ requestId, sessionId, transcriptLength: fullTranscript?.length || 0 }, '[live-brief-routes] Processing transcript');
    
    // Generate summary using OpenAI
    const summary = await generateSummary(fullTranscript, requestId);
    
    // Store summary for session
    sessionSummaries.set(sessionId, {
      summary,
      transcript: fullTranscript,
      updatedAt: new Date().toISOString()
    });
    
    const processingTime = Date.now() - startTime;
    logger.info({ requestId, processingTime }, '[live-brief-routes] POST /transcribe - Success');
    
    res.json({
      summary,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error({ requestId, error: { message: error.message, stack: error.stack }, processingTime }, '[live-brief-routes] POST /transcribe - Error');
    next(createError('Failed to process transcript', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/live-brief/convert-to-answers
 * Convert summary + full transcript to 3 answers format
 * Answer 3 = full transcript text
 */
router.post('/convert-to-answers', async (req, res, next) => {
  const requestId = req.requestId || `convert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  logger.info({ requestId }, '[live-brief-routes] POST /convert-to-answers - Converting to answers');
  
  try {
    const { summary, fullTranscript } = req.body;
    
    if (!summary && !fullTranscript) {
      logger.warn({ requestId }, '[live-brief-routes] summary or fullTranscript is required');
      return next(createError('summary or fullTranscript is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    logger.debug({ requestId, summaryLength: summary?.length || 0, transcriptLength: fullTranscript?.length || 0 }, '[live-brief-routes] Converting to answers');
    
    // Extract answer1 and answer2 from summary using AI
    let answer1 = '';
    let answer2 = '';
    
    if (summary && summary.trim().length > 0) {
      const extracted = await extractAnswersFromSummary(summary, requestId);
      answer1 = extracted.answer1 || '';
      answer2 = extracted.answer2 || '';
    }
    
    // Answer 3 is always the full transcript
    const answer3 = fullTranscript || '';
    
    const answers = [answer1, answer2, answer3];
    
    const processingTime = Date.now() - startTime;
    logger.info({ requestId, processingTime, answerLengths: [answer1.length, answer2.length, answer3.length] }, '[live-brief-routes] POST /convert-to-answers - Success');
    
    res.json({
      answers
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error({ requestId, error: { message: error.message, stack: error.stack }, processingTime }, '[live-brief-routes] POST /convert-to-answers - Error');
    next(createError('Failed to convert to answers', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeWithWhisper(audioBuffer, mimeType, requestId) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.warn(`[${requestId}] OPENAI_API_KEY not set, cannot transcribe audio`);
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    
    // Determine file extension based on mime type
    let extension = 'webm';
    if (mimeType.includes('webm')) {
      extension = 'webm';
    } else if (mimeType.includes('mp4')) {
      extension = 'mp4';
    } else if (mimeType.includes('mpeg')) {
      extension = 'mp3';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    }
    
    formData.append('file', audioBuffer, {
      filename: `audio.${extension}`,
      contentType: mimeType
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Whisper API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.text) {
      return data.text.trim();
    }
    
    throw new Error('No transcript returned from Whisper API');
    
  } catch (error) {
    console.error(`[${requestId}] Error calling OpenAI Whisper API:`, error);
    throw error;
  }
}

/**
 * Generate summary from transcript using OpenAI
 */
async function generateSummary(transcript, requestId) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.warn(`[${requestId}] OPENAI_API_KEY not set, returning simple summary`);
    // Fallback: return first 500 characters as summary
    return transcript.substring(0, 500) + (transcript.length > 500 ? '...' : '');
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at summarizing spoken ideas about applications. Create a clear, structured summary that captures the main idea, problem being solved, key features, and target users. Keep it concise but comprehensive (200-400 words).'
          },
          {
            role: 'user',
            content: `Summarize this spoken transcript about an application idea:\n\n${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    
    throw new Error('No response from OpenAI');
    
  } catch (error) {
    console.error(`[${requestId}] Error calling OpenAI for summary:`, error);
    // Fallback: return first 500 characters
    return transcript.substring(0, 500) + (transcript.length > 500 ? '...' : '');
  }
}

/**
 * Extract answer1 and answer2 from summary using OpenAI
 */
async function extractAnswersFromSummary(summary, requestId) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.warn(`[${requestId}] OPENAI_API_KEY not set, using simple extraction`);
    // Fallback: split summary in half
    const midPoint = Math.floor(summary.length / 2);
    return {
      answer1: summary.substring(0, midPoint),
      answer2: summary.substring(midPoint)
    };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting structured information from summaries. Extract two answers from the summary: Answer 1 should describe the application (main idea, core features, target audience, problem it solves). Answer 2 should describe the workflow (user journey, step-by-step interactions, how users use the app). Return ONLY a JSON object with "answer1" and "answer2" keys, no other text.'
          },
          {
            role: 'user',
            content: `Extract answer1 (app description) and answer2 (workflow) from this summary:\n\n${summary}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      const content = data.choices[0].message.content.trim();
      try {
        const extracted = JSON.parse(content);
        return {
          answer1: extracted.answer1 || '',
          answer2: extracted.answer2 || ''
        };
      } catch (parseError) {
        console.error(`[${requestId}] Error parsing OpenAI response:`, parseError);
        // Fallback: split summary
        const midPoint = Math.floor(summary.length / 2);
        return {
          answer1: summary.substring(0, midPoint),
          answer2: summary.substring(midPoint)
        };
      }
    }
    
    throw new Error('No response from OpenAI');
    
  } catch (error) {
    console.error(`[${requestId}] Error calling OpenAI for extraction:`, error);
    // Fallback: split summary in half
    const midPoint = Math.floor(summary.length / 2);
    return {
      answer1: summary.substring(0, midPoint),
      answer2: summary.substring(midPoint)
    };
  }
}

module.exports = router;
