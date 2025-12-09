'use client';

import { useState, useEffect, useRef } from 'react';
import {
  transcribeTranscript,
  convertToAnswers,
  generateSessionId,
} from '@/lib/api/live-brief';

interface LiveBriefProps {
  onAnswersReady: (answers: string[]) => void;
  onClose?: () => void;
  currentQuestion: number;
  questionText: string;
}

export function LiveBrief({
  onAnswersReady,
  onClose,
  currentQuestion,
  questionText,
}: LiveBriefProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [fullTranscript, setFullTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>(generateSessionId());
  const microphoneWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      // Check if Web Speech API is available
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error(
          'Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.'
        );
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Setup AudioContext for amplitude detection
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start amplitude monitoring
      monitorAmplitude();

      // Setup Web Speech API
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const browserLanguage =
        navigator.language || (navigator as any).userLanguage || 'en-US';
      recognition.lang = browserLanguage;
      setLanguage(browserLanguage.split('-')[0]);

      recognition.onresult = (event: any) => {
        if (!isRecording) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setFullTranscript((prev) => prev + final);
          setInterimTranscript('');
          // Update summary asynchronously
          updateSummary(fullTranscript + final);
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          return; // Normal, ignore
        }

        if (event.error === 'not-allowed') {
          setError('Microphone permission denied');
          stopRecording();
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecording && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore
          }
        }
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);

    if (recognitionRef.current) {
      recognitionRef.current.onresult = () => {};
      recognitionRef.current.onerror = () => {};
      recognitionRef.current.onend = () => {};
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    stopRippleAnimation();
  };

  const monitorAmplitude = () => {
    if (!analyserRef.current || !isRecording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const check = () => {
      if (!isRecording || !analyserRef.current) return;

      animationFrameRef.current = requestAnimationFrame(check);
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const intensity = Math.min(average / 100, 1);

      if (microphoneWrapperRef.current) {
        microphoneWrapperRef.current.style.setProperty(
          '--amplitude',
          String(intensity)
        );
      }
    };

    check();
  };

  const updateSummary = async (transcript: string) => {
    try {
      const result = await transcribeTranscript(sessionIdRef.current, transcript);
      if (result.success && result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      // Silently fail - summary is optional
    }
  };

  const startRippleAnimation = () => {
    if (microphoneWrapperRef.current) {
      microphoneWrapperRef.current.classList.add('recording');
    }
  };

  const stopRippleAnimation = () => {
    if (microphoneWrapperRef.current) {
      microphoneWrapperRef.current.classList.remove('recording');
    }
  };

  useEffect(() => {
    if (isRecording) {
      startRippleAnimation();
    } else {
      stopRippleAnimation();
    }
  }, [isRecording]);

  const handleGenerate = async () => {
    if (!fullTranscript && !summary) {
      setError('Please record some audio first');
      return;
    }

    try {
      const result = await convertToAnswers(
        sessionIdRef.current,
        summary || undefined,
        fullTranscript || undefined
      );

      if (result.success && result.answers) {
        onAnswersReady(result.answers);
      } else {
        setError(result.message || 'Failed to convert to answers');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate answers');
    }
  };

  const displayText = summary
    ? `${summary}\n\n${fullTranscript}${interimTranscript ? ` [Live: ${interimTranscript}]` : ''}`
    : `${fullTranscript}${interimTranscript ? ` [Live: ${interimTranscript}]` : ''}`;

  return (
    <div className="live-brief-container">
      <div className="live-brief-header">
        <h3 className="live-brief-title">Live Brief</h3>
        <div className="question-detail">{questionText}</div>
      </div>

      <div className="live-brief-body">
        <div className="live-brief-microphone-container">
          <div
            className="live-brief-microphone-wrapper"
            ref={microphoneWrapperRef}
          >
            <div className="live-brief-ripple-ring"></div>
            <div className="live-brief-ripple-ring"></div>
            <div className="live-brief-ripple-ring"></div>
            <div
              className="live-brief-microphone-icon"
              onClick={isRecording ? stopRecording : startRecording}
             
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
          </div>
        </div>

        <div className="live-brief-summary-container">
          <div className="live-brief-summary-text">
            {displayText || 'Click the microphone to start recording...'}
          </div>
          <div className="live-brief-language-indicator">{language}</div>
        </div>
      </div>

      <div className="live-brief-footer">
        {error && (
          <div className="live-brief-error">
            {error}
          </div>
        )}
        <button
          className="live-brief-btn live-brief-btn-primary"
          onClick={handleGenerate}
          disabled={!fullTranscript && !summary}
        >
          Generate
        </button>
        {onClose && (
          <button
            className="live-brief-btn live-brief-btn-secondary"
            onClick={onClose}
           
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}


