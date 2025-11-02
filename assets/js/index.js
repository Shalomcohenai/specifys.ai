// Index Page JavaScript - Specifys.ai
// Optimized and cleaned up version

// ===== MODAL FUNCTIONS =====
function showWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function showRegistrationModal() {
  const modal = document.getElementById('registrationModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeRegistrationModal() {
  const modal = document.getElementById('registrationModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// ===== FIRST VISIT CHECK =====
function checkFirstVisit() {
  const hasVisited = localStorage.getItem('hasVisited');
  if (!hasVisited) {
    setTimeout(showWelcomeModal, 1000);
    localStorage.setItem('hasVisited', 'true');
  }
}

// ===== MENU TOGGLE =====
function toggleMenu() {
  const menu = document.querySelector('.clip-path-menu');
  const navicon = document.querySelector('.navicon');
  
  if (menu && navicon) {
    menu.classList.toggle('active');
    navicon.classList.toggle('active');
  }
}

// ===== FAQ TOGGLE =====
function toggleFAQ(index) {
  const faqItem = document.querySelector(`.faq-item:nth-child(${index + 1})`);
  if (faqItem) {
    const question = faqItem.querySelector('.faq-question');
    const answer = faqItem.querySelector('.faq-answer');
    
    if (question && answer) {
      question.classList.toggle('open');
      answer.classList.toggle('open');
    }
  }
}

// Helper function to round to nearest 5
function roundToNearest5(num) {
  return Math.round(num / 5) * 5;
}

// ===== LOAD DYNAMIC STATS =====
async function loadDynamicStats() {
  try {
    // Get tools count from tools.json only (no Firestore on homepage)
    const toolsResponse = await fetch('/tools/map/tools.json');
    const toolsData = await toolsResponse.json();
    const toolsCount = Array.isArray(toolsData) ? toolsData.length : 0;
    
    // Use static base values for counters (no Firestore)
    const specsWithBase = 4590;
    
    // Calculate Tool Finder users (specs + base multiplier)
    const toolFinderUsers = specsWithBase + 850; // Adding 850 to specs count
    
    // Round all numbers to nearest 5
    const toolsRounded = roundToNearest5(toolsCount);
    const specsRounded = roundToNearest5(specsWithBase);
    const toolFinderRounded = roundToNearest5(toolFinderUsers);
    
    // Update the targets
    const toolsCounter = document.querySelector('[data-stats-type="tools"]');
    const specsCounter = document.querySelector('[data-stats-type="specs"]');
    const toolFinderCounter = document.querySelector('[data-stats-type="tool-finder"]');
    
    if (toolsCounter) {
      toolsCounter.setAttribute('data-target', toolsRounded.toString());
    }
    
    if (specsCounter) {
      specsCounter.setAttribute('data-target', specsRounded.toString());
    }
    
    if (toolFinderCounter) {
      toolFinderCounter.setAttribute('data-target', toolFinderRounded.toString());
    }
    
    console.log('Dynamic stats loaded:', {
      tools: toolsRounded,
      specs: specsRounded,
      toolFinder: toolFinderRounded
    });
    
  } catch (error) {
    console.error('Error loading dynamic stats:', error);
    // Fallback to default values (rounded to nearest 5)
    const toolsCounter = document.querySelector('[data-stats-type="tools"]');
    const specsCounter = document.querySelector('[data-stats-type="specs"]');
    const toolFinderCounter = document.querySelector('[data-stats-type="tool-finder"]');
    
    if (toolsCounter) toolsCounter.setAttribute('data-target', '105');
    if (specsCounter) specsCounter.setAttribute('data-target', '4590');
    if (toolFinderCounter) toolFinderCounter.setAttribute('data-target', '850');
  }
}

// ===== COUNTER ANIMATION =====
function animateCounter(element, target, duration = 2000) {
  let current = 0;
  const step = 5; // Jump by 5 each time
  
  // Calculate number of steps needed
  const steps = Math.ceil(target / step);
  const stepInterval = duration / steps;
  
  function updateCounter() {
    current += step;
    if (current < target) {
      element.textContent = current + '+';
      setTimeout(updateCounter, stepInterval);
    } else {
      // Make sure we end exactly on target (round to nearest 5)
      const finalValue = Math.round(target / step) * step;
      element.textContent = finalValue + '+';
    }
  }
  
  updateCounter();
}

// ===== TOOLS SHOWCASE ANIMATION =====
function animateToolsShowcase() {
  const tools = document.querySelectorAll('.tool-square');
  tools.forEach((tool, index) => {
    setTimeout(() => {
      tool.style.opacity = '1';
      tool.style.transform = 'translateY(0)';
    }, index * 100);
  });
}

// ===== ANALYTICS TRACKING =====
function trackStartNowClick() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'click', {
      event_category: 'engagement',
      event_label: 'start_now_button'
    });
  }
}

// ===== AUTHENTICATION CHECK =====
function isUserAuthenticated() {
  return firebase.auth().currentUser !== null;
}

