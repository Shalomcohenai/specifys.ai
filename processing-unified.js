// Unified Chat System for All Modes
class UnifiedChat {
  constructor() {
    this.currentMode = null;
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.messages = [];
    this.modeQuestions = {};
    
    // Initialize all mode questions
    this.initializeModeQuestions();
    
    this.init();
  }

  initializeModeQuestions() {
    // NoCode Creators Mode Questions
    this.modeQuestions.novice = [
      {
        id: 0,
        name: 'App Overview',
        question: 'What is the general purpose and idea of your app?',
        type: 'text',
        examples: 'My app, FitTrack, is a fitness and nutrition tracking platform designed to help users achieve their health goals. It allows users to log workouts, track meals, set fitness targets, and receive personalized recommendations based on their progress.'
      },
      {
        id: 1,
        name: 'User Workflow',
        question: 'Describe the typical workflow of a user using your app.',
        type: 'text',
        examples: 'A typical user starts by creating a profile and setting goals (e.g., weight loss or muscle gain). They log daily meals via a barcode scanner or manual input and record workouts by selecting exercises from a library. The app suggests meal plans and workout routines based on their progress.'
      },
      {
        id: 2,
        name: 'Design',
        question: 'What design elements are most important for your app?',
        type: 'text',
        examples: 'The app should have a clean, modern interface with a calming color palette (blues and greens). Large, bold typography ensures readability, and intuitive navigation with a bottom tab bar is key. Interactive charts for progress tracking and minimalistic icons enhance the user experience.'
      },
      {
        id: 3,
        name: 'Features',
        question: 'What key features do you want your app to have?',
        type: 'text',
        examples: 'Key features include: 1) AI-driven workout and meal suggestions, 2) Barcode scanner for food logging, 3) Social sharing to connect with friends, 4) Progress tracking with visual charts, 5) In-app reminders, and 6) Integration with wearables like Fitbit for real-time data.'
      },
      {
        id: 4,
        name: 'Target Audience',
        question: 'Who is your target audience?',
        type: 'text',
        examples: 'The target audience is health-conscious individuals aged 18-45, primarily fitness enthusiasts and beginners looking to improve their lifestyle. They are tech-savvy, use smartphones daily, and value convenience and personalization in their fitness journey.'
      },
      {
        id: 5,
        name: 'User Account System',
        question: 'Does your app require a user account system?',
        type: 'yesno'
      },
      {
        id: 6,
        name: 'AI Features',
        question: 'Does your app use or integrate with AI features?',
        type: 'yesno'
      },
      {
        id: 7,
        name: 'Free to Use',
        question: 'Will your app be free to use?',
        type: 'yesno'
      },
      {
        id: 8,
        name: 'Notifications',
        question: 'Does your app need to send notifications?',
        type: 'yesno'
      },
      {
        id: 9,
        name: 'Offline Mode',
        question: 'Does your app need to work offline?',
        type: 'yesno'
      },
      {
        id: 10,
        name: 'Multiple Languages',
        question: 'Will your app support multiple languages?',
        type: 'yesno'
      },
      {
        id: 11,
        name: 'Social Media Integration',
        question: 'Does your app require integration with social media?',
        type: 'yesno'
      },
      {
        id: 12,
        name: 'Analytics',
        question: 'Will your app collect user data for analytics?',
        type: 'yesno'
      },
      {
        id: 13,
        name: 'Additional Notes',
        question: 'Any additional notes or requirements for your app?',
        type: 'text',
        examples: 'The app should integrate with health wearables like Apple Watch and support push notifications for workout reminders. Future plans include adding a community feature for user challenges.'
      }
    ];

    // Developer Mode Questions
    this.modeQuestions.developer = [
      {
        id: 0,
        name: 'App Purpose',
        question: 'What is the main purpose and goal of your app? Describe the core functionality and what problem it solves.',
        type: 'text',
        examples: 'My app is a task management platform that helps remote teams collaborate effectively. It solves the problem of scattered communication and missed deadlines by providing a centralized hub for project tracking, team chat, and deadline management.'
      },
      {
        id: 1,
        name: 'User Workflow',
        question: 'Describe the primary user journey and workflow through your app. Include key user actions and decision points.',
        type: 'text',
        examples: 'Users start by creating or joining a project workspace. They can then create tasks, assign them to team members, set deadlines, and track progress. The app provides real-time notifications for updates and integrates with calendar apps for deadline management.'
      },
      {
        id: 2,
        name: 'Development Preferences',
        question: 'What are your preferred development methodologies, tools, and coding standards?',
        type: 'text',
        examples: 'I prefer Agile development with 2-week sprints, using Git Flow for version control, and following clean code principles. I use VS Code with ESLint and Prettier, prefer TypeScript for type safety, and follow RESTful API design patterns.'
      },
      {
        id: 3,
        name: 'Technologies',
        question: 'What technologies, frameworks, and third-party services do you want to use or are you considering?',
        type: 'text',
        examples: 'Frontend: React with TypeScript, Material-UI for components, Redux for state management. Backend: Node.js with Express, PostgreSQL database, Redis for caching. Third-party: Stripe for payments, SendGrid for emails, AWS S3 for file storage.'
      },
      {
        id: 4,
        name: 'Data Information',
        question: 'What types of data will your app handle? Describe the main entities, relationships, and data flow.',
        type: 'text',
        examples: 'Main entities: Users, Projects, Tasks, Teams, Comments. Users can belong to multiple teams, projects contain multiple tasks, tasks can have multiple assignees and comments. Data includes user profiles, project metadata, task details, and real-time chat messages.'
      }
    ];

    // Market Research Mode Questions
    this.modeQuestions.market = [
      {
        id: 0,
        name: 'Description',
        question: 'What is the purpose of your app, its key features, and who is the target audience (e.g., age, interests, needs)?',
        type: 'text',
        examples: 'FitTrack helps fitness enthusiasts track workouts and progress. Features: workout logging, progress charts, community challenges. Target: adults 18-40 who exercise regularly.'
      },
      {
        id: 1,
        name: 'Features',
        question: 'What are the key features that make your app unique or valuable in the market?',
        type: 'text',
        examples: 'Workout logging with voice input, real-time progress charts, social sharing, personalized plans, and integration with wearables.'
      }
    ];
  }

