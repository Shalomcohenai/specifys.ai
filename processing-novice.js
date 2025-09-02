// Chat-based NoCode Creators Mode
class NoCodeChat {
  constructor() {
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.messages = [];
    
    // Questions configuration
    this.questions = [
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

    this.init();
  }

  // Helper function to create system messages
  createSystemMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    
    const avatar = document.createElement("div");
    avatar.className = 'message-avatar';
    avatar.textContent = 'S';

    const contentDiv = document.createElement("div");
    contentDiv.className = 'message-content';

    const textDiv = document.createElement("div");
    textDiv.className = 'message-text';
    textDiv.textContent = text;

    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
  }

  init() {
    // Clear localStorage to start fresh every time
    this.clearLocalStorage();
    
    this.loadSavedData();
    this.setupEventListeners();
    this.startChat();
  }

  clearLocalStorage() {
    // Clear all nocode-related data to start fresh
    localStorage.removeItem('noCodeAnswers');
    localStorage.removeItem('noCodeChatMessages');
    localStorage.removeItem('generatedContent');
    localStorage.removeItem('formData');
    console.log('LocalStorage cleared for fresh start');
  }

  loadSavedData() {
    // Load saved answers
    const savedAnswers = localStorage.getItem('noCodeAnswers');
    if (savedAnswers) {
      this.answers = JSON.parse(savedAnswers);
    }

    // Load saved messages
    const savedMessages = localStorage.getItem('noCodeChatMessages');
    if (savedMessages) {
      this.messages = JSON.parse(savedMessages);
      this.currentQuestionIndex = this.messages.length / 2; // Each Q&A pair = 2 messages
    }

    // Set current mode
    localStorage.setItem('currentMode', 'nocode');
  }

  setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const backButton = document.getElementById('backButton');

    // Send button click (from input area)
    sendButton.addEventListener('click', () => this.handleSend());
    // Disable initially until user types
    sendButton.disabled = true;

    // Back button
    if (backButton) {
      backButton.addEventListener('click', () => this.goBack());
    }