// ===== START BUTTON HANDLER =====
function handleStartButtonClick() {
  trackStartNowClick();
  
  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    // Show alert and redirect to auth page
    alert('You must be logged in to create a specification. Please sign in or register first.');
    window.location.href = '/pages/auth.html';
    return;
  }
  
  // Proceed with app planning only if authenticated
  proceedWithAppPlanning();
}

// ===== APP PLANNING FLOW =====
function proceedWithAppPlanning() {
  const heroContent = document.getElementById('heroContent');
  const heroTitle = document.querySelector('.hero-main-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');
  const heroButtonContainer = document.querySelector('.hero-button-container');
  
  if (heroContent) heroContent.classList.add('fade-out');
  if (heroTitle) heroTitle.classList.add('fade-out');
  if (heroSubtitle) heroSubtitle.classList.add('fade-out');
  if (heroButtonContainer) heroButtonContainer.classList.add('fade-out');
  
  setTimeout(() => {
    showModernInput();
  }, 1000);
}

// ===== INTERACTIVE QUESTIONS SYSTEM =====
let currentQuestionIndex = 0;
let answers = [];
let selectedPlatforms = {
  mobile: false,
  web: false
};

// Speech recognition variables
let recognition = null;
let isRecording = false;

const questions = [
  "Describe your application",
  "Describe the workflow", 
  "Target audience and goals",
  "Additional details"
];

const questionDetails = [
  "Describe the main idea of your application - including core features, target audience, and the problem it solves",
  "Walk through a typical user journey step by step - explain how users interact with different features and workflows",
  "Define your primary user demographics (age, profession, etc.) and explain what goals users want to achieve with your app",
  "Add any technical requirements, integrations with other services, future features, or special considerations"
];

function showModernInput() {
  const inputContainer = document.getElementById('modernInputContainer');
  const questionsDisplay = document.getElementById('questionsDisplay');
  
  if (inputContainer) {
    inputContainer.style.display = 'block';
    setTimeout(() => {
      inputContainer.classList.add('fade-in');
    }, 100);
  }
  
  if (questionsDisplay) {
    questionsDisplay.style.display = 'block';
    showCurrentQuestion();
    setTimeout(() => {
      questionsDisplay.classList.add('fade-in');
    }, 100);
  }
}

function showCurrentQuestion() {
  const currentQuestionElement = document.getElementById('currentQuestion');
  const currentQuestionDetailElement = document.getElementById('currentQuestionDetail');
  
  if (currentQuestionElement && currentQuestionIndex < questions.length) {
    // Remove any existing animation classes
    currentQuestionElement.classList.remove('fade-out', 'fade-in', 'slide-in');
    if (currentQuestionDetailElement) {
      currentQuestionDetailElement.classList.remove('fade-out', 'fade-in', 'slide-in');
    }
    
    // Set the new question text
    currentQuestionElement.textContent = questions[currentQuestionIndex];
    
    // Set the question detail
    if (currentQuestionDetailElement) {
      currentQuestionDetailElement.textContent = questionDetails[currentQuestionIndex];
    }
    
    // Add slide-in animation for the first question
    currentQuestionElement.classList.add('slide-in');
    if (currentQuestionDetailElement) {
      currentQuestionDetailElement.classList.add('slide-in');
    }
  }
  
  // Update progress dots
  updateProgressDots();
  
  // Update lightbulb tooltip based on current question
  updateLightbulbTooltip();
}

function updateProgressDots() {
  const dots = document.querySelectorAll('.progress-dot');
  dots.forEach((dot, index) => {
    dot.classList.remove('current', 'completed', 'error');
    
    // If we've reached the last question or beyond, mark all as completed
    if (currentQuestionIndex >= questions.length) {
      dot.classList.add('completed');
    } else if (index < currentQuestionIndex) {
      // Completed questions
      dot.classList.add('completed');
    } else if (index === currentQuestionIndex) {
      // Current question
      dot.classList.add('current');
    }
  });
}

function markUnansweredQuestionsAsError() {
  const dots = document.querySelectorAll('.progress-dot');
  dots.forEach((dot, index) => {
    // Mark first 3 questions as error if not answered (excluding last question)
    if (index < 3 && (!answers[index] || answers[index].trim() === '')) {
      dot.classList.add('error');
    }
  });
}

function updateLightbulbTooltip() {
// Removed duplicated tooltip init block (handled by updateLightbulbTooltip)
}

