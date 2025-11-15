// Live Brief Modal - Voice Input Component with OpenAI Whisper API
// Replaces initial 3-questions modal with voice recording interface

class LiveBriefModal {
  constructor() {
    this.sessionId = null;
    this.isRecording = false;
    this.fullTranscript = '';
    this.summary = '';
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.summaryPollInterval = null;
    this.animationFrameId = null;
    this.rippleAnimationId = null;
    
    // DOM elements
    this.modal = null;
    this.microphoneIcon = null;
    this.summaryText = null;
    
    this.init();
  }

  init() {
    this.createModalHTML();
    this.setupEventListeners();
  }

  createModalHTML() {
    // Create modal structure
    const modalHTML = `
      <div id="liveBriefModal" class="live-brief-modal-overlay" style="display: none;">
        <div class="live-brief-modal-content">
          <div class="live-brief-modal-header">
            <h3>Live Brief</h3>
            <button class="live-brief-switch-to-typing" id="switchToTypingBtn">Switch to typing</button>
          </div>
          
          <div class="live-brief-modal-body">
            <div class="live-brief-prompt">Tell me about your idea</div>
            
            <div class="live-brief-microphone-container">
              <div class="live-brief-microphone-wrapper">
                <div class="live-brief-ripple-ring"></div>
                <div class="live-brief-ripple-ring"></div>
                <div class="live-brief-ripple-ring"></div>
                <div class="live-brief-microphone-icon" id="liveBriefMicrophone">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </div>
              </div>
            </div>
            
            <div class="live-brief-summary-container">
              <div id="liveBriefSummary" class="live-brief-summary-text"></div>
            </div>
          </div>
          
          <div class="live-brief-modal-footer">
            <button class="live-brief-btn live-brief-btn-stop" id="stopRecordingBtn" style="display: none;">Stop</button>
            <button class="live-brief-btn live-brief-btn-primary" id="useThisBtn" style="display: none;">Use This</button>
            <button class="live-brief-btn live-brief-btn-secondary" id="cancelBtn">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Inject into body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store references
    this.modal = document.getElementById('liveBriefModal');
    this.microphoneIcon = document.getElementById('liveBriefMicrophone');
    this.summaryText = document.getElementById('liveBriefSummary');
  }

  setupEventListeners() {
    // Switch to typing button
    document.getElementById('switchToTypingBtn').addEventListener('click', () => {
      this.switchToTyping();
    });
    
    // Stop recording button
    document.getElementById('stopRecordingBtn').addEventListener('click', () => {
      this.stopRecording();
    });
    
    // Use This button
    document.getElementById('useThisBtn').addEventListener('click', () => {
      this.useThis();
    });
    
    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.close();
    });
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  async open() {
    // Generate session ID
    this.sessionId = `live-brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Request microphone permission and start recording
    try {
      await this.startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      // If permission denied, fallback to 3-questions modal
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.close();
        // Open existing 3-questions modal
        if (typeof proceedWithAppPlanning === 'function') {
          proceedWithAppPlanning();
        }
        return;
      }
      // Show error but keep modal open
      this.showError('Failed to access microphone. Please check your permissions.');
    }
  }

  close() {
    this.stopRecording();
    this.modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    this.cleanup();
  }

  cleanup() {
    // Stop all recording and polling
    this.stopRecording();
    
    // Clear intervals
    if (this.summaryPollInterval) {
      clearInterval(this.summaryPollInterval);
      this.summaryPollInterval = null;
    }
    
    // Clear animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Stop ripple animation
    this.stopRippleAnimation();
    
    // Reset state
    this.fullTranscript = '';
    this.summary = '';
    this.sessionId = null;
  }

  async startRecording() {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Setup MediaRecorder for audio capture
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      // Fallback to default if webm not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }
      
    this.mediaRecorder = new MediaRecorder(stream, options);
    
    this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Send audio chunk immediately for transcription
          await this.sendAudioChunkForTranscription(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        // Final audio chunk if any remaining
        // (Most chunks are sent via ondataavailable)
      };
      
      // Setup AudioContext for amplitude detection (for ripple animation)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      // Start recording
      this.mediaRecorder.start(3000); // Collect chunks every 3 seconds
      
      // Start ripple animation
      this.startRippleAnimation();
      
      // Start amplitude monitoring for ripple intensity
      this.monitorAmplitude();
      
      // Start recording state
      this.isRecording = true;
      document.getElementById('stopRecordingBtn').style.display = 'block';
      document.getElementById('useThisBtn').style.display = 'none';
      
      // Start polling for summary updates
      this.startSummaryPolling();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stopRecording() {
    this.isRecording = false;
    
    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Stop AudioContext
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Stop all tracks
    if (this.mediaRecorder && this.mediaRecorder.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Stop ripple animation
    this.stopRippleAnimation();
    
    // Update UI
    document.getElementById('stopRecordingBtn').style.display = 'none';
    if (this.summary || this.fullTranscript) {
      document.getElementById('useThisBtn').style.display = 'block';
    }
    
    // Clear polling
    if (this.summaryPollInterval) {
      clearInterval(this.summaryPollInterval);
      this.summaryPollInterval = null;
    }
    
    // Final summary update
    if (this.fullTranscript) {
      this.updateSummary();
    }
  }

  startRippleAnimation() {
    if (!this.microphoneIcon) return;
    
    const wrapper = this.microphoneIcon.closest('.live-brief-microphone-wrapper');
    if (!wrapper) return;
    
    const rings = wrapper.querySelectorAll('.live-brief-ripple-ring');
    rings.forEach((ring, index) => {
      ring.style.animation = `ripple 2s ease-out infinite`;
      ring.style.animationDelay = `${index * 0.4}s`;
    });
    
    wrapper.classList.add('recording');
  }

  stopRippleAnimation() {
    if (!this.microphoneIcon) return;
    
    const wrapper = this.microphoneIcon.closest('.live-brief-microphone-wrapper');
    if (!wrapper) return;
    
    const rings = wrapper.querySelectorAll('.live-brief-ripple-ring');
    rings.forEach(ring => {
      ring.style.animation = 'none';
    });
    
    wrapper.classList.remove('recording');
  }

  monitorAmplitude() {
    if (!this.analyser || !this.isRecording) {
      return;
    }
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const check = () => {
      if (!this.isRecording || !this.analyser) {
        return;
      }
      
      this.animationFrameId = requestAnimationFrame(check);
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Adjust ripple intensity based on amplitude
      const intensity = Math.min(average / 100, 1); // Normalize to 0-1
      
      if (this.microphoneIcon) {
        const wrapper = this.microphoneIcon.closest('.live-brief-microphone-wrapper');
        if (wrapper) {
          wrapper.style.setProperty('--amplitude', intensity);
        }
      }
    };
    
    check();
  }

  async sendAudioChunkForTranscription(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) return;
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('sessionId', this.sessionId);
      
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
      
      const response = await fetch(`${apiBaseUrl}/api/live-brief/transcribe-audio`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.transcript) {
        // Append to full transcript
        this.fullTranscript += (this.fullTranscript ? ' ' : '') + data.transcript;
        
        // Trigger summary update
        this.updateSummary();
      }
      
    } catch (error) {
      console.error('Error sending audio for transcription:', error);
      // Don't show error to user, just log it
    }
  }

  startSummaryPolling() {
    // Poll every 3 seconds for summary updates
    this.summaryPollInterval = setInterval(() => {
      if (this.isRecording && this.fullTranscript) {
        this.updateSummary();
      }
    }, 3000);
    
    // Initial update after 2 seconds
    setTimeout(() => {
      if (this.isRecording && this.fullTranscript) {
        this.updateSummary();
      }
    }, 2000);
  }

  async updateSummary() {
    if (!this.fullTranscript || !this.sessionId) {
      return;
    }
    
    try {
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
      
      const response = await fetch(`${apiBaseUrl}/api/live-brief/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          fullTranscript: this.fullTranscript
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.summary) {
        this.summary = data.summary;
        this.displaySummary(this.summary);
      }
    } catch (error) {
      console.error('Error updating summary:', error);
      // Don't show error to user, just log it
    }
  }

  displaySummary(text) {
    if (!this.summaryText) return;
    
    // Simple typing effect
    this.summaryText.textContent = text;
    
    // Add fade-in effect
    this.summaryText.style.opacity = '0';
    setTimeout(() => {
      this.summaryText.style.transition = 'opacity 0.3s ease';
      this.summaryText.style.opacity = '1';
    }, 10);
  }

  async useThis() {
    if (!this.summary && !this.fullTranscript) {
      this.showError('No content to use. Please record something first.');
      return;
    }
    
    // Show loading state
    const useThisBtn = document.getElementById('useThisBtn');
    const originalText = useThisBtn.textContent;
    useThisBtn.textContent = 'Processing...';
    useThisBtn.disabled = true;
    
    try {
      // Convert summary + full transcript to 3 answers
      const answers = await this.convertToAnswers();
      
      if (!answers || answers.length !== 3) {
        throw new Error('Invalid answers format');
      }
      
      // Set global answers variable (from index.js scope)
      // Since answers is in index.js scope, we need to set it via window
      if (typeof window !== 'undefined') {
        // Set on window for access from index.js
        window.liveBriefAnswers = answers;
        window.liveBriefSelectedPlatforms = window.selectedPlatforms || { mobile: false, web: false };
      }
      
      // Close modal
      this.close();
      
      // Call existing generateSpecification function
      if (typeof generateSpecification === 'function') {
        generateSpecification();
      } else {
        console.error('generateSpecification function not found');
        this.showError('Error: Could not generate specification.');
      }
      
    } catch (error) {
      console.error('Error converting to answers:', error);
      this.showError('Failed to process your brief. Please try again.');
      useThisBtn.textContent = originalText;
      useThisBtn.disabled = false;
    }
  }

  async convertToAnswers() {
    const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
    
    const response = await fetch(`${apiBaseUrl}/api/live-brief/convert-to-answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: this.summary || '',
        fullTranscript: this.fullTranscript || ''
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.answers;
  }

  switchToTyping() {
    // Stop recording
    this.stopRecording();
    
    // Close modal
    this.close();
    
    // Open existing 3-questions modal
    if (typeof proceedWithAppPlanning === 'function') {
      proceedWithAppPlanning();
    } else if (typeof showModernInput === 'function') {
      // Optionally pre-populate with partial summary
      const prefillData = this.summary ? [this.summary, '', ''] : null;
      showModernInput(prefillData);
    }
  }

  showError(message) {
    // Simple error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'live-brief-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 100001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.transition = 'opacity 0.3s ease';
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.LiveBriefModal = LiveBriefModal;
}