    // Enter key press
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
      this.autoResizeTextarea(chatInput);
      sendButton.disabled = !chatInput.value.trim();
    });

    // Load saved messages if they exist
    if (this.messages.length > 0) {
      this.renderMessages();
      this.updateProgress();
      
      // Update UI for current question
      const currentQuestion = this.questions[this.currentQuestionIndex];
      if (currentQuestion) {
        this.updateUIForQuestion(currentQuestion);
      }
    }
  }

  startChat() {
    if (this.messages.length === 0) {
      this.showIntroMessages();
    }
    // Update back button visibility
    this.updateBackButtonVisibility();
  }

  showIntroMessages() {
    const introMessages = [
      "Hi! 👋",
      "I'm your personal assistant and my job is to help you reach the perfect application!",
      "You can talk to me in any language you want, but for convenience you'll receive the final document in English",
      "Let's start with a few questions to understand your app idea better..."
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
        
        // Show next message after 1.5 seconds
        setTimeout(showNextMessage, 1500);
      } else {
        // After all intro messages, ask the first question
        setTimeout(() => {
          this.askQuestion();
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
    
    // Update UI based on question type
    this.updateUIForQuestion(question);
  }

  updateUIForQuestion(question) {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    if (question.type === 'yesno') {
      chatInput.style.display = 'none';
      sendButton.style.display = 'none';
    } else {
      chatInput.style.display = 'block';
      sendButton.style.display = 'block';
      sendButton.disabled = true;
      sendButton.onclick = () => this.handleSend();
      
      // Add input event listener to enable/disable send button
      chatInput.addEventListener('input', () => {
        sendButton.disabled = !chatInput.value.trim();
      });
    }
  }

  handleSend() {
    const chatInput = document.getElementById('chatInput');
    const answer = chatInput.value.trim();
    
    if (!answer) return;

    const currentQuestion = this.questions[this.currentQuestionIndex];
    
    // Check if currentQuestion exists
    if (!currentQuestion) {
      console.error('No current question found, currentQuestionIndex:', this.currentQuestionIndex);
      return;
    }
    
    // Save answer
    if (currentQuestion.type === 'yesno') {
      this.answers[`yesNo_${currentQuestion.id}`] = answer;
    } else {
      this.answers[currentQuestion.id] = answer;
    }

    // Check if we're updating an existing answer or adding a new one
    const existingAnswerIndex = this.messages.findIndex(msg => 
      msg.type === 'user' && msg.questionId === currentQuestion.id
    );
    
    if (existingAnswerIndex !== -1) {
      // Update existing user message
      this.messages[existingAnswerIndex].content = answer;
    } else {
      // Add new user message
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: answer,
        questionId: currentQuestion.id
      };
      this.messages.push(userMessage);
    }
    
    // Save to localStorage
    localStorage.setItem('noCodeAnswers', JSON.stringify(this.answers));
    localStorage.setItem('noCodeChatMessages', JSON.stringify(this.messages));

    // Clear input
    chatInput.value = '';
    this.autoResizeTextarea(chatInput);

    // Move to next question
    this.currentQuestionIndex++;
    
    // Render and ask next question
    this.renderMessages();
    this.updateProgress();
    this.scrollToBottom();
    
    // Check if all questions are answered
    const allQuestionsAnswered = this.checkAllQuestionsAnswered();
    if (allQuestionsAnswered) {
      // If all questions answered, automatically start the flow
      console.log('All questions answered - automatically starting specification generation');
      setTimeout(() => {
        this.generateSpecification();
      }, 1000);
    } else {
      // Small delay before asking next question
      setTimeout(() => {
        this.askQuestion();
      }, 500);
    }
  }

  handleYesNoAnswer(answer) {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    
    // Check if we're updating an existing answer or adding a new one
    const existingAnswerIndex = this.messages.findIndex(msg => 
      msg.type === 'user' && msg.questionId === currentQuestion.id
    );
    
    // Save answer
    this.answers[`yesNo_${currentQuestion.id}`] = answer;

    if (existingAnswerIndex !== -1) {
      // Update existing user message
      this.messages[existingAnswerIndex].content = answer;
    } else {
      // Add new user message
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: answer,
        questionId: currentQuestion.id
      };
      this.messages.push(userMessage);
    }
    
    // Save to localStorage
    localStorage.setItem('noCodeAnswers', JSON.stringify(this.answers));
    localStorage.setItem('noCodeChatMessages', JSON.stringify(this.messages));

    // Move to next question
    this.currentQuestionIndex++;
    
    // Render and ask next question
    this.renderMessages();
    this.updateProgress();
    this.scrollToBottom();

    // Check if all questions are answered
    const allQuestionsAnswered = this.checkAllQuestionsAnswered();
    if (allQuestionsAnswered) {
      // If all questions answered, automatically start the flow
      console.log('All questions answered - automatically starting specification generation');
      setTimeout(() => {
        this.generateSpecification();
      }, 1000);
    } else {
      // Small delay before asking next question
      setTimeout(() => {
        this.askQuestion();
      }, 500);
    }
  }

  renderMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      chatMessages.appendChild(messageElement);
    });
  }

  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.type}`;
    messageDiv.id = `message-${message.id}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.type === 'system' ? 'S' : 'U';

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';
    
    // For system messages, make the question bold
    if (message.type === 'system') {
      text.innerHTML = `<strong>${message.content}</strong>`;
    } else {
      text.textContent = message.content;
      

    }

    content.appendChild(text);

    // Add hidden examples and tips divs for system messages (for future use)
    if (message.type === 'system' && message.examples) {
      // Add hidden examples and tips divs
      const examplesDiv = document.createElement('div');
      examplesDiv.className = 'message-examples hidden';
      examplesDiv.textContent = `💡 Example: ${message.examples}`;
      content.appendChild(examplesDiv);
      
      const tipsDiv = document.createElement('div');
      tipsDiv.className = 'message-tips hidden';
      tipsDiv.textContent = `💡 Tip: Think about what would be most helpful for your users and how to make the app intuitive.`;
      content.appendChild(tipsDiv);
    }

    // Add Yes/No buttons for yesno questions
    if (message.type === 'system' && message.questionType === 'yesno') {
      const buttons = document.createElement('div');
      buttons.className = 'yes-no-buttons';
      
      const yesBtn = document.createElement('button');
      yesBtn.className = 'yes-no-btn';
      yesBtn.textContent = 'Yes';
      
      // Check if user already answered this question
      const userAnswer = this.answers[`yesNo_${message.questionId}`];
      if (userAnswer === 'Yes') {
        yesBtn.classList.add('selected');
      }
      
      yesBtn.onclick = () => this.handleYesNoAnswer('Yes');
      
      const noBtn = document.createElement('button');
      noBtn.className = 'yes-no-btn';
      noBtn.textContent = 'No';
      
      if (userAnswer === 'No') {
        noBtn.classList.add('selected');
      }
      
      noBtn.onclick = () => this.handleYesNoAnswer('No');
      
      buttons.appendChild(yesBtn);
      buttons.appendChild(noBtn);
      content.appendChild(buttons);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    return messageDiv;
  }

  updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    // Count only text questions (yes/no questions are grouped as one)
    const textQuestions = this.questions.filter(q => q.type === 'text');
    const yesNoQuestions = this.questions.filter(q => q.type === 'yesno');
    const totalQuestions = textQuestions.length + (yesNoQuestions.length > 0 ? 1 : 0);
    
    // Calculate current question number (treat all yes/no as one question)
    let currentQuestionNumber = 0;
    for (let i = 0; i <= this.currentQuestionIndex; i++) {
      const question = this.questions[i];
      if (question.type === 'text') {
        currentQuestionNumber++;
      } else if (question.type === 'yesno' && i === this.currentQuestionIndex) {
        // This is the first yes/no question, count it as one
        currentQuestionNumber++;
        break;
      }
    }
    
    const progress = (currentQuestionNumber / totalQuestions) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Question ${currentQuestionNumber} of ${totalQuestions}`;
  }



  checkAllQuestionsAnswered() {
    console.log('Checking all questions answered...');
    console.log('Current answers:', this.answers);
    
    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions[i];
      console.log(`Checking question ${i}: ${question.name} (${question.type})`);
      
      if (question.type === 'yesno') {
        const answer = this.answers[`yesNo_${question.id}`];
        console.log(`Yes/No question ${question.id}: ${answer}`);
        if (!answer || (answer !== 'Yes' && answer !== 'No')) {
          console.log(`Question ${i} (${question.name}) not answered:`, answer);
          return false;
        }
      } else {
        const answer = this.answers[question.id];
        console.log(`Text question ${question.id}: ${answer}`);
        if (!answer || !answer.trim()) {
          console.log(`Question ${i} (${question.name}) not answered:`, answer);
          return false;
        }
      }
    }
    console.log('All questions answered!');
    return true;
  }

  showCompletionMessage() {
    console.log('Showing completion message...');
    
    const message = {
      id: Date.now(),
      type: 'system',
      content: 'Great! You\'ve answered all the questions. The send button below is now enabled for final submission.',
      isCompletion: true
    };

    this.messages.push(message);
    this.renderMessages();
    this.updateProgress();
    this.scrollToBottom();
    
    // Enable send button for final submission
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      sendButton.style.display = 'block';
      sendButton.disabled = false;
      sendButton.onclick = () => this.generateSpecification();
      console.log('Send button enabled for final submission');
    }
  }

  async generateSpecification() {
    try {
      console.log('Starting specification generation...');
      
      // Show flowing messages before sending to worker
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        // Message 1: Answers received
        const message1 = this.createSystemMessage("Your answers have been received! 📝");
        chatMessages.appendChild(message1);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Message 2: Analyzing data
        setTimeout(() => {
          const message2 = this.createSystemMessage("Analyzing your requirements... 🔍");
          chatMessages.appendChild(message2);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
        
        // Message 3: Generating specification
        setTimeout(() => {
          const message3 = this.createSystemMessage("Generating comprehensive specification... ⚡");
          chatMessages.appendChild(message3);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 2000);
        
        // Message 4: Creating development steps
        setTimeout(() => {
          const message4 = this.createSystemMessage("Creating detailed development steps... 🚀");
          chatMessages.appendChild(message4);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 3000);
        
        // Message 5: Sending to AI
        setTimeout(() => {
          const message5 = this.createSystemMessage("Sending to AI for processing... 🤖");
          chatMessages.appendChild(message5);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          
          // After showing all messages, proceed with generation immediately
          setTimeout(() => {
            this.proceedWithGeneration();
          }, 500);
        }, 4000);
      } else {
        // If chatMessages not found, proceed immediately
        this.proceedWithGeneration();
      }
      
    } catch (error) {
      console.error('Error generating specification:', error);
      // Fallback: redirect to result page
      window.location.href = 'result-novice.html';
    }
  }

  async proceedWithGeneration() {
    try {
      // Call the original function
      if (typeof window.generateSpecificationFromProcessingNoviceJs === 'function') {
        await window.generateSpecificationFromProcessingNoviceJs();
      } else {
        // Fallback: redirect to result page
        window.location.href = 'result-novice.html';
      }
    } catch (error) {
      console.error('Error in proceedWithGeneration:', error);
      // Fallback: redirect to result page
      window.location.href = 'result-novice.html';
    }
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  goBack() {
    console.log('Going back...');
    
    // If no messages, don't do anything
    if (this.messages.length === 0) {
      return;
    }
    
    // Get the last message
    const lastMessage = this.messages[this.messages.length - 1];
    
    // If last message is a user answer, remove it and the corresponding answer
    if (lastMessage.type === 'user') {
      // Remove the last user message
      this.messages.pop();
      
      // Remove the corresponding answer from localStorage
      const lastQuestion = this.questions[this.currentQuestionIndex - 1];
      if (lastQuestion) {
        if (lastQuestion.type === 'yesno') {
          delete this.answers[`yesNo_${lastQuestion.id}`];
        } else {
          delete this.answers[lastQuestion.id];
        }
      }
      
      // Go back one question index
      this.currentQuestionIndex--;
      
      // Update progress
      this.updateProgress();
      
      // Save the updated state
      this.saveData();
      
      // Re-render messages
      this.renderMessages();
      this.scrollToBottom();
      
      // Update back button visibility
      this.updateBackButtonVisibility();
      
      // Ask the previous question again (this is the key fix!)
      if (this.currentQuestionIndex >= 0) {
        setTimeout(() => {
          this.askQuestion();
        }, 500);
      }
      
      console.log('Removed user answer, went back to question', this.currentQuestionIndex);
      return;
    }
    
    // If last message is a system question, remove it
    if (lastMessage.type === 'system' && !lastMessage.isIntro) {
      // Remove the last system message
      this.messages.pop();
      
      // Re-render messages
      this.renderMessages();
      this.scrollToBottom();
      
      // Update back button visibility
      this.updateBackButtonVisibility();
      
      console.log('Removed system question');
      return;
    }
  }

  updateBackButtonVisibility() {
    const backButton = document.getElementById('backButton');
    if (backButton) {
      // Show button if we have messages (except intro messages) or if we're past the first question
      if (this.messages.length > 0 && !this.messages.every(msg => msg.isIntro)) {
        backButton.classList.add('show');
      } else {
        backButton.classList.remove('show');
      }
    }
  }



}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NoCodeChat();
});

// Keep the original function for compatibility
async function generateSpecificationFromProcessingNoviceJs() {
  try {
    console.log('Starting generateSpecificationFromProcessingNoviceJs');
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    const currentMode = localStorage.getItem('currentMode') || 'nocode';
    console.log('Form data:', { idea, topic, platform, currentMode });

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

    const fullPrompt = `You are a professional product manager, UX architect, and development team lead.  