function jumpToQuestion(questionIndex) {
  if (questionIndex >= 0 && questionIndex < questions.length) {
    // Save current answer before jumping
    const textarea = document.getElementById('mainInput');
    if (textarea && textarea.value.trim()) {
      answers[currentQuestionIndex] = textarea.value.trim();
    }
    
    currentQuestionIndex = questionIndex;
    
    // Restore answer if exists
    if (textarea) {
      textarea.value = answers[currentQuestionIndex] || '';
    }
    
    // Update button state after restoring answer
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      const textLength = textarea.value.trim().length;
      const isLastQuestion = currentQuestionIndex === questions.length - 1;
      const minLength = isLastQuestion ? 0 : 20;
      
      // Always keep button enabled for navigation, but change visual style
      sendBtn.disabled = false;
      
      if (textLength >= minLength) {
        sendBtn.style.background = '#FF6B35';
        sendBtn.style.cursor = 'pointer';
        sendBtn.style.opacity = '1';
      } else {
        sendBtn.style.background = '#cccccc';
        sendBtn.style.cursor = 'pointer';
        sendBtn.style.opacity = '0.6';
      }
      
      // Update button text
      if (sendBtn.querySelector('.send-text')) {
        const sendText = sendBtn.querySelector('.send-text');
        if (currentQuestionIndex >= questions.length - 1) {
          sendText.textContent = 'Generate';
        } else {
          sendText.textContent = 'Next';
        }
      }
    }
    
    // Show the question with animation
    const currentQuestionElement = document.getElementById('currentQuestion');
    if (currentQuestionElement) {
      currentQuestionElement.classList.add('fade-out');
      const currentQuestionDetailElement = document.getElementById('currentQuestionDetail');
      if (currentQuestionDetailElement) {
        currentQuestionDetailElement.classList.add('fade-out');
      }
      
      setTimeout(() => {
        currentQuestionElement.textContent = questions[currentQuestionIndex];
        if (currentQuestionDetailElement) {
          currentQuestionDetailElement.textContent = questionDetails[currentQuestionIndex];
        }
        currentQuestionElement.classList.remove('fade-out');
        currentQuestionElement.classList.add('slide-in');
        if (currentQuestionDetailElement) {
          currentQuestionDetailElement.classList.remove('fade-out');
          currentQuestionDetailElement.classList.add('slide-in');
        }
        updateProgressDots();
        updateLightbulbTooltip();
      }, 600);
    }
  }
}
  const tooltipContent = document.querySelector('.tooltip-content');
  if (tooltipContent) {
    const tooltips = [
      "💡 Be specific about your app's main purpose and core features\n💡 Mention the platform (web, mobile, desktop) you're targeting\n💡 Include key functionalities that make your app unique\n💡 Describe the problem your app solves for users",
      "💡 Walk through a typical user journey step by step\n💡 Explain how users interact with different features\n💡 Describe the main user actions and workflows\n💡 Include any important user flows or processes", 
      "💡 Define your primary user demographics (age, profession, etc.)\n💡 Explain what goals users want to achieve with your app\n💡 Describe your target market and user needs\n💡 Mention any specific user personas or segments",
      "💡 Add any technical requirements or constraints\n💡 Mention integrations with other services or platforms\n💡 Include future features or expansion plans\n💡 Add any special considerations or unique aspects"
    ];
    
    const currentTooltip = tooltips[currentQuestionIndex] || "💡 Provide detailed and specific information for better results";
    tooltipContent.textContent = currentTooltip;
  }

function nextQuestion() {
  const textarea = document.getElementById('mainInput');
  const answer = textarea.value.trim();
  
  // Allow empty answer only on the last question
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  if (!isLastQuestion && !answer) return;
  
  // Save the answer (can be empty on last question)
  answers[currentQuestionIndex] = answer;
  
  // Clear the textarea
  textarea.value = '';
  
  // Move to next question
  currentQuestionIndex++;
  
  if (currentQuestionIndex < questions.length) {
    // Show next question with enhanced transition
    const currentQuestionElement = document.getElementById('currentQuestion');
    if (currentQuestionElement) {
      // Add fade-out animation
      currentQuestionElement.classList.add('fade-out');
      const currentQuestionDetailElement = document.getElementById('currentQuestionDetail');
      if (currentQuestionDetailElement) {
        currentQuestionDetailElement.classList.add('fade-out');
      }
      
      // Wait for fade-out to complete, then show new question
      setTimeout(() => {
        currentQuestionElement.textContent = questions[currentQuestionIndex];
        if (currentQuestionDetailElement) {
          currentQuestionDetailElement.textContent = questionDetails[currentQuestionIndex];
        }
        currentQuestionElement.classList.remove('fade-out');
        currentQuestionElement.classList.add('slide-in');
        if (currentQuestionDetailElement) {
          currentQuestionDetailElement.classList.remove('fade-out');
          currentQuestionDetailElement.classList.add('slide-in');
        }
        // Update tooltip for the new question
        updateLightbulbTooltip();
        // Update progress dots
        updateProgressDots();
        
        // Update button text if last question
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn && sendBtn.querySelector('.send-text')) {
          const sendText = sendBtn.querySelector('.send-text');
          if (currentQuestionIndex >= questions.length - 1) {
            sendText.textContent = 'Generate';
          } else {
            sendText.textContent = 'Next';
          }
        }
        
        // Update button state to reflect new question
        const textarea = document.getElementById('mainInput');
        if (textarea && sendBtn) {
          const textLength = textarea.value.trim().length;
          const isLast = currentQuestionIndex >= questions.length - 1;
          const minLength = isLast ? 0 : 20;
          
          if (textLength >= minLength) {
            sendBtn.style.background = '#FF6B35';
            sendBtn.style.cursor = 'pointer';
            sendBtn.style.opacity = '1';
          } else {
            sendBtn.style.background = '#cccccc';
            sendBtn.style.cursor = 'pointer';
            sendBtn.style.opacity = '0.6';
          }
        }
      }, 600); // Match the CSS transition duration
    }
  } else {
    // All questions completed - call API
    console.log('All questions completed:', answers);
    generateSpecification();
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    // Move to previous question
    currentQuestionIndex--;
    
    // Restore the previous answer
    const textarea = document.getElementById('mainInput');
    if (textarea) {
      textarea.value = answers[currentQuestionIndex] || '';
    }
    
    // Show previous question with enhanced transition
    const currentQuestionElement = document.getElementById('currentQuestion');
    if (currentQuestionElement) {
      // Add fade-out animation
      currentQuestionElement.classList.add('fade-out');
      
      // Wait for fade-out to complete, then show previous question
      setTimeout(() => {
        currentQuestionElement.textContent = questions[currentQuestionIndex];
        const currentQuestionDetailElement = document.getElementById('currentQuestionDetail');
        if (currentQuestionDetailElement) {
          currentQuestionDetailElement.textContent = questionDetails[currentQuestionIndex];
        }
        currentQuestionElement.classList.remove('fade-out');
        currentQuestionElement.classList.add('slide-in');
        // Update tooltip for the new question
        updateLightbulbTooltip();
        // Update progress dots
        updateProgressDots();
      }, 600); // Match the CSS transition duration
    }
  }
}

