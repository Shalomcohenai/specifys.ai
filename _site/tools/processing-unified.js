// New 4-Question Specification Flow
// Simplified chat system for app specification generation

class UnifiedChat {
  constructor() {
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.messages = [];
    this.questions = [];
    
    // Initialize questions
    this.initializeQuestions();
    
    this.init();
  }

  initializeQuestions() {
    // Single set of 4 questions for all users
    this.questions = [
      {
        id: 0,
        name: 'App Description',
        question: 'Describe your application',
        type: 'text',
        examples: 'My app, FitTrack, is a fitness and nutrition tracking platform designed to help users achieve their health goals. It allows users to log workouts, track meals, set fitness targets, and receive personalized recommendations based on their progress.'
      },
      {
        id: 1,
        name: 'User Workflow',
        question: 'Describe the workflow',
        type: 'text',
        examples: 'A typical user starts by creating a profile and setting goals (e.g., weight loss or muscle gain). They log daily meals via a barcode scanner or manual input and record workouts by selecting exercises from a library. The app suggests meal plans and workout routines based on their progress.'
      },
      {
        id: 2,
        name: 'Additional Details',
        question: 'Additional details',
        type: 'text',
        examples: 'The app should integrate with health wearables like Apple Watch and support push notifications for workout reminders. Future plans include adding a community feature for user challenges and social sharing.'
      },
      {
        id: 3,
        name: 'Target Audience',
        question: 'Target audience and goals',
        type: 'text',
        examples: 'The target audience is health-conscious individuals aged 18-45, primarily fitness enthusiasts and beginners looking to improve their lifestyle. They are tech-savvy, use smartphones daily, and value convenience and personalization in their fitness journey.'
      }
    ];
  }

  init() {
    // Check if this is a fresh page load (not a refresh)
    const isRefresh = performance.navigation.type === 1;
    if (isRefresh) {
      this.clearAllLocalStorage();
    }
    
    this.loadSavedData();
    this.setupEventListeners();
    this.startChat();
  }

  clearAllLocalStorage() {
    // Clear all localStorage items
    localStorage.removeItem('unifiedAnswers');
    localStorage.removeItem('unifiedAnswers_novice');
    localStorage.removeItem('unifiedAnswers_market');
    localStorage.removeItem('unifiedChatMessages');
    localStorage.removeItem('unifiedCurrentMode');
    localStorage.removeItem('currentMode');
    localStorage.removeItem('formData');
    localStorage.removeItem('noCodeAnswers');
    localStorage.removeItem('devAnswers');
    localStorage.removeItem('marketAnswers');
    localStorage.removeItem('generatedContent');
    localStorage.removeItem('currentSpecId');
    localStorage.removeItem('currentAnswers');
  }

  loadSavedData() {
    // Load saved answers
    const savedAnswers = localStorage.getItem('currentAnswers');
      if (savedAnswers) {
        this.answers = JSON.parse(savedAnswers);
    }

    // Load saved messages
    const savedMessages = localStorage.getItem('unifiedChatMessages');
    if (savedMessages) {
      this.messages = JSON.parse(savedMessages);
    }
  }

  saveData() {
    localStorage.setItem('currentAnswers', JSON.stringify(this.answers));
    localStorage.setItem('unifiedChatMessages', JSON.stringify(this.messages));
  }

  setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const resetButton = document.getElementById('resetButton');
    
