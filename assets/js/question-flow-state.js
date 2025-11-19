// Question Flow State Manager
// Centralized state management for the question flow system

class QuestionFlowState {
  constructor() {
    // Current mode: 'voice' | 'typing'
    this.mode = 'typing';
    
    // Question state
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedPlatforms = {
      mobile: false,
      web: false
    };
    
    // Questions configuration
    this.questions = [
      "Describe your application",
      "Describe the workflow", 
      "Additional details"
    ];
    
    this.questionDetails = [
      "Describe the main idea of your application - including core features, target audience, and the problem it solves",
      "Walk through a typical user journey step by step - explain how users interact with different features and workflows",
      "Add any technical requirements, integrations with other services, future features, or special considerations"
    ];
    
    this.characterLimits = [900, 800, 600];
    
    // Voice mode state
    this.voiceState = {
      sessionId: null,
      isRecording: false,
      fullTranscript: '',
      summary: ''
    };
    
    // Listeners for state changes
    this.listeners = {
      modeChange: [],
      questionChange: [],
      answerChange: [],
      voiceStateChange: []
    };
  }
  
  // Mode management
  setMode(mode) {
    if (this.mode !== mode && (mode === 'voice' || mode === 'typing')) {
      const oldMode = this.mode;
      this.mode = mode;
      this.notifyListeners('modeChange', { oldMode, newMode: mode });
    }
  }
  
  getMode() {
    return this.mode;
  }
  
  // Question management
  setCurrentQuestionIndex(index) {
    if (index >= 0 && index < this.questions.length && index !== this.currentQuestionIndex) {
      const oldIndex = this.currentQuestionIndex;
      this.currentQuestionIndex = index;
      this.notifyListeners('questionChange', { oldIndex, newIndex: index });
    }
  }
  
  getCurrentQuestionIndex() {
    return this.currentQuestionIndex;
  }
  
  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || '';
  }
  
  getCurrentQuestionDetail() {
    return this.questionDetails[this.currentQuestionIndex] || '';
  }
  
  getCurrentCharacterLimit() {
    return this.characterLimits[this.currentQuestionIndex] || 0;
  }
  
  isLastQuestion() {
    return this.currentQuestionIndex >= this.questions.length - 1;
  }
  
  // Answer management
  setAnswer(index, value) {
    if (index >= 0 && index < this.questions.length) {
      const oldValue = this.answers[index];
      this.answers[index] = value;
      this.notifyListeners('answerChange', { index, oldValue, newValue: value });
    }
  }
  
  getAnswer(index) {
    return this.answers[index] || '';
  }
  
  getAllAnswers() {
    return [...this.answers];
  }
  
  setAnswers(answers) {
    if (Array.isArray(answers)) {
      this.answers = answers.slice(0, this.questions.length);
      this.notifyListeners('answerChange', { allAnswers: this.answers });
    }
  }
  
  // Voice state management
  setVoiceState(updates) {
    Object.assign(this.voiceState, updates);
    this.notifyListeners('voiceStateChange', { voiceState: this.voiceState });
  }
  
  getVoiceState() {
    return { ...this.voiceState };
  }
  
  // Platform selection
  setPlatform(platform, value) {
    if (platform === 'mobile' || platform === 'web') {
      this.selectedPlatforms[platform] = value;
    }
  }
  
  getSelectedPlatforms() {
    return { ...this.selectedPlatforms };
  }
  
  // Validation
  validateAnswers() {
    // First 2 questions are required
    for (let i = 0; i < 2; i++) {
      if (!this.answers[i] || this.answers[i].trim() === '') {
        return { valid: false, missingIndex: i };
      }
    }
    return { valid: true };
  }
  
  // Reset state
  reset() {
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedPlatforms = { mobile: false, web: false };
    this.voiceState = {
      sessionId: null,
      isRecording: false,
      fullTranscript: '',
      summary: ''
    };
  }
  
  // Event listeners
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
window.questionFlowState = new QuestionFlowState();