  init() {
    console.log('UnifiedChat init() called');
    
    // Check if this is a fresh page load (not a refresh)
    const isRefresh = performance.navigation.type === 1;
    if (isRefresh) {
      console.log('Page was refreshed, clearing localStorage');
      this.clearAllLocalStorage();
    }
    
    this.loadSavedData();
    this.setupEventListeners();
    this.startChat();
    console.log('UnifiedChat init() completed');
  }

  clearAllLocalStorage() {
    // Clear all localStorage items
    localStorage.removeItem('unifiedAnswers');
    localStorage.removeItem('unifiedAnswers_novice');
    localStorage.removeItem('unifiedAnswers_developer');
    localStorage.removeItem('unifiedAnswers_market');
    localStorage.removeItem('unifiedChatMessages');
    localStorage.removeItem('unifiedCurrentMode');
    localStorage.removeItem('currentMode');
    localStorage.removeItem('formData');
    localStorage.removeItem('noCodeAnswers');
    localStorage.removeItem('devAnswers');
    localStorage.removeItem('marketAnswers');
    localStorage.removeItem('generatedContent');
    console.log('All localStorage cleared');
  }

  loadSavedData() {
    // Load saved answers based on mode
    const savedMode = localStorage.getItem('unifiedCurrentMode');
    if (savedMode && this.modeQuestions[savedMode]) {
      this.currentMode = savedMode;
      const savedAnswers = localStorage.getItem(`unifiedAnswers_${savedMode}`);
      if (savedAnswers) {
        this.answers = JSON.parse(savedAnswers);
      }
    }

    // Load saved messages
    const savedMessages = localStorage.getItem('unifiedChatMessages');
    if (savedMessages) {
      this.messages = JSON.parse(savedMessages);
    }
  }

  saveData() {
    if (this.currentMode) {
      localStorage.setItem('unifiedCurrentMode', this.currentMode);
      localStorage.setItem(`unifiedAnswers_${this.currentMode}`, JSON.stringify(this.answers));
    }
    localStorage.setItem('unifiedChatMessages', JSON.stringify(this.messages));
  }

  setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const backButton = document.getElementById('backButton');
    const resetButton = document.getElementById('resetButton');
    