    if (sendButton) {
      sendButton.addEventListener('click', () => this.handleSend());
      sendButton.disabled = true;
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => this.resetChat());
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });

      chatInput.addEventListener('input', () => {
        this.autoResizeTextarea(chatInput);
        if (sendButton) {
          sendButton.disabled = !chatInput.value.trim();
        }
      });
    }
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startChat() {
    if (this.messages.length === 0) {
      this.showIntroMessages();
    } else {
      this.renderMessages();
    }
    this.updateResetButtonVisibility();
  }

  showIntroMessages() {
    const introMessages = [
      "Hi! 👋 I'm your personal assistant and my job is to help you create the perfect application specification!",
      "💡 Tip: You can edit any of your answers by clicking the 'edit' button on your messages, and restart anytime with the reset button above",
      "Let's start with 4 simple questions about your app idea..."
    ];

    let messageIndex = 0;
    const showNextMessage = () => {
      if (messageIndex < introMessages.length) {
        const message = {
          id: Date.now() + messageIndex,
          type: 'system',
          content: introMessages[messageIndex],
          isIntro: true
        };
        
        this.messages.push(message);
        this.renderMessages();
        this.scrollToBottom();
        
        messageIndex++;
        setTimeout(showNextMessage, 1500);
      } else {
        setTimeout(() => {
          this.askQuestion();
          this.updateResetButtonVisibility();
        }, 500);
      }
    };
    
    showNextMessage();
  }

  askQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      this.showCompletionMessage();
      return;
    }

    const question = this.questions[this.currentQuestionIndex];
    const message = {
      id: Date.now(),
      type: 'system',
      content: question.question,
      questionId: question.id,
      examples: question.examples,
      questionType: question.type
    };

    this.messages.push(message);
    this.renderMessages();
    this.updateProgress();
    this.scrollToBottom();
    
    this.updateUIForQuestion(question);
    this.updateResetButtonVisibility();
  }

  updateUIForQuestion(question) {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
      chatInput.style.display = 'block';
      sendButton.style.display = 'block';
      sendButton.disabled = true;
  }

  handleSend() {
    const chatInput = document.getElementById('chatInput');
    const answer = chatInput.value.trim();
    
    if (!answer) return;

    this.handleAnswer(answer);
    chatInput.value = '';
    this.autoResizeTextarea(chatInput);
  }

  handleAnswer(answer) {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    
    if (!currentQuestion) {
      console.error('No current question found');
      return;
    }

    // Store the answer
    this.answers[currentQuestion.id] = answer;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: answer,
      isLastUserMessage: true
    };
    this.messages.push(userMessage);

    // Render messages
    this.renderMessages();
    this.scrollToBottom();

    // Move to next question
    this.currentQuestionIndex++;
    
    // Save progress
    this.saveData();
    
    // Update back button visibility
    this.updateResetButtonVisibility();

    // Ask next question or complete
    if (this.currentQuestionIndex < this.questions.length) {
      setTimeout(() => {
        this.askQuestion();
      }, 1000);
    } else {
      this.showCompletionMessage();
    }
  }

  showCompletionMessage() {
    const completionMessage = {
      id: Date.now(),
      type: 'system',
      content: 'Perfect! I have all the information I need. Let me generate your application overview...'
    };

    this.messages.push(completionMessage);
    this.renderMessages();
    this.scrollToBottom();

    setTimeout(() => {
      this.generateSpecification();
    }, 2000);
  }

  async generateSpecification() {
    try {
      console.log('🚀 Starting generateSpecification...');
      
      // Show loading overlay
      this.showLoadingOverlay();

      const loadingMessage = {
        id: Date.now(),
        type: 'system',
        content: '🔄 Generating your application overview... This may take a few moments.'
      };

      this.messages.push(loadingMessage);
      this.renderMessages();
      this.scrollToBottom();

      // Prepare the prompt for overview generation
      const prompt = PROMPTS.overview(this.answers);

      // Prepare API request body
      const requestBody = {
        stage: 'overview',
        locale: 'en-US',
        temperature: 0,
        prompt: {
          system: 'You are a professional product manager and UX architect. Generate a comprehensive application overview based on user input.',
          developer: 'Create a detailed overview that includes application summary, core features, user journey, target audience, problem statement, and unique value proposition.',
          user: prompt
        }
      };
      

      // Call the Worker API
      const response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });


      let data;
      try {
        const responseText = await response.text();
        
        data = JSON.parse(responseText);
        console.log('✅ Successfully parsed JSON response:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse API response as JSON:', parseError);
        const textResponse = await response.text();
        console.error('❌ Raw response that failed to parse:', textResponse);
        throw new Error(`API Error: Failed to parse response (Status: ${response.status})`);
      }

      if (!response.ok) {
        console.error('❌ API Error Details:', data);
        console.error('❌ Response not OK - Status:', response.status);
        throw new Error(`API Error: ${data.error?.message || data.message || response.status}`);
      }
      
      // Extract overview content from the structured response
      
      const overviewContent = data.overview ? JSON.stringify(data.overview, null, 2) : 'No overview generated';

      // Hide loading overlay
      this.hideLoadingOverlay();

      // Show success message
      const successMessage = {
        id: Date.now(),
        type: 'system',
        content: '✅ Application overview generated successfully! Redirecting to specification viewer...'
      };

      this.messages.push(successMessage);
      this.renderMessages();
      this.scrollToBottom();

      // Save to Firebase immediately (user is always authenticated)
      const firebaseId = await this.saveSpecToFirebase(overviewContent, this.answers);
      console.log('✅ Saved to Firebase successfully with ID:', firebaseId);
      
      // Store in localStorage for backup
      localStorage.setItem('generatedOverviewContent', overviewContent);
      localStorage.setItem('initialAnswers', JSON.stringify(this.answers));
      console.log('✅ Stored in localStorage successfully');
      
      // Redirect to spec viewer with Firebase ID
      setTimeout(() => {
        window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
      }, 1000);

    } catch (error) {
      console.error('Error generating specification:', error);
      
      // Hide loading overlay
      this.hideLoadingOverlay();
      
      const errorMessage = {
        id: Date.now(),
        type: 'system',
        content: `❌ Error generating specification: ${error.message}. Please try again.`
      };

      this.messages.push(errorMessage);
      this.renderMessages();
      this.scrollToBottom();
    }
  }

  async saveSpecToFirebase(overviewContent, answers) {
    try {
      
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('User must be authenticated to save to Firebase');
      }
      
      // Extract title from overview content
      let title = "App Specification";
      try {
        const overviewObj = JSON.parse(overviewContent);
        if (overviewObj.applicationSummary && overviewObj.applicationSummary.paragraphs) {
          const firstParagraph = overviewObj.applicationSummary.paragraphs[0];
          if (firstParagraph && firstParagraph.length > 10 && firstParagraph.length < 100) {
            title = firstParagraph.substring(0, 50) + '...';
          }
        }
      } catch (e) {
      }
      
      const specDoc = {
        title: title,
        overview: overviewContent,
        technical: null,
        market: null,
        status: {
          overview: "ready",
          technical: "pending",
          market: "pending"
        },
        overviewApproved: false,
        answers: answers,
        userId: user.uid,
        userName: user.displayName || user.email || 'Anonymous User',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      
      const docRef = await firebase.firestore().collection('specs').add(specDoc);
      console.log('✅ Spec saved successfully with ID:', docRef.id);
      
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Error saving spec to Firebase:', error);
      throw error;
    }
  }

  renderMessages() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
      console.error('chatMessages element not found!');
      return;
    }

    chatMessages.innerHTML = '';

    this.messages.forEach((message, index) => {
      if (message.isIntro) {
        this.renderSystemMessage(chatMessages, message.content);
      } else if (message.type === 'system') {
        this.renderSystemMessage(chatMessages, message.content, message.examples, message.questionType);
      } else if (message.type === 'user') {
        this.renderUserMessage(chatMessages, message.content);
      }
    });
  }

  renderSystemMessage(container, content, examples, questionType) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'S';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = content;

    contentDiv.appendChild(textDiv);

    // Add examples if they exist
    if (examples) {
      const examplesDiv = document.createElement('div');
      examplesDiv.className = 'examples';
      examplesDiv.innerHTML = `
        <div class="examples-title">💡 Example:</div>
        <div class="examples-text">${examples}</div>
      `;
      contentDiv.appendChild(examplesDiv);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    container.appendChild(messageDiv);
  }

  renderUserMessage(container, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'U';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = content;

    // Add edit button
    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.textContent = 'edit';
    editButton.title = 'Edit this message';
    
    // Store the original content for editing
    editButton.dataset.originalContent = content;
    editButton.dataset.messageIndex = this.messages.findIndex(msg => 
      msg.type === 'user' && msg.content === content
    );

    editButton.addEventListener('click', () => {
      this.startEditMessage(messageDiv, contentDiv, textDiv, content);
    });

    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(editButton);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    container.appendChild(messageDiv);
  }

  startEditMessage(messageDiv, contentDiv, textDiv, originalContent) {
    // Add editing class
    messageDiv.classList.add('editing');
    
    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-input';
    textarea.value = originalContent;
    textarea.rows = Math.max(3, originalContent.split('\n').length);
    
    // Create controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'edit-controls';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.textContent = 'Save';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    
    controlsDiv.appendChild(saveBtn);
    controlsDiv.appendChild(cancelBtn);
    
    // Replace content
    contentDiv.innerHTML = '';
    contentDiv.appendChild(textarea);
    contentDiv.appendChild(controlsDiv);
    
    // Focus on textarea
    textarea.focus();
    textarea.select();
    
    // Event listeners
    const saveMessage = () => {
      const newContent = textarea.value.trim();
      if (newContent && newContent !== originalContent) {
        this.saveEditedMessage(originalContent, newContent);
      }
      this.cancelEditMessage(messageDiv, contentDiv, textDiv, originalContent);
    };
    
    const cancelMessage = () => {
      this.cancelEditMessage(messageDiv, contentDiv, textDiv, originalContent);
    };
    
    saveBtn.addEventListener('click', saveMessage);
    cancelBtn.addEventListener('click', cancelMessage);
    
    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        saveMessage();
      } else if (e.key === 'Escape') {
        cancelMessage();
      }
    });
  }

  saveEditedMessage(originalContent, newContent) {
    // Update the message in the messages array
    const messageIndex = this.messages.findIndex(msg => 
      msg.type === 'user' && msg.content === originalContent
    );
    
    if (messageIndex !== -1) {
      this.messages[messageIndex].content = newContent;
      
      // Update the corresponding answer in answers array
      const questionIndex = Math.floor((messageIndex - 1) / 2);
      if (questionIndex >= 0 && questionIndex < this.questions.length) {
        const question = this.questions[questionIndex];
        if (question) {
          this.answers[question.id] = newContent;
        }
      }
      
      // Save to localStorage
      this.saveData();
      
      // Re-render the specific message to update the UI
      this.renderMessages();
      
    }
  }

  cancelEditMessage(messageDiv, contentDiv, textDiv, originalContent) {
    // Remove editing class
    messageDiv.classList.remove('editing');
    
    // Restore original content
    contentDiv.innerHTML = '';
    textDiv.textContent = originalContent;
    
    // Re-add edit button
    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.textContent = 'edit';
    editButton.title = 'Edit this message';
    editButton.dataset.originalContent = originalContent;
    
    editButton.addEventListener('click', () => {
      this.startEditMessage(messageDiv, contentDiv, textDiv, originalContent);
    });
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(editButton);
  }

  updateProgress() {
    const totalQuestions = this.questions.length;
    const currentQuestionNumber = this.currentQuestionIndex + 1;
    const progress = (currentQuestionNumber / totalQuestions) * 100;
    
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `Question ${currentQuestionNumber} of ${totalQuestions}`;
    }
  }

  showSubmitButton() {
    const chatInputArea = document.getElementById('chatInputArea');
    if (!chatInputArea) return;

    // Hide the regular input
    const chatInputWrapper = chatInputArea.querySelector('.chat-input-wrapper');
    if (chatInputWrapper) {
      chatInputWrapper.style.display = 'none';
    }

    // Create submit button if it doesn't exist
    let submitButton = document.getElementById('submitButton');
    if (!submitButton) {
      submitButton = document.createElement('button');
      submitButton.id = 'submitButton';
      submitButton.className = 'submit-button';
      submitButton.innerHTML = '<i class="fas fa-rocket"></i> Generate Specification';
      submitButton.onclick = () => this.generateSpecification();
      chatInputArea.appendChild(submitButton);
    }

    submitButton.style.display = 'block';
  }

  scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  updateResetButtonVisibility() {
    const resetButton = document.getElementById('resetButton');
    
    if (resetButton) {
      // Show reset button if we have any messages
      if (this.messages.length > 0) {
        resetButton.classList.add('show');
      } else {
        resetButton.classList.remove('show');
      }
    }
  }

  resetChat() {
    if (confirm('Are you sure you want to reset the chat? This will clear all your progress.')) {
      // Clear all data
      this.currentQuestionIndex = 0;
      this.answers = [];
      this.messages = [];
      
      // Clear all localStorage items
      this.clearAllLocalStorage();
      
      // Clear UI
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }
      
      // Reset input
      const chatInput = document.getElementById('chatInput');
      if (chatInput) {
        chatInput.value = '';
        chatInput.style.display = 'block';
      }
      
      // Reset send button
      const sendButton = document.getElementById('sendButton');
      if (sendButton) {
        sendButton.style.display = 'block';
        sendButton.disabled = true;
      }
      
      // Update progress
      this.updateProgress();
      
      // Update button visibility
      this.updateResetButtonVisibility();
      
      // Start fresh
      this.startChat();
    }
  }

  resetForDemo() {
    // Clear all data without confirmation
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.messages = [];
    
    // Clear UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.innerHTML = '';
    }
    
    // Reset input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = '';
      chatInput.style.display = 'block';
    }
    
    // Reset send button
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      sendButton.style.display = 'block';
      sendButton.disabled = true;
    }
    
    // Update progress
    this.updateProgress();
    
    // Update button visibility
    this.updateResetButtonVisibility();
    
    // Hide submit button if it exists
    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
      submitButton.style.display = 'none';
    }
  }

  showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
  }

  hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }
}

