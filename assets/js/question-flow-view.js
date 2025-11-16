// Question Flow View Manager
// Handles all DOM manipulation and visibility control

class QuestionFlowView {
  constructor() {
    this.elements = {
      heroContent: null,
      heroTitle: null,
      heroDescription: null,
      heroButtonContainer: null,
      specCardsShowcase: null,
      liveBriefContainer: null,
      modernInputContainer: null,
      questionsDisplay: null,
      currentQuestion: null,
      currentQuestionDetail: null,
      mainInput: null,
      characterCount: null,
      sendBtn: null,
      progressDots: null
    };
    
    this.initializeElements();
  }
  
  initializeElements() {
    this.elements.heroContent = document.getElementById('heroContent');
    this.elements.heroTitle = document.querySelector('.hero-main-title');
    this.elements.heroDescription = document.querySelector('.hero-description');
    this.elements.heroButtonContainer = document.querySelector('.hero-button-container');
    this.elements.specCardsShowcase = document.getElementById('specCardsShowcase');
    this.elements.liveBriefContainer = document.getElementById('liveBriefContainer');
    this.elements.modernInputContainer = document.getElementById('modernInputContainer');
    this.elements.questionsDisplay = document.getElementById('questionsDisplay');
    this.elements.currentQuestion = document.getElementById('currentQuestion');
    this.elements.currentQuestionDetail = document.getElementById('currentQuestionDetail');
    this.elements.mainInput = document.getElementById('mainInput');
    this.elements.characterCount = document.getElementById('characterCount');
    this.elements.sendBtn = document.getElementById('sendBtn');
    this.elements.progressDots = document.querySelectorAll('.progress-dot');
  }
  
  // Hide/show hero content
  hideHeroContent() {
    const { heroTitle, heroDescription, heroButtonContainer, specCardsShowcase } = this.elements;
    if (heroTitle) heroTitle.style.display = 'none';
    if (heroDescription) heroDescription.style.display = 'none';
    if (heroButtonContainer) heroButtonContainer.style.display = 'none';
    if (specCardsShowcase) specCardsShowcase.style.display = 'none';
    if (this.elements.heroContent) {
      this.elements.heroContent.classList.add('fade-out');
    }
  }
  
  showHeroContent() {
    const { heroTitle, heroDescription, heroButtonContainer, specCardsShowcase } = this.elements;
    if (heroTitle) heroTitle.style.display = '';
    if (heroDescription) heroDescription.style.display = '';
    if (heroButtonContainer) heroButtonContainer.style.display = '';
    if (specCardsShowcase) specCardsShowcase.style.display = '';
    if (this.elements.heroContent) {
      this.elements.heroContent.classList.remove('fade-out');
    }
  }
  
  // Voice mode (Live Brief) visibility
  showVoiceMode() {
    this.hideTypingMode();
    // Re-initialize elements to ensure we have the latest references
    this.initializeElements();
    const container = this.elements.liveBriefContainer || document.getElementById('liveBriefContainer');
    if (container) {
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.transition = 'none';
      container.style.zIndex = '10';
    } else {
      console.warn('QuestionFlowView: liveBriefContainer not found, ensuring it exists...');
      // If container doesn't exist, ensure Live Brief modal creates it
      if (window.liveBriefModal && !window.liveBriefModal.modal) {
        window.liveBriefModal.createModalHTML();
        // Try again after a short delay
        setTimeout(() => {
          const container = document.getElementById('liveBriefContainer');
          if (container) {
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            container.style.transition = 'none';
            container.style.zIndex = '10';
          }
        }, 100);
      }
    }
  }
  
  hideVoiceMode() {
    const container = this.elements.liveBriefContainer;
    if (container) {
      container.style.display = 'none';
      container.style.visibility = 'hidden';
      container.style.opacity = '0';
      container.style.transition = 'none';
      container.classList.remove('fade-in');
    }
  }
  
  // Typing mode visibility
  showTypingMode() {
    this.hideVoiceMode();
    const { modernInputContainer, questionsDisplay } = this.elements;
    
    if (modernInputContainer) {
      modernInputContainer.style.display = 'block';
      modernInputContainer.style.visibility = 'visible';
      modernInputContainer.style.opacity = '1';
      modernInputContainer.style.transition = 'none';
    }
    
    if (questionsDisplay) {
      questionsDisplay.style.display = 'block';
      questionsDisplay.style.visibility = 'visible';
      questionsDisplay.style.opacity = '1';
      questionsDisplay.style.transition = 'none';
      questionsDisplay.style.pointerEvents = 'auto';
    }
  }
  