// ===== MODERN INPUT SETUP =====
function setupModernInput() {
  const textarea = document.getElementById('mainInput');
  const sendBtn = document.getElementById('sendBtn');
  
  if (!textarea || !sendBtn) return;
  
  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
  
  // Function to update button state based on text length
  function updateButtonState() {
    const textLength = textarea.value.trim().length;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const minLength = isLastQuestion ? 0 : 20;
    
    // Always keep button enabled for navigation, but change visual style
    sendBtn.disabled = false;
    
    if (textLength >= minLength) {
      // Orange (active) button
      sendBtn.style.background = '#FF6B35';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.opacity = '1';
    } else {
      // Gray (less visible) button but still clickable
      sendBtn.style.background = '#cccccc';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.opacity = '0.6';
    }
  }
  
  textarea.addEventListener('input', function() {
    autoResize();
    updateButtonState();
  });
  
  textarea.addEventListener('keyup', updateButtonState);
  
  // Initialize button state
  updateButtonState();
  
  sendBtn.addEventListener('click', function() {
    // Platform validation check
    if (!selectedPlatforms.mobile && !selectedPlatforms.web) {
      triggerPlatformHint();
      return;
    }
    
    // If on last question and trying to generate, check first 3 answers
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    if (isLastQuestion) {
      // Save current answer if exists
      const currentAnswer = textarea.value.trim();
      if (currentAnswer) {
        answers[currentQuestionIndex] = currentAnswer;
      }
      
      // Check if first 3 questions are answered
      let allAnswered = true;
      for (let i = 0; i < 3; i++) {
        if (!answers[i] || answers[i].trim() === '') {
          allAnswered = false;
          break;
        }
      }
      
      if (!allAnswered) {
        // Mark unanswered questions as error
        markUnansweredQuestionsAsError();
        // Temporarily shake the button or show error
        sendBtn.style.animation = 'shake 0.5s';
        setTimeout(() => {
          sendBtn.style.animation = '';
        }, 500);
        return;
      }
    }
    
    nextQuestion();
    autoResize();
    updateButtonState();
  });

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
    
    if (e.key === 'Backspace' && textarea.value === '') {
      e.preventDefault();
      previousQuestion();
    }
  });
  
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('id');
      
      if (id === 'phoneBtn') {
        // Toggle mobile selection
        selectedPlatforms.mobile = !selectedPlatforms.mobile;
        this.classList.toggle('selected');
      } else if (id === 'computerBtn') {
        // Toggle web selection
        selectedPlatforms.web = !selectedPlatforms.web;
        this.classList.toggle('selected');
      } else if (id === 'microphoneBtn') {
        // Handle microphone click - start/stop recording
        toggleRecording();
      } else if (id === 'lightbulbBtn') {
        // Handle lightbulb click - show tips or suggestions
        showLightbulbTips();
      } else {
        console.log(id + ' clicked');
      }
    });
  });
  
  // Add hover events for lightbulb tooltip - only on lightbulb button
  const lightbulbBtn = document.getElementById('lightbulbBtn');
  const lightbulbTooltip = document.getElementById('lightbulbTooltip');
  
  if (lightbulbBtn && lightbulbTooltip) {
    lightbulbBtn.addEventListener('mouseenter', function() {
      lightbulbTooltip.classList.add('show');
    });
    
    lightbulbBtn.addEventListener('mouseleave', function() {
      lightbulbTooltip.classList.remove('show');
    });
    
    // Also hide tooltip when hovering over the tooltip itself
    lightbulbTooltip.addEventListener('mouseenter', function() {
      lightbulbTooltip.classList.add('show');
    });
    
    lightbulbTooltip.addEventListener('mouseleave', function() {
      lightbulbTooltip.classList.remove('show');
    });
  }
  
  // Ensure other buttons don't trigger lightbulb tooltip
  const phoneBtn = document.getElementById('phoneBtn');
  const computerBtn = document.getElementById('computerBtn');
  
  if (phoneBtn) {
    phoneBtn.addEventListener('mouseenter', function() {
      if (lightbulbTooltip) {
        lightbulbTooltip.classList.remove('show');
      }
    });
  }
  
  if (computerBtn) {
    computerBtn.addEventListener('mouseenter', function() {
      if (lightbulbTooltip) {
        lightbulbTooltip.classList.remove('show');
      }
    });
  }
  
  // Add click events for progress dots
  const progressDots = document.querySelectorAll('.progress-dot');
  progressDots.forEach((dot, index) => {
    dot.addEventListener('click', function() {
      // Allow jumping to any dot
      if (index === currentQuestionIndex) return; // Already on this question
      
      // Save current answer before jumping
      const textarea = document.getElementById('mainInput');
      const currentAnswer = textarea ? textarea.value.trim() : '';
      if (currentAnswer) {
        answers[currentQuestionIndex] = currentAnswer;
      }
      
      jumpToQuestion(index);
    });
  });
}