    if (sendButton) {
      sendButton.addEventListener('click', () => this.handleSend());
      sendButton.disabled = true;
    }

    if (backButton) {
      backButton.addEventListener('click', () => this.goBack());
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
    console.log('startChat() called, messages length:', this.messages.length);
    if (this.messages.length === 0) {
      console.log('No messages, showing intro messages');
      this.showIntroMessages();
    } else {
      console.log('Messages exist, rendering them');
      this.renderMessages();
    }
    // Update back button visibility
    this.updateBackButtonVisibility();
  }

  showIntroMessages() {
    console.log('showIntroMessages() called');
    const introMessages = [
      "Hi! 👋",
      "I'm your personal assistant and my job is to help you reach the perfect application!",
      "You can talk to me in any language you want, but for convenience you'll receive the final document in English",
      "First, let's choose which mode you'd like to use..."
    ];

    let messageIndex = 0;
    const showNextMessage = () => {
      console.log('showNextMessage called, index:', messageIndex);
      if (messageIndex < introMessages.length) {
        const message = {
          id: Date.now() + messageIndex,
          type: 'system',
          content: introMessages[messageIndex],
          isIntro: true
        };
        this.messages.push(message);
        console.log('Added intro message:', message);
        this.renderMessages();
        this.scrollToBottom();
        messageIndex++;
        
        setTimeout(showNextMessage, 1500);
      } else {
        console.log('All intro messages shown, showing mode selection');
        setTimeout(() => {
          this.showModeSelection();
          this.updateBackButtonVisibility();
        }, 500);
      }
    };

    showNextMessage();
  }

  showModeSelection() {
    const modeSelectionMessage = {
      id: Date.now(),
      type: 'system',
      content: 'Which mode would you like to use?',
      isModeSelection: true
    };

    this.messages.push(modeSelectionMessage);
    this.renderMessages();
    this.scrollToBottom();
  }

  renderMessages() {
    console.log('renderMessages() called');
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
      console.error('chatMessages element not found!');
      return;
    }
    console.log('Found chatMessages element, clearing and rendering', this.messages.length, 'messages');

    chatMessages.innerHTML = '';

