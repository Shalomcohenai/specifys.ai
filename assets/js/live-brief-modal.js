// Live Brief Modal - Voice Input Component with Web Speech API
// Replaces initial 3-questions modal with voice recording interface
// Uses browser's built-in speech recognition (no backend transcription needed)

class LiveBriefModal {
  constructor() {
    this.sessionId = null;
    this.isRecording = false;
    this.fullTranscript = '';
    this.summary = '';
    this.mediaRecorder = null;
    this.mediaStream = null; // Store stream for cleanup
    this.audioContext = null;
    this.analyser = null;
    this.summaryPollInterval = null;
    this.animationFrameId = null;
    this.rippleAnimationId = null;
    this.recognition = null; // Web Speech API
    
    // Server availability tracking
    this.serverAvailable = true; // Assume available initially
    this.consecutiveErrors = 0; // Track consecutive errors
    this.maxConsecutiveErrors = 3; // Stop trying after 3 errors
    
    // DOM elements
    this.modal = null;
    this.microphoneIcon = null;
    this.summaryText = null;
    // Prompt rotation removed - no longer needed
    
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.createModalHTML();
        // Setup event listeners after HTML is created
        setTimeout(() => {
          this.setupEventListeners();
        }, 100);
      });
    } else {
      // DOM is already ready
      this.createModalHTML();
      // Setup event listeners after HTML is created
      setTimeout(() => {
        this.setupEventListeners();
      }, 100);
    }
  }

  createModalHTML() {
    // Check if container already exists
    if (document.getElementById('liveBriefContainer')) {
      this.modal = document.getElementById('liveBriefContainer');
      this.microphoneIcon = document.getElementById('liveBriefMicrophone');
      this.summaryText = document.getElementById('liveBriefSummary');
      return;
    }
    
    // Check if heroSection exists (parent of heroContent)
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) {
      console.error('LiveBriefModal: hero-section not found, cannot create container');
      return;
    }
    // Create container structure (not a modal, but inline content)
    const containerHTML = `
      <div id="liveBriefContainer" class="live-brief-container" style="display: none;">
        <div class="live-brief-header">
          <div class="mode-toggle-container">
            <span class="mode-label active" data-mode="voice">Voice</span>
            <label class="mode-toggle-switch">
              <input type="checkbox" id="modeToggleSwitch">
              <span class="toggle-slider"></span>
            </label>
            <span class="mode-label" data-mode="typing">Typing</span>
          </div>
          <h3 class="live-brief-title">Live Brief</h3>
          <div class="question-detail" id="liveBriefQuestionDetail">
            Describe the main idea of your application - including core features, target audience, and the problem it solves
          </div>
        </div>
        
        <div class="live-brief-body">
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
            <div class="live-brief-language-indicator" id="liveBriefLanguageIndicator"></div>
          </div>
        </div>
        
        <div class="live-brief-footer">
          <button class="live-brief-btn live-brief-btn-primary" id="useThisBtn" disabled>Generate</button>
        </div>
      </div>
    `;
    
    // Inject into heroSection (outside heroContent to avoid fade-out issues)
    heroSection.insertAdjacentHTML('beforeend', containerHTML);
    
    // Store references
    this.modal = document.getElementById('liveBriefContainer');
    this.microphoneIcon = document.getElementById('liveBriefMicrophone');
    this.summaryText = document.getElementById('liveBriefSummary');
    
    if (!this.modal) {
      console.error('LiveBriefModal: Failed to create container - element not found after insertion');
    }
  }

  setupEventListeners() {
    // Check if elements exist before adding listeners
    const modeToggleSwitch = document.getElementById('modeToggleSwitch');
    const useBtn = document.getElementById('useThisBtn');
    
    // Helper function to update toggle and labels state
    const updateToggleState = (checked) => {
      if (modeToggleSwitch) {
        modeToggleSwitch.checked = checked;
      }
      const voiceLabel = this.modal.querySelector('.mode-label[data-mode="voice"]');
      const typingLabel = this.modal.querySelector('.mode-label[data-mode="typing"]');
      if (voiceLabel && typingLabel) {
        if (checked) {
          voiceLabel.classList.remove('active');
          typingLabel.classList.add('active');
        } else {
          voiceLabel.classList.add('active');
          typingLabel.classList.remove('active');
        }
      }
    };
    
    // Make toggle clickable for switching modes
    if (modeToggleSwitch) {
      modeToggleSwitch.disabled = false;
      modeToggleSwitch.style.pointerEvents = 'auto';
      
      // Remove any existing listeners by cloning
      const newToggle = modeToggleSwitch.cloneNode(true);
      modeToggleSwitch.parentNode.replaceChild(newToggle, modeToggleSwitch);
      
      newToggle.addEventListener('change', (e) => {
        // Use Question Flow Controller if available
        if (window.questionFlowController) {
          if (e.target.checked) {
            window.questionFlowController.switchToTyping();
          } else {
            // Should not happen - toggle should be disabled when unchecked in voice mode
            window.questionFlowController.switchToVoice();
          }
        } else {
          // Fallback to old implementation
          updateToggleState(e.target.checked);
          if (e.target.checked) {
            this.switchToTyping();
          }
        }
      });
    }
    
    // Listen for clicks on mode labels (Voice/Typing) in Live Brief mode
    const modeLabels = this.modal.querySelectorAll('.mode-label');
    modeLabels.forEach(label => {
      // Remove any existing listeners by cloning
      const newLabel = label.cloneNode(true);
      label.parentNode.replaceChild(newLabel, label);
      
      newLabel.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = newLabel.getAttribute('data-mode');
        
        if (mode === 'typing') {
          // Switch to typing mode
          if (window.questionFlowController) {
            window.questionFlowController.switchToTyping();
          } else {
            updateToggleState(true);
            this.switchToTyping();
          }
        } else if (mode === 'voice') {
          // Already in voice mode, just update visual state
          if (window.questionFlowController) {
            // Ensure we're in voice mode
            window.questionFlowController.switchToMode('voice');
          } else {
            updateToggleState(false);
          }
        }
      });
    });
    
    // Add click handler to microphone icon for stop/resume
    if (this.microphoneIcon) {
      this.microphoneIcon.style.cursor = 'pointer';
      this.microphoneIcon.addEventListener('click', () => {
        if (this.isRecording) {
          // If recording, stop
          this.stopRecording();
        } else {
          // If stopped, resume recording
          this.startRecording().catch(error => {
            console.error('Error resuming recording:', error);
            this.showError('Failed to resume recording. Please check your permissions.');
          });
        }
      });
    }
    
    if (useBtn) {
      useBtn.addEventListener('click', () => {
        this.useThis();
      });
      // Initialize button state (disabled by default until text appears)
      useBtn.disabled = true;
    }
    
    // No overlay click handler needed - not a modal anymore
  }

  // Initialize for voice mode (called by controller, container already shown)
  async initializeForVoice(prefilledAnswers = null) {
    // Generate session ID
    this.sessionId = `live-brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Reset server availability for new session (give it a chance)
    this.serverAvailable = true;
    this.consecutiveErrors = 0;
    
    // Store pre-filled answers if provided
    if (prefilledAnswers && Array.isArray(prefilledAnswers)) {
      this.prefillAnswers = prefilledAnswers.slice();
    } else if (this.prefillAnswers) {
      // Use existing prefill if available
    } else {
      this.prefillAnswers = null;
    }
    
    // Ensure container exists
    if (!this.modal) {
      this.createModalHTML();
      // Wait a bit for HTML to be created
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update toggle to voice mode (unchecked) - ensure sync
    if (window.questionFlowController) {
      window.questionFlowController.updateTogglesForMode('voice');
    } else {
      // Fallback: manually update toggle
      const modeToggleSwitch = document.getElementById('modeToggleSwitch');
      if (modeToggleSwitch) {
        modeToggleSwitch.checked = false;
      }
      const voiceLabel = this.modal?.querySelector('.mode-label[data-mode="voice"]');
      const typingLabel = this.modal?.querySelector('.mode-label[data-mode="typing"]');
      if (voiceLabel && typingLabel) {
        voiceLabel.classList.add('active');
        typingLabel.classList.remove('active');
      }
    }
    
    // Update language indicator
    this.updateLanguageIndicator();
    
    // Request microphone permission and start recording
    // Wait a bit to ensure container is visible and event listeners are set up
    setTimeout(async () => {
      try {
        await this.startRecording();
      } catch (error) {
        console.error('Error starting recording:', error);
        // If permission denied, fallback to 3-questions modal
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          this.close();
          // Open existing 3-questions modal with pre-filled answers
          if (window.questionFlowController) {
            window.questionFlowController.switchToTyping(this.prefillAnswers);
          } else if (typeof proceedWithAppPlanning === 'function') {
            proceedWithAppPlanning();
            // Pre-fill answers after a short delay
            if (this.prefillAnswers && this.prefillAnswers.length > 0) {
              setTimeout(() => {
                if (typeof showModernInput === 'function') {
                  showModernInput(this.prefillAnswers);
                }
              }, 100);
            }
          }
          return;
        }
        // Show error but keep container open
        this.showError('Failed to access microphone. Please check your permissions.');
      }
    }, 300);
  }
  
  // Legacy open method (for backward compatibility)
  async open(prefilledAnswers = null) {
    // If using new controller, just initialize (view will show container)
    if (window.questionFlowController) {
      return this.initializeForVoice(prefilledAnswers);
    }
    
    // Old implementation for backward compatibility
    // Generate session ID
    this.sessionId = `live-brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store pre-filled answers if provided
    if (prefilledAnswers && Array.isArray(prefilledAnswers)) {
      this.prefillAnswers = prefilledAnswers.slice();
    } else if (this.prefillAnswers) {
      // Use existing prefill if available
    } else {
      this.prefillAnswers = null;
    }
    
    // Ensure container exists
    if (!this.modal) {
      this.createModalHTML();
      // Wait a bit for HTML to be created
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Hide hero content and show live brief container
    const heroContent = document.getElementById('heroContent');
    const heroTitle = document.querySelector('.hero-main-title');
    const heroDescription = document.querySelector('.hero-description');
    const heroButtonContainer = document.querySelector('.hero-button-container');
    const specCardsShowcase = document.getElementById('specCardsShowcase');
    
    // Hide hero elements FIRST (before adding fade-out to heroContent)
    if (heroTitle) heroTitle.style.display = 'none';
    if (heroDescription) heroDescription.style.display = 'none';
    if (heroButtonContainer) heroButtonContainer.style.display = 'none';
    if (specCardsShowcase) specCardsShowcase.style.display = 'none';
    
    // Show live brief container IMMEDIATELY (no animations)
    if (this.modal) {
      this.modal.style.display = 'block';
      // Force visibility with !important values
      this.modal.style.setProperty('visibility', 'visible', 'important');
      this.modal.style.setProperty('opacity', '1', 'important');
      this.modal.style.setProperty('z-index', '10', 'important');
      this.modal.style.setProperty('transition', 'none', 'important');
    } else {
      console.error('LiveBriefModal: Container still not found after creation!');
      return;
    }
    
    // Add fade-out to heroContent immediately
    if (heroContent) {
      heroContent.classList.add('fade-out');
    }
    
    // Update toggle to voice mode (unchecked) - ensure sync
    const modeToggleSwitch = document.getElementById('modeToggleSwitch');
    if (modeToggleSwitch) {
      modeToggleSwitch.checked = false;
    }
    const voiceLabel = this.modal?.querySelector('.mode-label[data-mode="voice"]');
    const typingLabel = this.modal?.querySelector('.mode-label[data-mode="typing"]');
    if (voiceLabel && typingLabel) {
      voiceLabel.classList.add('active');
      typingLabel.classList.remove('active');
    }
    
    // Update language indicator
    this.updateLanguageIndicator();
    
    // Request microphone permission and start recording
    // Wait a bit to ensure container is visible and event listeners are set up
    setTimeout(async () => {
      try {
        await this.startRecording();
      } catch (error) {
        console.error('Error starting recording:', error);
        // If permission denied, fallback to 3-questions modal
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          this.close();
          // Open existing 3-questions modal with pre-filled answers
          if (typeof proceedWithAppPlanning === 'function') {
            proceedWithAppPlanning();
            // Pre-fill answers after a short delay
            if (this.prefillAnswers && this.prefillAnswers.length > 0) {
              setTimeout(() => {
                if (typeof showModernInput === 'function') {
                  showModernInput(this.prefillAnswers);
                }
              }, 100);
            }
          }
          return;
        }
        // Show error but keep container open
        this.showError('Failed to access microphone. Please check your permissions.');
      }
    }, 300);
  }

  close() {
    this.stopRecording();
    
    // Hide live brief container
    if (this.modal) {
      this.modal.style.display = 'none';
      this.modal.classList.remove('fade-in');
    }
    
    // Show hero content again
    const heroContent = document.getElementById('heroContent');
    const heroTitle = document.querySelector('.hero-main-title');
    const heroDescription = document.querySelector('.hero-description');
    const heroButtonContainer = document.querySelector('.hero-button-container');
    const specCardsShowcase = document.getElementById('specCardsShowcase');
    
    if (heroContent) {
      heroContent.classList.remove('fade-out');
    }
    
    if (heroTitle) heroTitle.style.display = 'block';
    if (heroDescription) heroDescription.style.display = 'block';
    if (heroButtonContainer) heroButtonContainer.style.display = 'flex';
    if (specCardsShowcase) specCardsShowcase.style.display = 'block';
    
    this.cleanup();
  }

  cleanup() {
    // Stop all recording and polling
    this.stopRecording();
    
    // Language indicator will remain visible
    
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
    this.currentPromptIndex = 0;
  }
  
  updateLanguageIndicator() {
    const languageIndicator = document.getElementById('liveBriefLanguageIndicator');
    if (!languageIndicator) return;
    
    // Get browser language
    const browserLanguage = navigator.language || navigator.userLanguage || 'en-US';
    
    // Convert language code to short format (e.g., 'en-US' -> 'eng', 'he-IL' -> 'heb')
    const languageMap = {
      'en': 'eng',
      'en-US': 'eng',
      'en-GB': 'eng',
      'he': 'heb',
      'he-IL': 'heb',
      'ar': 'ara',
      'ar-SA': 'ara',
      'es': 'esp',
      'es-ES': 'esp',
      'fr': 'fra',
      'fr-FR': 'fra',
      'de': 'deu',
      'de-DE': 'deu',
      'it': 'ita',
      'it-IT': 'ita',
      'pt': 'por',
      'pt-BR': 'por',
      'ru': 'rus',
      'ru-RU': 'rus',
      'ja': 'jpn',
      'ja-JP': 'jpn',
      'zh': 'zho',
      'zh-CN': 'zho',
      'ko': 'kor',
      'ko-KR': 'kor'
    };
    
    // Extract base language code (e.g., 'en-US' -> 'en')
    const baseLang = browserLanguage.split('-')[0].toLowerCase();
    const fullLang = browserLanguage.toLowerCase();
    
    // Get language code
    const langCode = languageMap[fullLang] || languageMap[baseLang] || baseLang.substring(0, 3);
    
    // Update indicator
    languageIndicator.textContent = langCode;
  }

  async startRecording() {
    try {
      // Check if Web Speech API is available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('LiveBriefModal: Web Speech API not supported');
        throw new Error('Web Speech API is not supported in this browser');
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Store stream reference for cleanup
      this.mediaStream = stream;
      
      // Start recording state FIRST (before starting recording)
      this.isRecording = true;
      // Disable Generate button while recording
      const generateBtn = document.getElementById('useThisBtn');
      if (generateBtn) {
        generateBtn.disabled = true;
      }
      
      // Start ripple animation IMMEDIATELY (before recording starts)
      this.startRippleAnimation();
      
      // Setup AudioContext for amplitude detection (for ripple animation)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      // Start amplitude monitoring for ripple intensity
      this.monitorAmplitude();
      
      // Setup Web Speech API for real-time transcription
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      // Use browser/system language or fallback to English
      const browserLanguage = navigator.language || navigator.userLanguage || 'en-US';
      this.recognition.lang = browserLanguage;
      
      // Update language indicator
      this.updateLanguageIndicator();
      
      // Handle transcription results
      this.recognition.onresult = (event) => {
        // Don't process results if recording has stopped
        if (!this.isRecording) {
          return;
        }
        
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Append final transcript to full transcript
        if (finalTranscript && this.isRecording) {
          this.fullTranscript += finalTranscript;
          // Update display immediately with full transcript
          this.updateDisplayText();
          // Trigger summary update only if server is available (but don't wait for it)
          if (this.serverAvailable) {
            this.updateSummary().catch(() => {
              // If summary fails, still show transcript (silently)
              this.updateDisplayText();
            });
          }
        }
        
        // Show interim results in real-time (transcript + summary)
        // ALWAYS show interim transcript if available, even without summary
        if (interimTranscript && this.isRecording) {
          // Build display text: show full transcript + interim, with summary if available
          let displayText = '';
          if (this.summary) {
            displayText = `${this.summary}\n\n`;
          }
          if (this.fullTranscript) {
            displayText += `${this.fullTranscript} `;
          }
          displayText += `[Live: ${interimTranscript}]`;
          this.updateSummaryText(displayText, true);
        } else if (this.isRecording && this.fullTranscript) {
          // Show current transcript (with summary if available)
          this.updateDisplayText();
        }
      };
      
      this.recognition.onerror = (event) => {
        // Don't log "no-speech" errors - they're normal and expected
        if (event.error === 'no-speech') {
          // This is normal, just continue
          return;
        }
        
        // Only log actual errors (not "no-speech")
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          this.showError('Microphone permission denied');
          this.stopRecording();
        }
      };
      
      this.recognition.onend = () => {
        // Restart recognition ONLY if still recording and recognition object exists
        if (this.isRecording && this.recognition && this.recognition.onresult) {
          // Double-check that handlers weren't cleared (if they're no-ops, don't restart)
          try {
            this.recognition.start();
          } catch (e) {
            // Recognition might already be starting or stopped - silently ignore
          }
        }
      };
      
      // Start speech recognition
      this.recognition.start();
      
      // Start polling for summary updates
      this.startSummaryPolling();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stopRecording() {
    // Set flag FIRST to prevent any handlers from continuing
    this.isRecording = false;
    
    // Clear polling IMMEDIATELY to prevent API calls
    if (this.summaryPollInterval) {
      clearInterval(this.summaryPollInterval);
      this.summaryPollInterval = null;
    }
    
    // Remove recognition event handlers BEFORE stopping to prevent callbacks
    if (this.recognition) {
      // Remove all event listeners by replacing handlers with no-ops
      this.recognition.onresult = () => {};
      this.recognition.onerror = () => {};
      this.recognition.onend = () => {};
      
      try {
        this.recognition.stop();
      } catch (e) {
        // Silently ignore - recognition might already be stopped
      }
      this.recognition = null;
    }
    
    // Stop AudioContext
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Silently ignore - audio context might already be closed
      }
      this.audioContext = null;
    }
    
    // Stop all tracks (from getUserMedia stream)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // Silently ignore - track might already be stopped
        }
      });
      this.mediaStream = null;
    }
    
    // Stop ripple animation
    this.stopRippleAnimation();
    
    // Stop amplitude monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Update Generate button - enable if there's text
    this.updateGenerateButton();
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

  // Removed sendAudioChunkForTranscription - now using Web Speech API directly

  startSummaryPolling() {
    // Only poll if server is available
    if (!this.serverAvailable) {
      return;
    }
    
    // Poll every 3 seconds for summary updates
    this.summaryPollInterval = setInterval(() => {
      if (this.isRecording && this.fullTranscript && this.serverAvailable) {
        this.updateSummary();
      }
    }, 3000);
    
    // Initial update after 2 seconds
    setTimeout(() => {
      if (this.isRecording && this.fullTranscript && this.serverAvailable) {
        this.updateSummary();
      }
    }, 2000);
  }

  async updateSummary() {
    // Don't update if not recording or if session is cleared
    if (!this.isRecording || !this.fullTranscript || !this.sessionId) {
      return;
    }
    
    // Don't try if server is marked as unavailable
    if (!this.serverAvailable) {
      return;
    }
    
    try {
      // Use localhost in development, production URL otherwise
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // Server runs on port 10000 by default (from config.js)
      const serverPort = '10000';
      const apiBaseUrl = isLocalhost 
        ? `http://${window.location.hostname}:${serverPort}`
        : (window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com');
      
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
      
      // Reset error counter on success
      this.consecutiveErrors = 0;
      this.serverAvailable = true;
      
      if (data.summary) {
        this.summary = data.summary;
        // Update display with summary + transcript
        this.updateDisplayText();
      }
    } catch (error) {
      // Increment error counter
      this.consecutiveErrors++;
      
      // If too many consecutive errors, mark server as unavailable
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        this.serverAvailable = false;
        // Only log once when server becomes unavailable (not every time)
        console.warn('LiveBriefModal: Summary server unavailable, continuing without summary. Transcript will still be displayed.');
        // Stop polling
        if (this.summaryPollInterval) {
          clearInterval(this.summaryPollInterval);
          this.summaryPollInterval = null;
        }
      } else {
        // For first few errors, log silently (no console.error)
        // Only log at debug level if needed
      }
      
      // Even if summary fails, show transcript
      // This ensures user always sees what they said
      if (this.fullTranscript) {
        this.updateDisplayText();
      }
    }
  }

  // Update display with current transcript and summary
  updateDisplayText() {
    if (!this.summaryText) return;
    
    // Build display text: summary + transcript, or just transcript
    let displayText = '';
    if (this.summary) {
      displayText = this.summary;
      if (this.fullTranscript) {
        displayText += `\n\n${this.fullTranscript}`;
      }
    } else if (this.fullTranscript) {
      displayText = this.fullTranscript;
    }
    
    if (displayText) {
      this.updateSummaryText(displayText, false);
    }
  }

  updateSummaryText(text, isInterim = false) {
    if (!this.summaryText) return;
    
    // Show text directly (no typewriter for interim results)
    if (isInterim) {
      // Show interim results immediately
      this.summaryText.textContent = text;
      this.summaryText.style.opacity = '0.7';
      // Update button state for interim text
      this.updateGenerateButton();
    } else {
      // Show final text immediately (no typewriter for better UX)
      this.summaryText.textContent = text;
      this.summaryText.style.opacity = '1';
      this.updateGenerateButton();
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
    
    // Update Generate button state
    this.updateGenerateButton();
  }
  
  updateGenerateButton() {
    const generateBtn = document.getElementById('useThisBtn');
    if (!generateBtn) return;
    
    // Enable button if there's text in the summary box
    const hasText = this.summaryText && this.summaryText.textContent.trim().length > 0;
    generateBtn.disabled = !hasText || this.isRecording;
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
      
      // Update state if available
      if (window.questionFlowState) {
        window.questionFlowState.setAnswers(answers);
        window.questionFlowState.setVoiceState({ 
          summary: this.summary,
          fullTranscript: this.fullTranscript 
        });
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
      
      // Use new Question Flow Controller if available
      if (window.questionFlowController) {
        await window.questionFlowController.generateSpecification();
      } else if (typeof generateSpecification === 'function') {
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
    // Use localhost in development, production URL otherwise
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Server runs on port 10000 by default (from config.js)
    const serverPort = '10000';
    const apiBaseUrl = isLocalhost 
      ? `http://${window.location.hostname}:${serverPort}`
      : (window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com');
    
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
    
    // CRITICAL: Stop recording FIRST and clean up everything IMMEDIATELY
    // This prevents any ongoing API calls or event handlers from continuing
    this.isRecording = false;
    
    // Clear polling IMMEDIATELY to prevent any API calls
    if (this.summaryPollInterval) {
      clearInterval(this.summaryPollInterval);
      this.summaryPollInterval = null;
    }
    
    // Remove recognition event handlers BEFORE stopping to prevent callbacks
    if (this.recognition) {
      // Replace handlers with no-ops to prevent any callbacks
      this.recognition.onresult = () => {};
      this.recognition.onerror = () => {};
      this.recognition.onend = () => {};
      
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors - recognition might already be stopped
      }
      this.recognition = null;
    }
    
    // Stop AudioContext
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.audioContext = null;
    }
    
    // Stop all tracks (from getUserMedia stream)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // Ignore errors
        }
      });
      this.mediaStream = null;
    }
    
    // Stop ripple animation and amplitude monitoring
    this.stopRippleAnimation();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Clear all state WITHOUT processing (as requested)
    this.fullTranscript = '';
    this.summary = '';
    this.sessionId = null;
    
    // Clear summary text display
    if (this.summaryText) {
      this.summaryText.textContent = '';
    }
    
    // Close Live Brief container IMMEDIATELY (no animations)
    if (this.modal) {
      this.modal.style.display = 'none';
      this.modal.style.visibility = 'hidden';
      this.modal.style.opacity = '0';
      this.modal.classList.remove('fade-in');
    }
    
    // Don't save any state - just switch to typing mode cleanly
    // Use new Question Flow Controller
    if (window.questionFlowController) {
      // Pass null to start fresh (no pre-filled answers)
      window.questionFlowController.switchToTyping(null);
    } else {
      // Fallback to old implementation
      if (typeof proceedWithAppPlanning === 'function') {
        proceedWithAppPlanning();
      }
      if (typeof showModernInput === 'function') {
        showModernInput(null);
      }
      if (typeof window.setupTypingModeToggle === 'function') {
        setTimeout(() => {
          window.setupTypingModeToggle();
        }, 150);
      }
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
  console.log('✅ LiveBriefModal class exported to window');
} else {
  console.error('❌ window is undefined, cannot export LiveBriefModal');
}