// ===== LIGHTBULB TIPS FUNCTIONALITY =====
function showLightbulbTips() {
  const currentQuestion = questions[currentQuestionIndex];
  let tips = [];
  
  // Generate tips based on current question
  switch(currentQuestionIndex) {
    case 0: // Describe your application
      tips = [
        "💡 Be specific about your app's main purpose and core features",
        "💡 Mention the platform (web, mobile, desktop) you're targeting",
        "💡 Include key functionalities that make your app unique",
        "💡 Describe the problem your app solves for users"
      ];
      break;
    case 1: // Describe the workflow
      tips = [
        "💡 Walk through a typical user journey step by step",
        "💡 Explain how users interact with different features",
        "💡 Describe the main user actions and workflows",
        "💡 Include any important user flows or processes"
      ];
      break;
    case 2: // Target audience and goals
      tips = [
        "💡 Define your primary user demographics (age, profession, etc.)",
        "💡 Explain what goals users want to achieve with your app",
        "💡 Describe your target market and user needs",
        "💡 Mention any specific user personas or segments"
      ];
      break;
    case 3: // Additional details
      tips = [
        "💡 Add any technical requirements or constraints",
        "💡 Mention integrations with other services or platforms",
        "💡 Include future features or expansion plans",
        "💡 Add any special considerations or unique aspects"
      ];
      break;
    default:
      tips = ["💡 Provide detailed and specific information for better results"];
  }
  
  // Show tips in a simple alert for now (can be enhanced with a modal later)
  const tipsText = `Tips for "${currentQuestion}":\n\n${tips.join('\n')}`;
  alert(tipsText);
}

// ===== SPEECH RECOGNITION FUNCTIONALITY =====
function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
      isRecording = true;
      updateMicrophoneButton();
      console.log('Speech recognition started');
    };
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const textarea = document.getElementById('mainInput');
      if (textarea) {
        textarea.value = transcript;
        // Trigger auto-resize
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      isRecording = false;
      updateMicrophoneButton();
    };
    
    recognition.onend = function() {
      isRecording = false;
      updateMicrophoneButton();
      console.log('Speech recognition ended');
    };
  } else {
    console.log('Speech recognition not supported');
  }
}