    this.messages.forEach((message, index) => {
      console.log('Rendering message', index, ':', message);
      if (message.isModeSelection) {
        this.renderModeSelection(chatMessages);
      } else if (message.isIntro) {
        this.renderSystemMessage(chatMessages, message.content);
      } else if (message.type === 'system') {
        this.renderSystemMessage(chatMessages, message.content, message.examples, message.questionType);
      } else if (message.type === 'user') {
        this.renderUserMessage(chatMessages, message.content);
      }
    });
  }

  renderModeSelection(container) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'S';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `
      <div class="message-text">Which mode would you like to use?</div>
      <div class="mode-selection">
        <div class="mode-option" data-mode="novice">
          <i class="fas fa-magic mode-icon"></i>
          <div class="mode-title">NoCode Creator</div>
          <div class="mode-description">Simple app planning for non-programmers</div>
        </div>
        <div class="mode-option" data-mode="developer">
          <i class="fas fa-code mode-icon"></i>
          <div class="mode-title">Developer</div>
          <div class="mode-description">Technical architecture planning</div>
        </div>
        <div class="mode-option" data-mode="market">
          <i class="fas fa-chart-line mode-icon"></i>
          <div class="mode-title">Market Research</div>
          <div class="mode-description">Market analysis and business planning</div>
        </div>
      </div>
    `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    container.appendChild(messageDiv);

    // Add event listeners to mode options
    const modeOptions = contentDiv.querySelectorAll('.mode-option');
    modeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const selectedMode = option.dataset.mode;
        this.selectMode(selectedMode);
      });
    });
  }

  selectMode(mode) {
    this.currentMode = mode;
    this.currentQuestionIndex = 0;
    this.answers = {};
    
    // Clear mode selection message and add confirmation
    this.messages = this.messages.filter(msg => !msg.isModeSelection);
    
    const confirmationMessage = {
      id: Date.now(),
      type: 'system',
      content: `Great choice! You've selected ${this.getModeDisplayName(mode)} mode. Let's start with the questions...`
    };
    
    this.messages.push(confirmationMessage);
    this.renderMessages();
    this.scrollToBottom();
    
    setTimeout(() => {
      this.askQuestion();
      this.updateBackButtonVisibility();
    }, 1000);
  }

  getModeDisplayName(mode) {
    const names = {
      novice: 'NoCode Creator',
      developer: 'Developer',
      market: 'Market Research'
    };
    return names[mode] || mode;
  }

  askQuestion() {
    if (!this.currentMode || this.currentQuestionIndex >= this.modeQuestions[this.currentMode].length) {
      this.showCompletionMessage();
      return;
    }

    const question = this.modeQuestions[this.currentMode][this.currentQuestionIndex];
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
    this.updateBackButtonVisibility();
  }

  updateUIForQuestion(question) {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    if (question.type === 'yesno') {
      chatInput.style.display = 'none';
      sendButton.style.display = 'none';
      
      // Add yes/no buttons
      this.addYesNoButtons();
    } else {
      chatInput.style.display = 'block';
      sendButton.style.display = 'block';
      sendButton.disabled = true;
      
      // Remove yes/no buttons if they exist
      this.removeYesNoButtons();
    }
  }

  addYesNoButtons() {
    const chatInputArea = document.getElementById('chatInputArea');
    
    // Remove existing yes/no buttons
    this.removeYesNoButtons();
    
    const yesNoContainer = document.createElement('div');
    yesNoContainer.className = 'yes-no-buttons';
    yesNoContainer.innerHTML = `
      <button class="yes-no-button" data-answer="yes">Yes</button>
      <button class="yes-no-button" data-answer="no">No</button>
    `;
    
    chatInputArea.appendChild(yesNoContainer);
    
    // Add event listeners
    const buttons = yesNoContainer.querySelectorAll('.yes-no-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const answer = button.dataset.answer;
        this.handleYesNoAnswer(answer);
      });
    });
  }

  removeYesNoButtons() {
    const existingButtons = document.querySelector('.yes-no-buttons');
    if (existingButtons) {
      existingButtons.remove();
    }
  }

  handleYesNoAnswer(answer) {
    // Disable all yes/no buttons immediately to prevent multiple clicks
    const buttons = document.querySelectorAll('.yes-no-button');
    buttons.forEach(button => {
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    });
    
    this.handleAnswer(answer);
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
    const currentQuestion = this.modeQuestions[this.currentMode][this.currentQuestionIndex];
    
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

    // Remove yes/no buttons immediately after answer
    this.removeYesNoButtons();

    // Render messages
    this.renderMessages();
    this.scrollToBottom();

    // Move to next question
    this.currentQuestionIndex++;
    
    // Save progress
    this.saveData();
    
    // Update back button visibility
    this.updateBackButtonVisibility();

    // Ask next question or complete
    if (this.currentQuestionIndex < this.modeQuestions[this.currentMode].length) {
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
      content: 'Perfect! I have all the information I need. Let me generate your specification...'
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
      console.log('Starting generateSpecification for mode:', this.currentMode);
      console.log('Answers:', this.answers);
      
      // Show loading overlay
      this.showLoadingOverlay();

      const loadingMessage = {
        id: Date.now(),
        type: 'system',
        content: '🔄 Generating your specification... This may take a few moments.'
      };

      this.messages.push(loadingMessage);
      this.renderMessages();
      this.scrollToBottom();

      let apiUrl, prompt;
      
      if (this.currentMode === 'novice') {
        apiUrl = 'https://newnocode.shalom-cohen-111.workers.dev/';
        prompt = PROMPTS.novice(this.answers);
        console.log('Using Novice Mode API:', apiUrl);
      } else if (this.currentMode === 'developer') {
        apiUrl = 'https://newnocode.shalom-cohen-111.workers.dev';
        prompt = PROMPTS.developer(this.answers);
        console.log('Using Developer Mode API:', apiUrl);
      } else if (this.currentMode === 'market') {
        apiUrl = 'https://super-dream-62b3.shalom-cohen-111.workers.dev/';
        prompt = PROMPTS.market(this.answers);
        console.log('Using Market Mode API:', apiUrl);
      }

      console.log('Full prompt constructed:', prompt);
      console.log('Prompt length (characters):', prompt.length);
      console.log('Sending request with prompt:', prompt);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      console.log('API response status received:', response.status);
      console.log('API response headers:', Object.fromEntries(response.headers.entries()));

      let data;
      try {
        data = await response.json();
        console.log('API response data received:', data);
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        const textResponse = await response.text();
        console.log('Raw API response:', textResponse);
        throw new Error(`API Error: Failed to parse response (Status: ${response.status})`);
      }

      if (!response.ok) {
        console.error('API Error Details:', data);
        throw new Error(`API Error: ${data.error || data.message || response.status}`);
      }
      
      const generatedContent = data.specification || 'No specification generated';
      console.log('Generated content extracted:', generatedContent);
      console.log('Generated content length:', generatedContent.length);

      // Store the generated content
      localStorage.setItem('generatedContent', generatedContent);
      localStorage.setItem('unifiedCurrentMode', this.currentMode);
      localStorage.setItem(`unifiedAnswers_${this.currentMode}`, JSON.stringify(this.answers));
      
      // Store additional data for compatibility with original systems
      if (this.currentMode === 'novice') {
        localStorage.setItem('formData', JSON.stringify({ 
          idea: this.answers[0] || 'Not provided',
          topic: 'App Planning',
          platform: 'Mobile/Web',
          currentMode: 'nocode'
        }));
        localStorage.setItem('noCodeAnswers', JSON.stringify(this.answers));
        console.log('Saved formData and noCodeAnswers to localStorage');
      } else if (this.currentMode === 'developer') {
        localStorage.setItem('devAnswers', JSON.stringify(this.answers));
        console.log('Saved devAnswers to localStorage');
      } else if (this.currentMode === 'market') {
        localStorage.setItem('marketAnswers', JSON.stringify(this.answers));
        console.log('Saved marketAnswers to localStorage');
      }



      // Hide loading overlay
      this.hideLoadingOverlay();

      // Show success message
      const successMessage = {
        id: Date.now(),
        type: 'system',
        content: '✅ Specification generated successfully! Redirecting to results...'
      };

      this.messages.push(successMessage);
      this.renderMessages();
      this.scrollToBottom();

      // Redirect to appropriate result page
      console.log('Redirecting to result page for mode:', this.currentMode);
      setTimeout(() => {
        if (this.currentMode === 'novice') {
          console.log('Redirecting to result-novice.html');
          window.location.href = 'result-novice.html';
        } else if (this.currentMode === 'developer') {
          console.log('Redirecting to result.html');
          window.location.href = 'result.html';
        } else if (this.currentMode === 'market') {
          console.log('Redirecting to result-market.html');
          window.location.href = 'result-market.html';
        }
      }, 2000);

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

  renderSystemMessage(container, content, examples, questionType) {
    console.log('renderSystemMessage called with:', { content, examples, questionType });
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
    console.log('System message rendered and added to container');
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
      
      // Update the corresponding answer in localStorage
      const questionIndex = Math.floor((messageIndex - 1) / 2); // Assuming pairs of system + user messages
      if (questionIndex >= 0 && questionIndex < this.modeQuestions[this.currentMode].length) {
        const question = this.modeQuestions[this.currentMode][questionIndex];
        if (question) {
          this.answers[question.id] = newContent;
        }
      }
      
      // Save to localStorage
      this.saveData();
      
      console.log('Message edited and saved:', { originalContent, newContent });
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

  saveEditedMessage(originalContent, newContent) {
    // Update the message in the messages array
    const messageIndex = this.messages.findIndex(msg => 
      msg.type === 'user' && msg.content === originalContent
    );
    
    if (messageIndex !== -1) {
      this.messages[messageIndex].content = newContent;
      
      // Update the corresponding answer in localStorage
      const questionIndex = Math.floor((messageIndex - 1) / 2); // Assuming pairs of system + user messages
      if (questionIndex >= 0 && questionIndex < this.modeQuestions[this.currentMode].length) {
        const question = this.modeQuestions[this.currentMode][questionIndex];
        if (question) {
          this.answers[question.id] = newContent;
        }
      }
      
      // Save to localStorage
      this.saveData();
      
      // Re-render the specific message to update the UI
      this.renderMessages();
      
      console.log('Message edited and saved:', { originalContent, newContent });
    }
  }

  updateProgress() {
    if (!this.currentMode) return;

    // Count only text questions (yes/no questions are grouped as one)
    const textQuestions = this.modeQuestions[this.currentMode].filter(q => q.type === 'text');
    const yesNoQuestions = this.modeQuestions[this.currentMode].filter(q => q.type === 'yesno');
    const totalQuestions = textQuestions.length + (yesNoQuestions.length > 0 ? 1 : 0);
    
    // Calculate current question number (treat all yes/no as one question)
    let currentQuestionNumber = 0;
    for (let i = 0; i <= this.currentQuestionIndex; i++) {
      const question = this.modeQuestions[this.currentMode][i];
      if (question.type === 'text') {
        currentQuestionNumber++;
      } else if (question.type === 'yesno' && i === this.currentQuestionIndex) {
        // This is the first yes/no question, count it as one
        currentQuestionNumber++;
        break;
      }
    }
    
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

  scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  goBack() {
    console.log('Going back...');
    console.log('Current messages:', this.messages.length);
    
    // If no messages, don't do anything
    if (this.messages.length === 0) {
      return;
    }
    
    // Always remove the last 2 messages (question + answer) if they exist
    let messagesToRemove = 0;
    let removedUserAnswer = false;
    
    // Check if the last message is a user answer
    if (this.messages.length > 0 && this.messages[this.messages.length - 1].type === 'user') {
      messagesToRemove = 1;
      removedUserAnswer = true;
      
      // Check if the message before that is a system question
      if (this.messages.length > 1 && 
          this.messages[this.messages.length - 2].type === 'system' && 
          !this.messages[this.messages.length - 2].isIntro && 
          !this.messages[this.messages.length - 2].isModeSelection) {
        messagesToRemove = 2;
      }
    } else if (this.messages.length > 0 && 
               this.messages[this.messages.length - 1].type === 'system' && 
               !this.messages[this.messages.length - 1].isIntro && 
               !this.messages[this.messages.length - 1].isModeSelection) {
      // If the last message is a system question without answer, remove just it
      messagesToRemove = 1;
    }
    
    console.log(`Will remove ${messagesToRemove} messages`);
    
    // Remove the messages
    if (messagesToRemove > 0) {
      for (let i = 0; i < messagesToRemove; i++) {
        this.messages.pop();
      }
      
      // If we removed a user answer, also remove the corresponding answer from localStorage
      if (removedUserAnswer) {
        const lastQuestion = this.modeQuestions[this.currentMode][this.currentQuestionIndex - 1];
        if (lastQuestion) {
          delete this.answers[lastQuestion.id];
        }
        
        // Go back one question index
        this.currentQuestionIndex--;
      }
      
      // Update progress
      this.updateProgress();
      
      // Save the updated state
      this.saveData();
      
      // Remove any existing yes/no buttons
      this.removeYesNoButtons();
      
      // Re-render messages
      this.renderMessages();
      this.scrollToBottom();
      
      // Update back button visibility
      this.updateBackButtonVisibility();
      
      // Ask the previous question again if we went back
      if (removedUserAnswer && this.currentQuestionIndex >= 0) {
        setTimeout(() => {
          this.askQuestion();
        }, 500);
      }
      
      console.log(`Removed ${messagesToRemove} messages, went back to question`, this.currentQuestionIndex);
      return;
    }
    
    // If we're at the first question and want to go back to mode selection
    if (this.currentQuestionIndex === 0 && this.messages.some(msg => msg.isModeSelection)) {
      this.currentMode = null;
      this.currentQuestionIndex = 0;
      this.answers = {};
      
      // Clear all messages except intro and mode selection
      this.messages = this.messages.filter(msg => msg.isIntro || msg.isModeSelection);
      
      // Clear localStorage for this mode
      if (this.currentMode) {
        localStorage.removeItem(`unifiedAnswers_${this.currentMode}`);
      }
      localStorage.removeItem('unifiedCurrentMode');
      localStorage.removeItem('unifiedChatMessages');
      
      // Save the updated state
      this.saveData();
      
      this.showModeSelection();
      this.updateBackButtonVisibility();
      
      console.log('Went back to mode selection');
      return;
    }
    
    // If we're at the first question and want to go back to mode selection
    if (this.currentQuestionIndex === 0 && this.messages.some(msg => msg.isModeSelection)) {
      this.currentMode = null;
      this.currentQuestionIndex = 0;
      this.answers = {};
      
      // Clear all messages except intro and mode selection
      this.messages = this.messages.filter(msg => msg.isIntro || msg.isModeSelection);
      
      // Clear localStorage for this mode
      if (this.currentMode) {
        localStorage.removeItem(`unifiedAnswers_${this.currentMode}`);
      }
      localStorage.removeItem('unifiedCurrentMode');
      localStorage.removeItem('unifiedChatMessages');
      
      // Save the updated state
      this.saveData();
      
      this.showModeSelection();
      this.updateBackButtonVisibility();
      
      console.log('Went back to mode selection');
      return;
    }
  }

  updateBackButtonVisibility() {
    const backButton = document.getElementById('backButton');
    const resetButton = document.getElementById('resetButton');
    
    if (backButton) {
      // Show button if we have messages (except intro messages) or if we have a mode selected
      if (this.messages.length > 0 && !this.messages.every(msg => msg.isIntro)) {
        backButton.classList.add('show');
      } else {
        backButton.classList.remove('show');
      }
    }
    
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
      this.currentMode = null;
      this.currentQuestionIndex = 0;
      this.answers = {};
      this.messages = [];
      
      // Clear all localStorage items
      this.clearAllLocalStorage();
      
      // Clear UI
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }
      
      // Remove any yes/no buttons
      this.removeYesNoButtons();
      
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
      this.updateBackButtonVisibility();
      
      // Start fresh
      this.startChat();
    }
  }





  showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
      console.log('Loading overlay shown');
    }
  }

  hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
      console.log('Loading overlay hidden');
    }
  }


}