Your task is to generate a comprehensive **APPLICATION SPECIFICATION DOCUMENT** for software developers.

The goal is to help a **non-technical user** who described their app idea.  
Your output will be a detailed technical specification that can be used by developers to build the app.

**CRITICAL REQUIREMENTS:**
- **ONLY generate the application specification. DO NOT include any development steps, prompts, or implementation details.**
- **Your response must be EXTREMELY detailed, verbose, and comprehensive. Use the maximum possible output length.**
- **Go deep into every detail - don't summarize, don't simplify.**
- **Include technical details down to the level of variables, functions, and data structures.**
- **Every section should be at least 5-10 paragraphs long with specific examples and scenarios.**
- **Use real-world examples and detailed explanations for every concept.**
- **If the user input is vague or incomplete, proactively fill in missing parts** using reasonable assumptions based on standard UX and software design best practices.
- **Strictly respect explicit user answers, especially 'No' responses for features like AI integration. Do not add features that were explicitly declined.**
- **In case of contradictions between open-ended text answers and yes/no choice answers, prioritize the open-ended text answers.**
- **For 'Not specified' responses, assume the app supports English only. Do not suggest additional languages.**
- **Include detailed edge cases for user flows, such as network failures, invalid inputs, or conflicting actions.**
- **Specify validation rules for all data model attributes, including minimum/maximum lengths, formats, and required fields.**
- **Include a comprehensive list of screens, including settings and profile screens, even if not explicitly mentioned.**
- **Include detailed technical specifications for APIs, database schemas, and system architecture.**
- **Specify exact data types, field names, and relationships for all data models.**
- **Include detailed error handling scenarios and user feedback mechanisms.**
- **Specify exact UI component specifications including dimensions, colors, fonts, and responsive behavior.**
- **Include detailed security considerations and authentication flows.**
- **Specify exact API endpoints, request/response formats, and error codes.**
- **Include detailed performance requirements and optimization strategies.**
- **Specify exact integration points with external services if applicable.**