function toggleRecording() {
  if (!recognition) {
    initSpeechRecognition();
  }
  
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

function updateMicrophoneButton() {
  const micBtn = document.getElementById('microphoneBtn');
  if (micBtn) {
    if (isRecording) {
      micBtn.classList.add('recording');
    } else {
      micBtn.classList.remove('recording');
    }
  }
}

// ===== DEMO FUNCTIONALITY =====
// (Demo function and all data permanently removed)

// ===== API INTEGRATION =====
async function generateSpecification() {
  try {
    // Clear any previous spec data to force creating a NEW spec
    localStorage.removeItem('currentSpecId');
    localStorage.removeItem('generatedOverviewContent');
    localStorage.removeItem('initialAnswers');
    console.log('🧹 Cleared previous spec data from localStorage');
    
    console.log('🚀 Starting generateSpecification...');
    
    // Check if answers exist and are valid
    if (!answers || answers.length !== 4) {
      console.error('Invalid answers:', answers);
      hideLoadingOverlay();
      alert('Error: Invalid answers provided. Please provide answers to all 4 questions.');
      return;
    }
    
    console.log('✅ Answers validated:', {
      length: answers.length,
      answers: answers.map((a, i) => `Answer ${i + 1}: ${a.substring(0, 50)}...`)
    });
    
    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      hideLoadingOverlay();
      showRegistrationModal();
      return;
    }
    
    // Show loading overlay
    showLoadingOverlay();
    
    // Check credits BEFORE generating spec
    console.log('💳 [generateSpecification] Checking credits status with API_BASE_URL:', window.API_BASE_URL);
    try {
      const token = await user.getIdToken();
      console.log('💳 [generateSpecification] Got auth token, calling /api/specs/status');
      const statusResponse = await fetch(`${window.API_BASE_URL || 'http://localhost:10000'}/api/specs/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('💳 [generateSpecification] Credits status:', statusData);
        console.log('💳 [generateSpecification] Can create:', statusData.canCreate);
        
        if (!statusData.canCreate) {
          hideLoadingOverlay();
          console.warn('❌ [generateSpecification] No credits available:', statusData.reason);
          console.warn('❌ [generateSpecification] Showing paywall to user');
          
          // Show paywall
          const paywallData = {
            message: 'You need to purchase credits to create more specifications',
            options: [
              {
                id: 'single_spec',
                name: 'Single Spec',
                price: 4.90,
                currency: 'USD',
                description: '1 additional specification'
              },
              {
                id: 'three_pack',
                name: '3-Pack',
                price: 9.90,
                currency: 'USD',
                description: '3 additional specifications'
              }
            ]
          };
          
          showPaywall(paywallData);
          return;
        } else {
          console.log('✅ [generateSpecification] User has credits, proceeding with spec generation');
        }
      } else {
        console.error('❌ [generateSpecification] Failed to check credits status:', statusResponse.status);
      }
    } catch (error) {
      console.error('❌ [generateSpecification] Error checking credits:', error);
      // Continue anyway - let the server decide
    }
    
    // Prepare the prompt for overview generation
    const prompt = PROMPTS.overview(answers);
    
    console.log('✅ Generated prompt:', prompt.substring(0, 200) + '...');
    
    // Add platform information to the prompt
    const platformInfo = [];
    if (selectedPlatforms.mobile) platformInfo.push("Mobile App");
    if (selectedPlatforms.web) platformInfo.push("Web App");
    
    const platformText = platformInfo.length > 0 
      ? `Target Platform: ${platformInfo.join(', ')}` 
      : 'Target Platform: Not specified';
    
    const enhancedPrompt = `${prompt}\n\n${platformText}`;
    
    console.log('✅ Enhanced prompt length:', enhancedPrompt.length);
    
    // Get Firebase auth token
    const token = await user.getIdToken();
    
    // NOTE: Users can provide answers in any language, but the API will always return the specification in English
    // Call the new API endpoint with authorization
    console.log('🔵 [generateSpecification] Calling /api/specs/create with API_BASE_URL:', window.API_BASE_URL);
    const response = await fetch(`${window.API_BASE_URL || 'http://localhost:10000'}/api/specs/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userInput: enhancedPrompt
      })
    });

    console.log('✅ API Response status:', response.status);
    console.log('🔵 [generateSpecification] Create API call completed with status:', response.status);

    if (response.status === 402) {
      // Payment required - show paywall
      console.warn('❌ [generateSpecification] Server returned 402 - Payment required');
      const paywallData = await response.json();
      console.log('🚧 [generateSpecification] Received paywall data from server');
      hideLoadingOverlay();
      showPaywall(paywallData.paywall);
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.error || 'Failed to generate specification');
    }

    const data = await response.json();
    console.log('✅ Successfully received specification:', data);
    
    // Extract overview content from the response
    const overviewContent = data.specification || 'No overview generated';
    
    // Save to Firebase and redirect
    const firebaseId = await saveSpecToFirebase(overviewContent, answers);
    console.log('✅ Saved to Firebase successfully with ID:', firebaseId);
    
    // Trigger OpenAI upload (non-blocking)
    if (window.ENABLE_OPENAI_STORAGE !== false) {
      triggerOpenAIUpload(firebaseId).catch(err => {
        console.warn('Background OpenAI upload failed:', err);
      });
    }
    
    // Store in localStorage for backup
    localStorage.setItem('generatedOverviewContent', overviewContent);
    localStorage.setItem('initialAnswers', JSON.stringify(answers));
    console.log('✅ Stored in localStorage successfully');
    
    // Redirect to spec viewer with Firebase ID
    setTimeout(() => {
      window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
    }, 1000);
    
  } catch (error) {
    console.error('Error generating specification:', error);
    
    // Hide loading overlay
    hideLoadingOverlay();
    
    // Show error message
    alert('Error generating specification. Please try again.');
  }
}

