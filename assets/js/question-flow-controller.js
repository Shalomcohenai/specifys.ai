// Question Flow Controller
// Main controller for managing the question flow logic

class QuestionFlowController {
  constructor(state, view) {
    this.state = state;
    this.view = view;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen to state changes
    this.state.on('modeChange', (data) => this.handleModeChange(data));
    this.state.on('questionChange', (data) => this.handleQuestionChange(data));
    this.state.on('answerChange', (data) => this.handleAnswerChange(data));
    
    // Setup input handlers
    this.setupInputHandlers();
    
    // Setup button handlers
    this.setupButtonHandlers();
    
    // Setup progress dot handlers
    this.setupProgressDotHandlers();
    
    // Setup platform button handlers
    this.setupPlatformHandlers();
  }
  
  setupPlatformHandlers() {
    // Setup platform button handlers (phoneBtn, computerBtn)
    const phoneBtn = document.getElementById('phoneBtn');
    const computerBtn = document.getElementById('computerBtn');
    
    if (phoneBtn) {
      // Remove any existing listeners by cloning the element
      const newPhoneBtn = phoneBtn.cloneNode(true);
      // Preserve all attributes
      Array.from(phoneBtn.attributes).forEach(attr => {
        newPhoneBtn.setAttribute(attr.name, attr.value);
      });
      phoneBtn.parentNode.replaceChild(newPhoneBtn, phoneBtn);
      
      // Update view element reference
      this.view.elements.phoneBtn = newPhoneBtn;
      
      newPhoneBtn.addEventListener('click', () => {
        const currentState = this.state.getSelectedPlatforms();
        const newState = !currentState.mobile;
        this.state.setPlatform('mobile', newState);
        newPhoneBtn.classList.toggle('selected', newState);
        
        // Also sync with old state for compatibility
        if (typeof selectedPlatforms !== 'undefined') {
          selectedPlatforms.mobile = newState;
        }
      });
    }
    
    if (computerBtn) {
      // Remove any existing listeners by cloning the element
      const newComputerBtn = computerBtn.cloneNode(true);
      // Preserve all attributes
      Array.from(computerBtn.attributes).forEach(attr => {
        newComputerBtn.setAttribute(attr.name, attr.value);
      });
      computerBtn.parentNode.replaceChild(newComputerBtn, computerBtn);
      
      // Update view element reference
      this.view.elements.computerBtn = newComputerBtn;
      
      newComputerBtn.addEventListener('click', () => {
        const currentState = this.state.getSelectedPlatforms();
        const newState = !currentState.web;
        this.state.setPlatform('web', newState);
        newComputerBtn.classList.toggle('selected', newState);
        
        // Also sync with old state for compatibility
        if (typeof selectedPlatforms !== 'undefined') {
          selectedPlatforms.web = newState;
        }
      });
    }
  }
  