**MANDATORY MERMAID DIAGRAMS:**
You MUST include these Mermaid diagrams within your specification:

1. **User Flow Diagram** - Show complete user journey with all decision points
2. **Data Flow Diagram** - Show how data moves through the system
3. **Navigation Diagram** - Show screen relationships and navigation paths
4. **Database Schema Diagram** - Show data models and relationships

**OUTPUT FORMAT:**
Your response must follow this exact structure with NO markdown symbols (##):

Application Specification Document

General Information
Topic: [exact topic]
Platform: [exact platform]
Suggested App Title: [specific title]
General Idea Summary: [5-10 paragraph detailed summary]

Problem Statement
[5-10 paragraph detailed problem analysis with emotional and behavioral aspects]

Core Features
[Numbered list with 5-10 paragraphs per feature, including exact behavior, variations, and purpose]

User Flow
[Step-by-step detailed flow with 10+ steps, including all alternative paths, errors, and edge cases]

Mermaid User Flow Diagram:
\`\`\`mermaid
[comprehensive flowchart with all decision points and paths]
\`\`\`

Screens
[Detailed description of every screen with 5-10 paragraphs each, including exact functionality]

UI Components per Screen
[Screen Name]
- [Detailed list of all UI elements with exact specifications]
- [Detailed interactions, transitions, and conditional states]

Navigation Map
[Detailed navigation logic with 5-10 paragraphs explaining screen connections]

Mermaid Navigation Diagram:
\`\`\`mermaid
[comprehensive navigation graph]
\`\`\`

Data Models
[Detailed data structures with 5-10 paragraphs each, including exact field names, types, validation rules, and relationships]

Mermaid Database Schema:
\`\`\`mermaid
[comprehensive ERD showing all entities and relationships]
\`\`\`

Data Flow
[Detailed explanation of how data moves through the system with 5-10 paragraphs]

Mermaid Data Flow Diagram:
\`\`\`mermaid
[comprehensive data flow diagram]
\`\`\`

Technical Architecture
[Detailed system architecture with 5-10 paragraphs, including APIs, services, and infrastructure]

Security & Authentication
[Detailed security measures with 5-10 paragraphs, including exact authentication flows]

Performance & Scalability
[Detailed performance requirements with 5-10 paragraphs, including optimization strategies]

Error Handling & User Feedback
[Detailed error scenarios with 5-10 paragraphs, including exact user feedback mechanisms]

Integration Points
[Detailed external integrations with 5-10 paragraphs, including exact API specifications]

Testing & Quality Assurance
[Detailed testing strategy with 5-10 paragraphs, including specific test scenarios]

Deployment & Maintenance
[Detailed deployment process with 5-10 paragraphs, including maintenance procedures]

**REMEMBER:**
- Generate ONLY the specification document
- Be EXTREMELY detailed and verbose
- Include ALL mandatory Mermaid diagrams
- Go deep into technical specifics
- Use maximum output length
- Do not include development steps or prompts
- Focus on comprehensive technical specification only

Now, based on the user's detailed answers, generate the most comprehensive and detailed application specification document possible.`;

    console.log('Full prompt:', fullPrompt);

    // Send the prompt to the worker
    console.log('Sending request to worker...');
    console.log('Worker URL:', 'https://newnocode.shalom-cohen-111.workers.dev/');
    console.log('Request payload:', { prompt: fullPrompt });
    
    try {
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
      localStorage.setItem('formData', JSON.stringify({ idea, topic, platform, currentMode }));
      localStorage.setItem('noCodeAnswers', JSON.stringify(answers));
      
      console.log('Successfully stored data in localStorage, redirecting to result page...');

      // Redirect to result page
      window.location.href = 'result-novice.html';
      
    } catch (fetchError) {
      console.error('Fetch error details:', fetchError);
      console.error('Error name:', fetchError.name);
      console.error('Error message:', fetchError.message);
      console.error('Error stack:', fetchError.stack);
      
      if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
        console.error('Network or CORS error detected');
        throw new Error(`Network error: ${fetchError.message}. Please check your internet connection and try again.`);
      } else if (fetchError.name === 'TypeError' && fetchError.message.includes('JSON')) {
        console.error('JSON parsing error detected');
        throw new Error(`Invalid response from server: ${fetchError.message}`);
      } else {
        throw new Error(`Request failed: ${fetchError.message}`);
      }
    }

  } catch (error) {
    console.error('Error in generateSpecificationFromProcessingNoviceJs:', error);
    throw error;
  }
}