// ===== LOADING OVERLAY FUNCTIONS =====
function showLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ===== FIREBASE INTEGRATION =====
async function saveSpecToFirebase(overviewContent, answers) {
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
      // Use default title if parsing fails
    }
    
    // Parse the overview content to extract the overview data
    let overviewData = {};
    try {
      overviewData = JSON.parse(overviewContent);
      console.log('✅ Overview data parsed successfully:', overviewData);
    } catch (e) {
      console.error('Failed to parse overview content:', e);
      overviewData = { ideaSummary: overviewContent };
      console.log('⚠️ Using fallback overview data:', overviewData);
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
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown User',
      mode: 'unified',
      answers: answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const overviewPreview = specDoc.overview.substring(0, 200) + (specDoc.overview.length > 200 ? '...' : '');
    console.log('🔍 [CREATING NEW SPEC] Saving spec document to Firebase');
    console.log('   → Timestamp:', new Date().toISOString());
    console.log('   → User ID:', specDoc.userId);
    console.log('   → User Name:', specDoc.userName);
    console.log('   → Title:', specDoc.title);
    console.log('   → OverviewApproved:', specDoc.overviewApproved);
    console.log('   → Technical:', specDoc.technical);
    console.log('   → Market:', specDoc.market);
    console.log('   → Overview length:', specDoc.overview ? specDoc.overview.length : 0, 'chars');
    if (specDoc.overview) console.log('   → Overview preview:', overviewPreview);
    console.log('   → Status:', specDoc.status);
    console.log('   → Call Stack:', new Error().stack.split('\n').slice(1, 4).join('\n   → '));
    
    console.log('📝 Saving spec document to Firebase:', {
      title: specDoc.title,
      hasOverview: !!specDoc.overview,
      overviewType: typeof specDoc.overview,
      overviewLength: specDoc.overview ? specDoc.overview.length : 0,
      answersCount: specDoc.answers.length,
      mode: specDoc.mode,
      status: specDoc.status
    });
    
    console.log('📝 [SPEC CREATION] Starting spec save process');
    console.log('   → localStorage cleared: true');
    console.log('   → Current userId:', user.uid);
    
    // Check if we're in EDIT mode (explicit edit, not normal creation)
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('edit') === 'true';
    const existingSpecId = urlParams.get('id');
    
    let docRef;
    
    if (isEditMode && existingSpecId) {
      // UPDATE existing spec (only in explicit edit mode)
      try {
        console.log('📝 [EDIT MODE] Updating existing spec:', existingSpecId);
        docRef = firebase.firestore().collection('specs').doc(existingSpecId);
        const { createdAt, userId, ...updateData } = specDoc;
        await docRef.update({
          ...updateData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Spec updated in Firebase with ID:', existingSpecId);
        return existingSpecId;
      } catch (updateError) {
        console.error('❌ Update failed, creating new document:', updateError);
        // Fall through to create new document
      }
    }
    
    // CREATE new document (normal creation flow or fallback from failed update)
    docRef = await firebase.firestore().collection('specs').add(specDoc);
    console.log('✅ [CREATED] NEW spec in Firebase');
    console.log('   → ID:', docRef.id);
    console.log('   → OverviewApproved:', specDoc.overviewApproved);
    console.log('   → Technical:', specDoc.technical, '(will be generated after approval)');
    console.log('   → Market:', specDoc.market, '(will be generated after approval)');
    console.log('   → Design:', specDoc.design, '(will be generated after approval)');
    console.log('Spec saved to Firebase with ID:', docRef.id);
    // Don't store in localStorage - we always want to create new specs
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    throw error;
  }
}

// ===== OPENAI UPLOAD TRIGGER =====
async function triggerOpenAIUpload(specId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.warn('No user found, skipping OpenAI upload');
      return;
    }
    
    const token = await user.getIdToken();
    const response = await fetch(`${window.API_BASE_URL || 'http://localhost:10000'}/api/specs/${specId}/upload-to-openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const data = await response.json();
    console.log('✅ OpenAI upload triggered successfully:', data);
  } catch (error) {
    console.warn('⚠️ OpenAI upload trigger failed (this is non-critical):', error);
  }
}

// ===== PAYWALL FUNCTIONS =====
function showPaywall(paywallData) {
  console.log('🚧 [PAYWALL] showPaywall called:', paywallData);
  
  if (window.paywallManager) {
    console.log('✅ [PAYWALL] Paywall manager loaded, showing paywall');
    window.paywallManager.showPaywall(paywallData, (entitlements) => {
      // Success callback - retry specification generation
      console.log('✅ [PAYWALL] Purchase successful callback triggered');
      console.log('✅ [PAYWALL] Entitlements received:', entitlements);
      console.log('🔄 [PAYWALL] Retrying specification generation...');
      generateSpecification();
    });
  } else {
    // Fallback if paywall manager not loaded
    console.error('❌ [PAYWALL] Paywall manager not loaded!');
    alert('Payment required to create more specifications. Please refresh the page and try again.');
  }
}

// ===== AUTO-START DETECTION =====
function checkAutoStart() {
  const urlParams = new URLSearchParams(window.location.search);
  const autoStart = urlParams.get('autoStart');
  
  if (autoStart === 'true') {
    // Remove the query parameter from URL for cleaner navigation
    window.history.replaceState({}, '', window.location.pathname);
    
    // Check if user is authenticated before auto-starting
    if (isUserAuthenticated()) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        proceedWithAppPlanning();
      }, 500);
    } else {
      // Redirect to auth if not authenticated
      window.location.href = '/pages/auth.html?redirect=profile';
    }
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
  // Clear any stale spec data when user arrives at fresh form
  localStorage.removeItem('currentSpecId');
  localStorage.removeItem('generatedOverviewContent');
  console.log('🧹 Cleared stale spec data on page load');
  
  checkFirstVisit();
  setupModernInput();
  checkAutoStart();
  
  const startButton = document.getElementById('startButton');
  if (startButton) {
    startButton.addEventListener('click', handleStartButtonClick);
  }
  
  const navicon = document.querySelector('.navicon');
  if (navicon) {
    navicon.addEventListener('click', toggleMenu);
  }
  
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item, index) => {
    item.addEventListener('click', () => toggleFAQ(index));
  });

  // Testimonials animation on-viewport only
  const testimonialsGallery = document.querySelector('.testimonials-gallery');
  if (testimonialsGallery) {
    const testimonialsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          testimonialsGallery.classList.add('animate');
        } else {
          testimonialsGallery.classList.remove('animate');
        }
      });
    }, { threshold: 0.1 });
    testimonialsObserver.observe(testimonialsGallery);
  }
  
  // Load dynamic stats from Firebase
  // Wait a bit for Firebase to initialize
  setTimeout(() => {
    loadDynamicStats().then(() => {
      // Intersection Observer for animations
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const counter = entry.target.querySelector('.stat-number');
            if (counter) {
              const target = parseInt(counter.dataset.target);
              animateCounter(counter, target);
              observer.unobserve(entry.target);
            }
          }
        });
      });
      
      const statsItems = document.querySelectorAll('.stat-item');
      statsItems.forEach(item => observer.observe(item));
    });
  }, 500); // Wait 500ms for Firebase to load
  
  const toolsSection = document.querySelector('.tools-showcase');
  if (toolsSection) {
    const toolsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateToolsShowcase();
          toolsObserver.unobserve(entry.target);
        }
      });
    });
    toolsObserver.observe(toolsSection);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeWelcomeModal();
      closeRegistrationModal();
    }
  });
});

function triggerPlatformHint() {
  const phoneBtn = document.getElementById('phoneBtn');
  const computerBtn = document.getElementById('computerBtn');
  [phoneBtn, computerBtn].forEach(btn => {
    if(btn) {
      btn.classList.add('jump-anim', 'orange-glow');
      setTimeout(()=>{
        btn.classList.remove('jump-anim','orange-glow');
      }, 800);
    }
  });
}

// ===== MAINTENANCE MODE CHECK =====
const MAINTENANCE_CODE = '1997';
const MAINTENANCE_STORAGE_KEY = 'specifys_maintenance_access';

function checkMaintenanceAccess() {
  // Check if user has already entered the correct code
  const hasAccess = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
  
  if (hasAccess === 'true') {
    // User has access, hide overlay
    const overlay = document.getElementById('maintenanceOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    return;
  }
  
  // Show overlay and set up code checking
  setupMaintenanceCodeCheck();
}

function setupMaintenanceCodeCheck() {
  const overlay = document.getElementById('maintenanceOverlay');
  const codeInput = document.getElementById('maintenanceCodeInput');
  const submitBtn = document.getElementById('maintenanceCodeSubmit');
  const errorMsg = document.getElementById('maintenanceError');
  
  if (!overlay || !codeInput || !submitBtn) return;
  
  // Focus on input
  codeInput.focus();
  
  // Handle Enter key
  codeInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      checkMaintenanceCode();
    }
  });
  
  // Handle submit button click
  submitBtn.addEventListener('click', checkMaintenanceCode);
  
  function checkMaintenanceCode() {
    const enteredCode = codeInput.value.trim();
    
    if (enteredCode === MAINTENANCE_CODE) {
      // Correct code - grant access
      localStorage.setItem(MAINTENANCE_STORAGE_KEY, 'true');
      overlay.classList.add('hidden');
      errorMsg.style.display = 'none';
      codeInput.value = '';
    } else {
      // Wrong code - show error
      errorMsg.style.display = 'block';
      codeInput.value = '';
      codeInput.focus();
      
      // Shake animation
      const content = overlay.querySelector('.maintenance-content');
      if (content) {
        content.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          content.style.animation = '';
        }, 500);
      }
    }
  }
}

// Initialize maintenance check on page load
document.addEventListener('DOMContentLoaded', function() {
  checkMaintenanceAccess();
});