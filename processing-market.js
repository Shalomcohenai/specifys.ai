// Chat-based Market Research Mode
class MarketResearchChat {
  constructor() {
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.messages = [];
    
    // Questions configuration for Market Research
    this.questions = [
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

    this.init();
  }

  init() {
    // Mark current mode
    localStorage.setItem('currentMode', 'market');

    this.loadAnswers();
    this.setupEventListeners();
    this.displayFirstQuestion();
    this.updateProgress();
  }

  loadAnswers() {
    const savedAnswers = localStorage.getItem('marketAnswers');
    if (savedAnswers) {
      this.answers = JSON.parse(savedAnswers);
    }
  }

  saveAnswers() {
    localStorage.setItem('marketAnswers', JSON.stringify(this.answers));
  }

  setupEventListeners() {
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');
    const backButton = document.getElementById('backButton');

    if (sendButton) {
      sendButton.addEventListener('click', () => this.handleSend());
      // Disable initially until user types
      sendButton.disabled = true;
    }

    if (backButton) {
      backButton.addEventListener('click', () => this.goBack());
    }

    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
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

  displayFirstQuestion() {
    if (this.questions.length > 0) {
      this.showIntroMessages();
    }
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
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.innerHTML = `
          <div class="message-avatar">AI</div>
          <div class="message-content">
            <div class="message-text">${introMessages[messageIndex]}</div>
          </div>
        `;
        
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        messageIndex++;
        
        // Show next message after 1.5 seconds
        setTimeout(showNextMessage, 1500);
      } else {
        // After all intro messages, display the first question
        setTimeout(() => {
          this.displayQuestion(this.questions[0]);
        }, 500);
      }
    };

    showNextMessage();
  }

  displayQuestion(question) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    // Don't clear previous messages - add the new question to the conversation
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-content">
        <div class="message-text">${question.question}</div>
        ${question.examples ? `<div class="message-examples"><strong>Example:</strong> ${question.examples}</div>` : ''}
      </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  handleSend() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Save the answer
    this.answers[this.currentQuestionIndex] = message;
    this.saveAnswers();