// Initialize the chat when DOM is loaded
let unifiedChat;
document.addEventListener('DOMContentLoaded', () => {
  unifiedChat = new UnifiedChat();
});

// Demo Apps Data
const DEMO_APPS = {
  fitness: {
    name: "Fitness Tracker",
    answers: [
      "FitTrack is a comprehensive fitness and nutrition tracking mobile application designed to help users achieve their health and wellness goals. The app combines workout logging, meal tracking, progress monitoring, and personalized recommendations in one platform.",
      "Users start by creating a profile and setting fitness goals (weight loss, muscle gain, endurance, etc.). They log daily workouts by selecting exercises from a comprehensive library, track meals using barcode scanning or manual input, and monitor their progress through charts and analytics. The app provides personalized workout plans and meal suggestions based on their goals and preferences.",
      "The app integrates with popular fitness wearables like Apple Watch, Fitbit, and Garmin for automatic activity tracking. It includes social features for sharing achievements and participating in challenges with friends. Future features include AI-powered personal trainer recommendations and integration with local gyms for class bookings.",
      "Target audience includes fitness enthusiasts aged 18-45, both beginners and advanced users who want to track their health journey. They are health-conscious individuals who use smartphones daily and value convenience, personalization, and data-driven insights in their fitness routine."
    ]
  },
  food: {
    name: "Food Delivery Platform",
    answers: [
      "QuickEats is a food delivery platform that connects users with local restaurants and food vendors. The app allows users to browse menus, place orders, track deliveries in real-time, and manage their food preferences and dietary restrictions.",
      "Users browse restaurants by cuisine type, location, or ratings, select items from digital menus with detailed descriptions and photos, customize orders with special instructions, and place orders with multiple payment options. They can track their delivery in real-time with GPS updates and receive notifications about order status changes.",
      "The app includes features like scheduled ordering for future meals, group ordering for office lunches, loyalty programs with points and discounts, and integration with popular payment methods. It supports multiple languages and dietary filters (vegetarian, vegan, gluten-free, etc.).",
      "Target audience includes busy professionals aged 22-50, students, and families who value convenience and time-saving solutions. They are tech-savvy individuals who frequently order food online and appreciate variety, quality, and reliable delivery services."
    ]
  },
  social: {
    name: "Social Network Platform",
    answers: [
      "ConnectHub is a social networking platform focused on professional networking and career development. The app helps users build meaningful professional relationships, discover job opportunities, share industry insights, and grow their professional network.",
      "Users create professional profiles highlighting their skills, experience, and career goals. They can connect with colleagues, industry professionals, and potential employers, share articles and insights, participate in industry discussions, and discover job opportunities through their network connections.",
      "The app includes features like industry-specific groups, mentorship matching, skill endorsements, company insights, and event networking. It integrates with LinkedIn for seamless profile import and includes AI-powered job recommendations based on user preferences and network activity.",
      "Target audience includes working professionals aged 25-55 across various industries, job seekers, entrepreneurs, and students preparing for their careers. They are career-focused individuals who value professional growth, networking opportunities, and staying updated with industry trends."
    ]
  },
  education: {
    name: "Learning Platform",
    answers: [
      "EduMaster is an online learning platform that offers interactive courses, skill assessments, and personalized learning paths across various subjects and professional skills. The platform combines video lessons, interactive exercises, quizzes, and peer collaboration to create an engaging learning experience.",
      "Users browse courses by category, skill level, or instructor, enroll in courses with structured learning paths, complete interactive lessons and assignments, take quizzes and assessments to track progress, and earn certificates upon completion. They can also participate in discussion forums and peer review activities.",
      "The platform includes adaptive learning technology that adjusts content difficulty based on user performance, gamification elements like badges and leaderboards, offline learning capabilities, and integration with popular productivity tools. It supports multiple learning formats including video, audio, text, and interactive simulations.",
      "Target audience includes lifelong learners aged 18-65, professionals seeking skill development, students looking for supplementary education, and organizations training their employees. They are motivated individuals who value continuous learning, skill development, and career advancement."
    ]
  },
  finance: {
    name: "Personal Finance Manager",
    answers: [
      "MoneyWise is a comprehensive personal finance management application that helps users track expenses, create budgets, monitor investments, and achieve their financial goals. The app provides insights into spending patterns and offers personalized financial advice.",
      "Users connect their bank accounts and credit cards for automatic transaction tracking, categorize expenses, set monthly budgets for different categories, track savings goals, monitor investment portfolios, and receive alerts for unusual spending or bill due dates. The app generates detailed reports and financial insights.",
      "The app includes features like bill reminders, subscription management, investment tracking, tax preparation assistance, and integration with financial institutions. It uses bank-level security and supports multiple currencies for international users. Future features include AI-powered financial coaching and retirement planning tools.",
      "Target audience includes working adults aged 25-55 who want to take control of their finances, young professionals starting their financial journey, and individuals planning for major life events like buying a home or retirement. They are financially conscious individuals who value organization, planning, and achieving financial stability."
    ]
  }
};

