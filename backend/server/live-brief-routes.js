const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');

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
router.post('/transcribe-audio', upload.single('audio'), async (req, res) => {
  const requestId = `transcribe-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    console.log(`[${requestId}] Processing audio for session: ${sessionId}`);
    console.log(`[${requestId}] Audio size: ${req.file.size} bytes`);
    console.log(`[${requestId}] Audio type: ${req.file.mimetype}`);
    
    // Transcribe using OpenAI Whisper API
    const transcript = await transcribeWithWhisper(req.file.buffer, req.file.mimetype, requestId);
    
    if (!transcript || transcript.trim().length === 0) {
      return res.json({
        transcript: '',
        sessionId: sessionId
      });
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] Transcription completed in ${processingTime}ms`);
    console.log(`[${requestId}] Transcript length: ${transcript.length} characters`);
    
    res.json({
      transcript: transcript,
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error transcribing audio:`, error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error.message
    });
  }
});

/**
 * POST /api/live-brief/transcribe
 * Accept transcript chunks and return updated summary
 */
router.post('/transcribe', async (req, res) => {
  const requestId = `transcribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    const { sessionId, fullTranscript } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    if (!fullTranscript || fullTranscript.trim().length === 0) {
      return res.json({
        summary: '',
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log(`[${requestId}] Processing transcript for session: ${sessionId}`);
    console.log(`[${requestId}] Transcript length: ${fullTranscript.length} characters`);
    
    // Generate summary using OpenAI
    const summary = await generateSummary(fullTranscript, requestId);
    
    // Store summary for session
    sessionSummaries.set(sessionId, {
      summary,
      transcript: fullTranscript,
      updatedAt: new Date().toISOString()
    });
    
    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] Summary generated in ${processingTime}ms`);
    
    res.json({
      summary,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error processing transcript:`, error);
    res.status(500).json({
      error: 'Failed to process transcript',
      details: error.message
    });
  }
});

/**
 * POST /api/live-brief/convert-to-answers
 * Convert summary + full transcript to 3 answers format
 * Answer 3 = full transcript text
 */
router.post('/convert-to-answers', async (req, res) => {
  const requestId = `convert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    const { summary, fullTranscript } = req.body;
    
    if (!summary && !fullTranscript) {
      return res.status(400).json({ error: 'summary or fullTranscript is required' });
    }
    
    console.log(`[${requestId}] Converting to answers`);
    console.log(`[${requestId}] Summary length: ${summary?.length || 0}`);
    console.log(`[${requestId}] Transcript length: ${fullTranscript?.length || 0}`);
    
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
    console.log(`[${requestId}] Answers extracted in ${processingTime}ms`);
    console.log(`[${requestId}] Answer lengths: [${answer1.length}, ${answer2.length}, ${answer3.length}]`);
    
    res.json({
      answers
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error converting to answers:`, error);
    res.status(500).json({
      error: 'Failed to convert to answers',
      details: error.message
    });
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