// Initialize the chat when DOM is loaded
let unifiedChat;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  console.log('Creating new UnifiedChat instance');
  unifiedChat = new UnifiedChat();
  console.log('UnifiedChat instance created:', unifiedChat);
});

// Make the chat globally accessible
window.unifiedChat = unifiedChat;

// Keep the original functions for compatibility
window.generateSpecificationFromProcessingNoviceJs = async function() {
  try {
    console.log('Starting generateSpecificationFromProcessingNoviceJs');
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    console.log('Form data:', { idea, topic, platform });

    const answers = JSON.parse(localStorage.getItem('noCodeAnswers')) || {};
    console.log('Answers:', answers);

    let details = '';
    const steps = [
      { name: 'App Overview', question: 'What is the general purpose and idea of your app?' },
      { name: 'User Workflow', question: 'Describe the typical workflow of a user using your app.' },
      { name: 'Design', question: 'What design elements are most important for your app?' },
      { name: 'Features', question: 'What key features do you want your app to have?' },
      { name: 'Target Audience', question: 'Who is your target audience?' },
      { name: 'User Account System', question: 'Does your app require a user account system?', type: 'yesno' },
      { name: 'AI Features', question: 'Does your app use or integrate with AI features?', type: 'yesno' },
      { name: 'Free to Use', question: 'Will your app be free to use?', type: 'yesno' },
      { name: 'Notifications', question: 'Does your app need to send notifications?', type: 'yesno' },
      { name: 'Offline Mode', question: 'Does your app need to work offline?', type: 'yesno' },
      { name: 'Multiple Languages', question: 'Will your app support multiple languages?', type: 'yesno' },
      { name: 'Social Media Integration', question: 'Does your app require integration with social media?', type: 'yesno' },
      { name: 'Analytics', question: 'Will your app collect user data for analytics?', type: 'yesno' },
      { name: 'Additional Notes', question: 'Any additional notes or requirements for your app?' }
    ];

    steps.forEach((step, index) => {
      const response = index < 5 ? answers[index] || 'Not provided' : 
                      index < 13 ? answers[`yesNo_${index}`] || 'Not specified' : 
                      answers[index] || 'Not provided';
      if (step.type === 'yesno') {
        details += `${step.question}: ${response}\n`;
      } else {
        details += `${step.name}: ${response}\n`;
      }
    });

    const fullPrompt = PROMPTS.novice(answers);
    console.log('Full prompt:', fullPrompt);

    // Send the prompt to the worker
    console.log('Sending request to worker...');
    console.log('Worker URL:', 'https://newnocode.shalom-cohen-111.workers.dev/');
    console.log('Request payload:', { prompt: fullPrompt });
    
    const response = await fetch('https://newnocode.shalom-cohen-111.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    console.log('Worker response status:', response.status);
    console.log('Worker response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('Worker returned error status:', response.status);
      console.error('Response status text:', response.statusText);
      throw new Error(`Worker Error: HTTP ${response.status} - ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('Worker raw response text:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Worker parsed response data:', data);
    } catch (parseError) {
      console.error('Failed to parse worker response as JSON:', parseError);
      console.error('Raw response that failed to parse:', responseText);
      throw new Error(`Worker returned invalid JSON: ${parseError.message}`);
    }

    if (!data.specification) {
      console.error('Worker response missing specification field:', data);
      throw new Error('Worker response missing specification field');
    }

    const generatedContent = data.specification;
    console.log('Generated content from worker length:', generatedContent.length);
    console.log('Generated content preview (first 200 chars):', generatedContent.substring(0, 200));

    // Store the generated content for the result page
    localStorage.setItem('generatedContent', generatedContent);
    localStorage.setItem('formData', JSON.stringify({ idea, topic, platform, currentMode: 'nocode' }));
    localStorage.setItem('noCodeAnswers', JSON.stringify(answers));
    
    console.log('Successfully stored data in localStorage, redirecting to result page...');

    // Redirect to result page
    window.location.href = 'result-novice.html';
    
  } catch (error) {
    console.error('Error in generateSpecificationFromProcessingNoviceJs:', error);
    throw error;
  }
};

// Keep the original function for developer mode compatibility
window.generateSpecificationFromProcessingJs = async function() {
  try {
    console.log('Starting generateSpecificationFromProcessingJs');
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    console.log('Form data:', { idea, topic, platform });

    const answers = JSON.parse(localStorage.getItem('devAnswers')) || {};
    console.log('Answers:', answers);

    const userInput = `
      1. App Purpose: ${answers[0] || 'Not provided'}
      2. User Workflow: ${answers[1] || 'Not provided'}
      3. Development Preferences: ${answers[2] || 'Not provided'}
      4. Technologies: ${answers[3] || 'Not provided'}
      5. Data Information: ${answers[4] || 'Not provided'}
    `;

    const fullPrompt = PROMPTS.developer(answers);
    console.log('Full prompt constructed:', fullPrompt);
    console.log('Prompt length (characters):', fullPrompt.length);
    console.log('Sending request with prompt:', fullPrompt);
    
    const response = await fetch('https://newnocode.shalom-cohen-111.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    console.log('API response status received:', response.status);
    const data = await response.json();
    console.log('API response data received:', data);

    if (!response.ok) {
      throw new Error(`API Error: ${data.error || 'Unknown error'}`);
    }

    const generatedContent = data.specification || 'No specification generated';
    console.log('Generated content extracted:', generatedContent);

    console.log('Saving generated content to localStorage');
    localStorage.setItem('generatedContent', generatedContent);



    console.log('Redirecting to result.html immediately');
    window.location.href = 'result.html';
  } catch (err) {
    console.error('Error in generateSpecificationFromProcessingJs:', err.message);
    alert('Failed to generate specification: ' + err.message);
  }
};

// Keep the original function for market mode compatibility
window.generateSpecificationFromProcessingMarketJs = async function() {
  try {
    const answers = JSON.parse(localStorage.getItem('marketAnswers')) || {};
    const currentMode = localStorage.getItem('currentMode') || 'market';

    let details = '';
    const steps = [
      { name: 'App Name and Platform', question: 'What is the name of your app idea and which platform will it be on (e.g., iOS, Android, Web)?' },
      { name: 'Description', question: 'Describe your app\'s purpose, key features, and target audience.' },
      { name: 'Key Features', question: 'What are the main features you want your app to have?' }
    ];

    steps.forEach((step, index) => {
      const response = answers[index] || 'Not provided';
      details += `${step.name}: ${response}\n`;
    });

    const fullPrompt = PROMPTS.market(answers);

    const response = await fetch('https://super-dream-62b3.shalom-cohen-111.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`API Error: ${data.error || 'Unknown error'}`);
    }

    const generatedContent = data.specification || 'No market research generated';
    console.log('Generated content extracted:', generatedContent);
    localStorage.setItem('generatedContent', generatedContent);

    window.location.href = 'result-market.html';
  } catch (err) {
    console.error('Error generating specification:', err);
    alert('Failed to generate market research: ' + err.message);
  }
};