    // Display user message
    this.displayUserMessage(message);

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Move to next question or complete
    this.moveToNextQuestion();
  }

  displayUserMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-avatar">You</div>
      <div class="message-content">
        <div class="message-text">${message}</div>
      </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  moveToNextQuestion() {
    this.currentQuestionIndex++;

    if (this.currentQuestionIndex < this.questions.length) {
      // Display next question
      setTimeout(() => {
        this.displayQuestion(this.questions[this.currentQuestionIndex]);
        this.updateProgress();
      }, 500);
    } else {
      // All questions completed
      this.completeQuestions();
    }
  }

  completeQuestions() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-content">
        <div class="message-text">Great! You've completed all the questions. Now let's generate your market research document.</div>
        <button class="yes-no-btn" onclick="marketChat.generateMarketResearch()">Generate Market Research</button>
      </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update progress to 100%
    this.updateProgress(100);
  }

  updateProgress(percentage = null) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (percentage === null) {
      percentage = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
    }

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
    }
  }

  async generateMarketResearch() {
    try {
      // Show loading state
      const chatMessages = document.getElementById('chatMessages');
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'message system';
      loadingDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
          <div class="message-text">Generating your market research document... Please wait.</div>
        </div>
      `;
      chatMessages.appendChild(loadingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Call the original function if it exists
      if (typeof generateSpecificationFromProcessingJs === 'function') {
        await generateSpecificationFromProcessingJs();
      } else {
        // Fallback: redirect to result page
        window.location.href = 'result-market.html';
      }
    } catch (error) {
      console.error('Error generating market research:', error);
      // Fallback: redirect to result page
      window.location.href = 'result-market.html';
    }
  }

  goBack() {
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
      
      // Remove the corresponding answer
      delete this.answers[this.currentQuestionIndex - 1];
      
      // Go back one question index
      this.currentQuestionIndex--;
      
      // Update progress
      this.updateProgress();
      
      // Update back button visibility
      this.updateBackButtonVisibility();
      
      // Re-render messages
      this.renderMessages();
      this.scrollToBottom();
      
      // Update UI for current question
      const currentQuestion = this.questions[this.currentQuestionIndex];
      if (currentQuestion) {
        this.updateUIForQuestion(currentQuestion);
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
      if (this.currentQuestionIndex > 0) {
        backButton.classList.add('show');
      } else {
        backButton.classList.remove('show');
      }
    }
  }


}

// Original function for generating market research
async function generateSpecificationFromProcessingJs() {
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

    const fullPrompt = `You are a professional product manager, market research expert, and business analyst with expertise in app-based ventures and digital products.

Your task is to generate a detailed and comprehensive **Market Research Document** for the given app idea. The document should be tailored to the "${currentMode}" mode, focusing on market analysis, business potential, and actionable insights for early-stage product validation.

Provide in-depth analysis with at least 3 examples per relevant section (e.g., competitors, existing solutions, pain points, etc.) to ensure a thorough understanding of the market landscape.

If a section is not relevant to the app or there is insufficient information to provide a detailed response, clearly state 'n/a' and explain briefly why. When possible, offer useful assumptions to fill in gaps.

Your response must be long, detailed, and utilize the maximum number of tokens available. Expand thoroughly on each section and include additional relevant insights when appropriate, even if not explicitly asked.

Use the structure below. Do not include Markdown symbols such as ##.

---

Market Research Document

App Name  
(The name of the app as provided by the user.)

Description  
(The app's purpose, key features, and target audience as provided by the user. Provide an in-depth analysis of the target audience, including: what motivates them to use the app (e.g., health, aesthetics, competitiveness), preferred types of activities (e.g., HIIT, yoga, strength training), gender segmentation (e.g., pregnant women, men seeking muscle gain), and platform preferences (e.g., iOS, Android).)

User Personas  
(Create 2-3 user personas representing the target audience. Each persona should include a name, age, gender, motivations, challenges, preferred activities, and platform preference.)

Key Features  
(The main features of the app as provided by the user.)

Existence Check  
(Does an app like this already exist? List at least 3 similar apps with their descriptions, advantages, and disadvantages according to user feedback, if available. If not relevant, state 'n/a' with a brief explanation.)

Pain Points  
(Identify at least 3 key pain points or challenges in the app's niche/topic that users commonly face, with detailed explanations. If not relevant, state 'n/a' with a brief explanation.)

Competitor Feature Comparison  
(Compare the app's proposed features, business models, and UX/UI design with at least 3 competitors. Provide a detailed analysis of how they differ in functionality, user experience, and monetization strategies. If not relevant, state 'n/a' with a brief explanation.)

Possible Business Models  
(Suggest at least 3 potential business models for the app, such as Freemium, monthly subscription, advertising, direct sales, etc. Explain the pros and cons of each model in the context of the app's niche and target audience. If not relevant, state 'n/a' with a brief explanation.)

Quality Assessment  
(Analyze the potential quality of the app idea based on market needs, user expectations, and feasibility. Provide a detailed rationale. If not relevant, state 'n/a' with a brief explanation.)

Unique Selling Proposition (USP)  
(Highlight the app's key differentiator that would make users choose it over competitors. Does it use AI for personalized plans? Does it support a community in a specific language (e.g., Hebrew)? Provide a clear and detailed explanation. If not relevant, state 'n/a' with a brief explanation.)

Pricing Compared to Competitors  
(Analyze the pricing strategies of at least 3 competitors, including specific prices for premium versions (e.g., Nike Training Club Premium, MyFitnessPal paid version), and suggest a competitive pricing strategy for the app, with detailed reasoning. If specific pricing data is unavailable, state 'n/a' and explain why.)

Expected ROI (Return on Investment)  
(Estimate the expected ROI for the app over a 1-3 year period, considering potential revenue. Include specific estimates for CAC (Cost of Acquiring Customer) and LTV (Lifetime Value). Provide revenue models for three scenarios: conservative, realistic, and optimistic, with clear assumptions. If not relevant, state 'n/a' with a brief explanation.)

KPI Framework  
(Define 3–5 key performance indicators that would be used to measure the app's success after launch. Include metrics such as retention rate, DAU, MAU, CAC, LTV, churn rate, and engagement rate. Explain why these are relevant.)

Niche Information  
(Provide detailed information about the app's niche/industry, including market trends, growth potential, and key challenges. If not relevant, state 'n/a' with a brief explanation.)

Search Statistics  
(Provide search statistics for at least 5 relevant keywords related to the app's niche (e.g., "fitness app", "sport", "workout", "health app", "exercise") over the last 6 months. Include approximate monthly search volumes from Google, TikTok, or other platforms, and note any trends or seasonal patterns. Use realistic estimates based on market data. If not relevant, state 'n/a' with a brief explanation.)

Statistics  
(Include relevant statistics such as market size, growth rate, user demographics, or other data points to support the analysis. If not relevant, state 'n/a' with a brief explanation.)

Analysis (SWOT)  
(Perform a detailed SWOT analysis: Strengths, Weaknesses, Opportunities, and Threats of the app idea in its market. If not relevant, state 'n/a' with a brief explanation.)

Rivals Comparison  
(Compare the app to at least 3 rivals in terms of market positioning, user base, and unique selling points. Provide an in-depth comparison. Include a Positioning Map that plots the app and competitors on two key parameters (e.g., personalization vs. video content). If not relevant, state 'n/a' with a brief explanation.)

Threats Overview  
(List at least 3 potential threats to the app's success, such as competition, market saturation, or technological challenges, with detailed explanations. If not relevant, state 'n/a' with a brief explanation.)

Complexity Rating  
(Rate the complexity of developing and launching the app on a scale of 1–10, with a detailed explanation of the factors contributing to the rating. If not relevant, state 'n/a' with a brief explanation.)

Insights  
(Provide actionable insights and recommendations for the app's development, market fit, and product positioning. Include at least 3 specific recommendations for each area. If not relevant, state 'n/a' with a brief explanation.)

Now, based on this structure, generate a full market research document for the following app idea:

**App Idea Details:**  
Details:  
${details}
`;

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

    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    window.location.href = 'result-market.html';
  } catch (err) {
    console.error('Error generating specification:', err);
    alert('Failed to generate market research: ' + err.message);
    const generateSpecButton = document.getElementById('goButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (generateSpecButton) generateSpecButton.disabled = false;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

// Initialize the chat when DOM is loaded
let marketChat;
document.addEventListener('DOMContentLoaded', () => {
  marketChat = new MarketResearchChat();
});

// Make the function globally accessible
window.marketChat = marketChat;