  setupInputHandlers() {
    const input = this.view.elements.mainInput;
    if (!input) return;
    
    // Save answer on input
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const currentIndex = this.state.getCurrentQuestionIndex();
      this.state.setAnswer(currentIndex, value);
      
      // Update character count and button state
      const maxLength = this.state.getCurrentCharacterLimit();
      this.view.updateCharacterCount(value.length, maxLength);
      this.view.updateButtonState(this.state.isLastQuestion(), value.length);
      
      // Auto-resize if function exists
      if (typeof autoResize === 'function') {
        autoResize();
      }
    });
  }
  
  setupButtonHandlers() {
    const sendBtn = this.view.elements.sendBtn;
    if (!sendBtn) return;
    
    sendBtn.addEventListener('click', () => {
      this.handleNextOrGenerate();
    });
  }
  
  setupProgressDotHandlers() {
    const dots = Array.from(this.view.elements.progressDots || []);
    dots.forEach((dot, index) => {
      // Remove any existing listeners by cloning the element
      const newDot = dot.cloneNode(true);
      // Preserve all attributes
      Array.from(dot.attributes).forEach(attr => {
        newDot.setAttribute(attr.name, attr.value);
      });
      dot.parentNode.replaceChild(newDot, dot);
      
      newDot.addEventListener('click', () => {
        // Don't jump if already on this question
        if (index === this.state.getCurrentQuestionIndex()) {
          return;
        }
        this.jumpToQuestion(index);
      });
    });
    
    // Re-initialize elements to get new references
    this.view.initializeElements();
  }
  
  // Mode management
  switchToMode(mode) {
    if (mode === 'voice' || mode === 'typing') {
      this.state.setMode(mode);
    }
  }
  
  handleModeChange(data) {
    const { newMode } = data;
    
    // Update toggles to match the new mode
    this.updateTogglesForMode(newMode);
    
    if (newMode === 'voice') {
      this.view.hideTypingMode();
      this.view.showVoiceMode();
      // Initialize Live Brief modal if available (but don't show - view already did)
      if (window.liveBriefModal) {
        const answers = this.state.getAllAnswers();
        // Only initialize, don't show (view already showed it)
        window.liveBriefModal.initializeForVoice(answers.length > 0 ? answers : null);
      }
    } else if (newMode === 'typing') {
      this.view.hideVoiceMode();
      this.view.showTypingMode();
      // Show current question
      this.showCurrentQuestion();
      // Setup toggle handlers
      if (typeof window.setupTypingModeToggle === 'function') {
        setTimeout(() => {
          window.setupTypingModeToggle();
        }, 100);
      }
      // Re-setup platform handlers when typing mode is shown (elements might not exist before)
      setTimeout(() => {
        this.setupPlatformHandlers();
      }, 150);
    }
  }
  
  // Update all toggles to match the current mode
  updateTogglesForMode(mode) {
    const isTyping = mode === 'typing';
    
    // Update Live Brief toggle (voice mode)
    const liveBriefToggle = document.getElementById('modeToggleSwitch');
    if (liveBriefToggle) {
      liveBriefToggle.checked = isTyping;
      // Update labels
      const voiceLabel = document.querySelector('#liveBriefContainer .mode-label[data-mode="voice"]');
      const typingLabel = document.querySelector('#liveBriefContainer .mode-label[data-mode="typing"]');
      if (voiceLabel && typingLabel) {
        if (isTyping) {
          voiceLabel.classList.remove('active');
          typingLabel.classList.add('active');
        } else {
          voiceLabel.classList.add('active');
          typingLabel.classList.remove('active');
        }
      }
    }
    
    // Update Typing mode toggle
    const typingToggle = document.getElementById('typingModeToggleSwitch');
    if (typingToggle) {
      typingToggle.checked = isTyping;
      // Update labels
      const voiceLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="voice"]');
      const typingLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="typing"]');
      if (voiceLabel && typingLabel) {
        if (isTyping) {
          voiceLabel.classList.remove('active');
          typingLabel.classList.add('active');
        } else {
          voiceLabel.classList.add('active');
          typingLabel.classList.remove('active');
        }
      }
    }
  }
  
  // Question navigation
  showCurrentQuestion() {
    const index = this.state.getCurrentQuestionIndex();
    const question = this.state.getCurrentQuestion();
    const detail = this.state.getCurrentQuestionDetail();
    const answer = this.state.getAnswer(index);
    const maxLength = this.state.getCurrentCharacterLimit();
    
    // Update view
    this.view.updateQuestion(index, question, detail);
    this.view.updateInput(answer, maxLength);
    this.view.updateButtonState(this.state.isLastQuestion(), answer.length);
    this.view.focusInput();
  }
  
  jumpToQuestion(questionIndex) {
    // Save current answer before jumping (save even if empty - question 3 is optional)
    const currentIndex = this.state.getCurrentQuestionIndex();
    const currentValue = this.view.getCurrentInputValue();
    // Always save the answer, even if empty (for question 3)
    this.state.setAnswer(currentIndex, currentValue.trim());
    
    // Jump to new question
    this.state.setCurrentQuestionIndex(questionIndex);
    this.showCurrentQuestion();
  }
  
  handleQuestionChange(data) {
    this.showCurrentQuestion();
  }
  
  handleAnswerChange(data) {
    // Update button state if needed
    if (data.index !== undefined) {
      const currentIndex = this.state.getCurrentQuestionIndex();
      if (data.index === currentIndex) {
        const value = data.newValue || '';
        this.view.updateButtonState(this.state.isLastQuestion(), value.length);
      }
    }
  }
  
  // Next/Generate button handler
  handleNextOrGenerate() {
    // Save current answer (save even if empty - question 3 is optional)
    const currentIndex = this.state.getCurrentQuestionIndex();
    const currentValue = this.view.getCurrentInputValue();
    // Always save the answer, even if empty (for question 3)
    this.state.setAnswer(currentIndex, currentValue.trim());
    
    const isLastQuestion = this.state.isLastQuestion();
    
    // If NOT last question - validate ONLY current question before moving to next
    if (!isLastQuestion) {
      const currentAnswer = this.state.getAnswer(currentIndex) || '';
      const minLength = 20; // Minimum characters for questions 1 and 2 (not question 3)
      
      // Check minimum length for current question (only for questions 1 and 2, not question 3)
      if (currentIndex < 2 && currentAnswer.trim().length < minLength) {
        this.view.showErrorMessage(`Please provide at least ${minLength} characters for your answer.`);
        return;
      }
      
      // For question 1 (index 0), also check platform selection
      if (currentIndex === 0) {
        const platforms = this.state.getSelectedPlatforms();
        if (!platforms.mobile && !platforms.web) {
          this.view.showErrorMessage('Please select at least one platform (Mobile or Web) before proceeding.');
          // Trigger platform hint if available
          const phoneBtn = document.getElementById('phoneBtn');
          const computerBtn = document.getElementById('computerBtn');
          if (phoneBtn || computerBtn) {
            // Add visual hint
            [phoneBtn, computerBtn].forEach(btn => {
              if (btn) {
                btn.style.animation = 'shake 0.5s';
                setTimeout(() => {
                  btn.style.animation = '';
                }, 500);
              }
            });
          }
          return;
        }
      }
      
      // All validations passed - move to next question
      this.state.setCurrentQuestionIndex(currentIndex + 1);
      this.showCurrentQuestion();
      return;
    }
    
    // If last question - validate first 2 questions before generating
    if (isLastQuestion) {
      const validation = this.state.validateAnswers();
      if (!validation.valid) {
        this.view.markUnansweredErrors(this.state.getAllAnswers());
        alert('Please answer the first two questions before generating your specification.');
        return;
      }
      
      // Generate specification
      this.generateSpecification();
    }
  }
  
  // Start the flow
  async start(mode = 'voice', prefilledAnswers = null) {
    // Reset state
    this.state.reset();
    
    // Sync platform selection from old state if available
    if (typeof selectedPlatforms !== 'undefined') {
      if (selectedPlatforms.mobile) {
        this.state.setPlatform('mobile', true);
      }
      if (selectedPlatforms.web) {
        this.state.setPlatform('web', true);
      }
    }
    
    // Set mode (this will trigger handleModeChange)
    this.state.setMode(mode);
    
    // Pre-fill answers if provided
    if (prefilledAnswers && Array.isArray(prefilledAnswers)) {
      this.state.setAnswers(prefilledAnswers);
    }
    
    // Hide hero content
    this.view.hideHeroContent();
    
    // Update toggles immediately
    this.updateTogglesForMode(mode);
    
    // Show appropriate mode
    if (mode === 'voice') {
      // Ensure Live Brief modal container exists first
      if (window.liveBriefModal && !window.liveBriefModal.modal) {
        window.liveBriefModal.createModalHTML();
        // Wait a bit for HTML to be created
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.view.showVoiceMode();
      // Initialize Live Brief modal (view already showed the container)
      if (window.liveBriefModal) {
        await window.liveBriefModal.initializeForVoice(prefilledAnswers);
      }
    } else {
      this.view.showTypingMode();
      this.showCurrentQuestion();
      if (typeof window.setupTypingModeToggle === 'function') {
        setTimeout(() => {
          window.setupTypingModeToggle();
        }, 100);
      }
      // Setup platform handlers after a delay to ensure elements exist
      setTimeout(() => {
        this.setupPlatformHandlers();
      }, 150);
    }
  }
  
  // Switch from voice to typing
  switchToTyping(prefilledAnswers = null) {
    // Save any voice state answers
    if (prefilledAnswers && Array.isArray(prefilledAnswers) && prefilledAnswers.length > 0) {
      this.state.setAnswers(prefilledAnswers);
      // Ensure we're on question 1 (index 0) when switching with prefilled answers
      this.state.setCurrentQuestionIndex(0);
    } else {
      // Reset to first question if no answers
      this.state.setCurrentQuestionIndex(0);
    }
    
    // Sync platform selection from old state if available
    if (typeof selectedPlatforms !== 'undefined') {
      if (selectedPlatforms.mobile) {
        this.state.setPlatform('mobile', true);
      }
      if (selectedPlatforms.web) {
        this.state.setPlatform('web', true);
      }
    }
    
    // Update toggles immediately before switching
    this.updateTogglesForMode('typing');
    
    // Switch mode
    this.state.setMode('typing');
    
    // Show typing mode and display first question
    this.view.showTypingMode();
    this.showCurrentQuestion();
    
    // Re-setup platform handlers when typing mode is shown (elements might not exist before)
    setTimeout(() => {
      this.setupPlatformHandlers();
    }, 150);
  }
  
  // Switch from typing to voice
  switchToVoice() {
    // Save current answer (save even if empty - question 3 is optional)
    const currentIndex = this.state.getCurrentQuestionIndex();
    const currentValue = this.view.getCurrentInputValue();
    // Always save the answer, even if empty (for question 3)
    this.state.setAnswer(currentIndex, currentValue.trim());
    
    // Sync platform selection to old state for compatibility
    const platforms = this.state.getSelectedPlatforms();
    if (typeof selectedPlatforms !== 'undefined') {
      selectedPlatforms.mobile = platforms.mobile;
      selectedPlatforms.web = platforms.web;
    }
    
    // Prepare answers for voice mode
    const answers = this.state.getAllAnswers();
    
    // Update toggles immediately before switching
    this.updateTogglesForMode('voice');
    
    // Switch mode (this will trigger handleModeChange which shows the view)
    this.state.setMode('voice');
    
    // Initialize Live Brief with current answers (view already showed it)
    if (window.liveBriefModal) {
      window.liveBriefModal.initializeForVoice(answers.length > 0 ? answers : null);
    }
  }
  
  // Generate specification
  async generateSpecification() {
    // Final save of current answer (save even if empty - question 3 is optional)
    const currentIndex = this.state.getCurrentQuestionIndex();
    const currentValue = this.view.getCurrentInputValue();
    // Always save the answer, even if empty (for question 3)
    this.state.setAnswer(currentIndex, currentValue.trim());
    
    // Validate all answers (only first 2 questions are required)
    const validation = this.state.validateAnswers();
    if (!validation.valid) {
      this.view.markUnansweredErrors(this.state.getAllAnswers());
      alert('Please answer the first two questions before generating the specification.');
      return;
    }
    
    // Set answers for generateSpecification function
    // Ensure we always have 3 answers (question 3 can be empty)
    let answers = this.state.getAllAnswers();
    // Pad answers array to ensure it has 3 elements (question 3 is optional)
    while (answers.length < 3) {
      answers.push('');
    }
    if (typeof window !== 'undefined') {
      // Clear any previous live brief answers
      delete window.liveBriefAnswers;
      delete window.liveBriefSelectedPlatforms;
      
      // Set answers for spec generation
      window.liveBriefAnswers = answers;
      window.liveBriefSelectedPlatforms = this.state.getSelectedPlatforms();
    }
    
    // Call existing generateSpecification function
    if (typeof generateSpecification === 'function') {
      generateSpecification();
    } else {
      console.error('generateSpecification function not found');
      alert('Error: Could not generate specification.');
    }
  }
  
  // Close/Reset
  close() {
    this.view.showHeroContent();
    this.view.hideVoiceMode();
    this.view.hideTypingMode();
    this.state.reset();
  }
}

// Initialize controller when DOM is ready
function initializeQuestionFlowController() {
  if (window.questionFlowState && window.questionFlowView) {
    window.questionFlowController = new QuestionFlowController(
      window.questionFlowState,
      window.questionFlowView
    );
    console.log('✅ Question Flow Controller initialized');
  } else {
    console.warn('⚠️ Question Flow State or View not available');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeQuestionFlowController);
} else {
  // DOM is already ready
  initializeQuestionFlowController();
}

