/**
 * Live Brief API
 * Handles voice transcription and conversion to answers
 */

import { apiClient } from './client';

export interface TranscribeResponse {
  success: boolean;
  summary?: string;
  fullTranscript?: string;
  sessionId?: string;
  message?: string;
}

export interface ConvertToAnswersResponse {
  success: boolean;
  answers?: string[];
  message?: string;
}

/**
 * Transcribe transcript using backend
 */
export async function transcribeTranscript(
  sessionId: string,
  fullTranscript: string
): Promise<TranscribeResponse> {
  return apiClient.post<TranscribeResponse>('/api/live-brief/transcribe', {
    sessionId,
    fullTranscript,
  });
}

/**
 * Convert summary/transcript to answers
 */
export async function convertToAnswers(
  sessionId: string,
  summary?: string,
  fullTranscript?: string
): Promise<ConvertToAnswersResponse> {
  return apiClient.post<ConvertToAnswersResponse>(
    '/api/live-brief/convert-to-answers',
    {
      sessionId,
      summary,
      fullTranscript,
    }
  );
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