// Global function to load demo app
function loadDemoApp(appType) {
  if (!unifiedChat) {
    console.error('UnifiedChat not initialized');
    return;
  }

  const app = DEMO_APPS[appType];
  if (!app) {
    console.error('Demo app not found:', appType);
    return;
  }

  console.log('Loading demo app:', app.name);
  
  // Hide demo section
  const demoSection = document.getElementById('demoAppsSection');
  if (demoSection) {
    demoSection.classList.add('hidden');
  }

  // Reset chat state
  unifiedChat.resetForDemo();
  
  // Auto-fill answers
  unifiedChat.answers = [...app.answers];
  
  // Show all questions and answers immediately
  unifiedChat.messages = [];
  unifiedChat.currentQuestionIndex = 0;
  
  // Add system message
  unifiedChat.messages.push({
    id: Date.now(),
    type: 'system',
    content: `🚀 Demo Mode: ${app.name} loaded! Here are your answers:`
  });

  // Add each question and answer
  app.answers.forEach((answer, index) => {
    const question = unifiedChat.questions[index];
    
    // Add question
    unifiedChat.messages.push({
      id: Date.now() + index * 1000,
      type: 'system',
      content: `${index + 1}. ${question.question}`
    });
    
    // Add answer
    unifiedChat.messages.push({
      id: Date.now() + index * 1000 + 500,
      type: 'user',
      content: answer
    });
  });

  // Add final message
  unifiedChat.messages.push({
    id: Date.now() + 10000,
    type: 'system',
    content: '✅ All answers ready! Generating specification automatically...'
  });

  // Render messages
  unifiedChat.renderMessages();
  unifiedChat.scrollToBottom();
  
  // Update progress
  unifiedChat.updateProgress();
  
  // Auto-generate specification after a short delay
  setTimeout(() => {
    console.log('🚀 Auto-generating specification for demo app:', app.name);
    unifiedChat.generateSpecification();
  }, 2000);
  
  console.log('Demo app loaded successfully:', app.name);
}

// Make the chat globally accessible
window.unifiedChat = unifiedChat;