  hideTypingMode() {
    const { modernInputContainer, questionsDisplay } = this.elements;
    
    if (modernInputContainer) {
      modernInputContainer.style.display = 'none';
      modernInputContainer.style.visibility = 'hidden';
      modernInputContainer.style.opacity = '0';
      modernInputContainer.style.transition = 'none';
      modernInputContainer.classList.remove('fade-in');
    }
    
    if (questionsDisplay) {
      questionsDisplay.style.display = 'none';
      questionsDisplay.style.visibility = 'hidden';
      questionsDisplay.style.opacity = '0';
      questionsDisplay.style.transition = 'none';
      questionsDisplay.classList.remove('fade-in');
    }
  }
  
  // Update question display
  updateQuestion(questionIndex, question, detail) {
    const { currentQuestion, currentQuestionDetail } = this.elements;
    
    if (currentQuestion) {
      currentQuestion.classList.remove('fade-out', 'fade-in', 'slide-in');
      currentQuestion.textContent = question;
      // Removed slide-in animation
    }
    
    if (currentQuestionDetail) {
      currentQuestionDetail.classList.remove('fade-out', 'fade-in', 'slide-in');
      currentQuestionDetail.textContent = detail;
      // Removed slide-in animation
    }
    
    this.updateProgressDots(questionIndex);
  }
  
  // Update progress dots
  updateProgressDots(currentIndex) {
    const dots = Array.from(this.elements.progressDots || []);
    const totalQuestions = 3;
    
    dots.forEach((dot, index) => {
      dot.classList.remove('current', 'completed', 'error');
      
      if (currentIndex >= totalQuestions) {
        dot.classList.add('completed');
      } else if (index < currentIndex) {
        dot.classList.add('completed');
      } else if (index === currentIndex) {
        dot.classList.add('current');
      }
    });
  }
  
  // Update input field
  updateInput(value, maxLength) {
    const { mainInput, characterCount } = this.elements;
    
    if (mainInput) {
      mainInput.value = value || '';
      mainInput.maxLength = maxLength;
      
      // Trigger auto-resize if function exists
      if (typeof autoResize === 'function') {
        autoResize();
      }
    }
    
    this.updateCharacterCount(mainInput?.value.length || 0, maxLength);
  }
  
  // Update character count
  updateCharacterCount(current, max) {
    const { characterCount } = this.elements;
    if (!characterCount) return;
    
    characterCount.textContent = `${current} / ${max}`;
    
    const percentage = (current / max) * 100;
    characterCount.classList.remove('warning', 'danger');
    
    if (percentage >= 100) {
      characterCount.classList.add('danger');
    } else if (percentage >= 90) {
      characterCount.classList.add('warning');
    }
  }
  
  // Update button state
  updateButtonState(isLastQuestion, textLength) {
    const { sendBtn } = this.elements;
    if (!sendBtn) return;
    
    const minLength = isLastQuestion ? 0 : 20;
    const isValid = textLength >= minLength;
    
    sendBtn.disabled = false;
    
    if (isValid) {
      sendBtn.style.background = '#FF6B35';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.opacity = '1';
    } else {
      sendBtn.style.background = '#cccccc';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.opacity = '0.6';
    }
    
    // Update button text
    const sendText = sendBtn.querySelector('.send-text');
    if (sendText) {
      sendText.textContent = isLastQuestion ? 'Generate' : 'Next';
    }
  }
  
  // Mark unanswered questions as error
  markUnansweredErrors(answers) {
    // Visual feedback for unanswered questions
    // This can be extended to show specific error messages
  }
  
  // Show error message in the UI (not browser alert)
  showErrorMessage(message) {
    // Remove existing error message if any
    const existingError = document.querySelector('.question-flow-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'question-flow-error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      animation: slideUp 0.3s ease-out;
      max-width: 90%;
      text-align: center;
    `;
    
    // Add animation styles if not already present
    if (!document.getElementById('question-flow-error-styles')) {
      const style = document.createElement('style');
      style.id = 'question-flow-error-styles';
      style.textContent = `
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
      errorDiv.style.transition = 'opacity 0.3s ease';
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }
  
  // Get current input value
  getCurrentInputValue() {
    return this.elements.mainInput?.value || '';
  }
  
  // Focus input
  focusInput() {
    if (this.elements.mainInput) {
      setTimeout(() => {
        this.elements.mainInput.focus();
      }, 100);
    }
  }
}

// Export singleton instance
window.questionFlowView = new QuestionFlowView();

