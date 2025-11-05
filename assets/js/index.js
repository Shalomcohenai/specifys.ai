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

function showMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Make functions globally available
window.showMaintenanceModal = showMaintenanceModal;
window.closeMaintenanceModal = closeMaintenanceModal;

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
    
  } catch (error) {
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
      isRecording = false;
      updateMicrophoneButton();
    };
    
    recognition.onend = function() {
      isRecording = false;
      updateMicrophoneButton();
    };
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
  // Initialize logging variables at the start of the function
  const requestId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestStartTime = Date.now();
  
  try {
    console.log(`[${requestId}] ===== CLIENT: generateSpecification START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    
    // Clear any previous spec data to force creating a NEW spec
    localStorage.removeItem('currentSpecId');
    localStorage.removeItem('generatedOverviewContent');
    localStorage.removeItem('initialAnswers');
    
    // Check if answers exist and are valid
    if (!answers || answers.length !== 4) {
      hideLoadingOverlay();
      console.error(`[${requestId}] ❌ Validation failed: Invalid answers`);
      alert('Error: Invalid answers provided. Please provide answers to all 4 questions.');
      return;
    }
    
    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      hideLoadingOverlay();
      console.error(`[${requestId}] ❌ Authentication failed: No user`);
      showRegistrationModal();
      return;
    }
    
    // Check credits before generating spec
    if (typeof checkEntitlement !== 'undefined') {
      const entitlementCheck = await checkEntitlement();
      if (!entitlementCheck.hasAccess) {
        hideLoadingOverlay();
        console.error(`[${requestId}] ❌ Access denied: No credits/entitlement`);
        if (typeof showPaywall !== 'undefined') {
          showPaywall(entitlementCheck.paywallData);
        } else {
          alert('You do not have enough credits to create a spec. Please purchase credits or upgrade to Pro.');
        }
        return;
      }
    }
    
    // Show loading overlay
    showLoadingOverlay();
    
    // Prepare the prompt for overview generation
    const prompt = PROMPTS.overview(answers);
    
    // Add platform information to the prompt
    const platformInfo = [];
    if (selectedPlatforms.mobile) platformInfo.push("Mobile App");
    if (selectedPlatforms.web) platformInfo.push("Web App");
    
    const platformText = platformInfo.length > 0 
      ? `Target Platform: ${platformInfo.join(', ')}` 
      : 'Target Platform: Not specified';
    
    const enhancedPrompt = `${prompt}\n\n${platformText}`;
    
    // Generate specification using the legacy API endpoint
    const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
    console.log(`[${requestId}] Request Payload:`, {
      userInputLength: enhancedPrompt.length,
      userInputPreview: enhancedPrompt.substring(0, 200),
      platformInfo: platformInfo
    });
    
    const response = await fetch(`${apiBaseUrl}/api/generate-spec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userInput: enhancedPrompt
      })
    });
    
    const requestTime = Date.now() - requestStartTime;
    console.log(`[${requestId}] 📥 Response received (${requestTime}ms):`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      console.error(`[${requestId}] ❌ Response not OK: ${response.status} ${response.statusText}`);
      let errorMessage = 'Failed to generate specification';
      let errorDetails = null;
      let serverRequestId = null;
      
      try {
        const errorData = await response.json();
        errorDetails = errorData;
        serverRequestId = errorData.requestId;
        // Build comprehensive error message
        errorMessage = errorData.details || errorData.error || errorMessage;
        if (errorData.errorType) {
          errorMessage += ` (${errorData.errorType})`;
        }
        if (serverRequestId) {
          errorMessage += ` [Server Request ID: ${serverRequestId}]`;
        }
        
        console.error(`[${requestId}] API Error Response (JSON):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          errorString: JSON.stringify(errorData, null, 2),
          serverRequestId: serverRequestId
        });
        console.error(`[${requestId}] Full error details:`, errorData);
        console.error(`[${requestId}] Server Request ID: ${serverRequestId || 'N/A'} - Check server logs with this ID`);
      } catch (parseError) {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          errorDetails = { text: errorText };
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          console.error(`[${requestId}] API Error (non-JSON):`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
            parseError: parseError.message
          });
        } catch (textError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          errorDetails = { parseError: textError.message };
          console.error(`[${requestId}] API Error (could not parse):`, {
            status: response.status,
            statusText: response.statusText,
            textError: textError.message
          });
        }
      }
      
      const totalTime = Date.now() - requestStartTime;
      console.error(`[${requestId}] ===== CLIENT: generateSpecification FAILED (${totalTime}ms) =====`);
      if (serverRequestId) {
        console.error(`[${requestId}] ⚠️  Check server logs for request ID: ${serverRequestId}`);
      }
      throw new Error(errorMessage);
    }

    const parseStart = Date.now();
    const data = await response.json();
    const parseTime = Date.now() - parseStart;
    
    console.log(`[${requestId}] ✅ Successfully parsed response (${parseTime}ms)`);
    console.log(`[${requestId}] Response Data Structure:`, {
      hasSpecification: !!data.specification,
      specificationType: typeof data.specification,
      specificationLength: data.specification?.length || 0,
      keys: Object.keys(data)
    });
    
    // Extract overview content from the response
    const overviewContent = data.specification || 'No overview generated';
    console.log(`[${requestId}] Overview Content:`, {
      length: overviewContent.length,
      preview: overviewContent.substring(0, 200)
    });
    
    // Save to Firebase and redirect
    console.log(`[${requestId}] 💾 Saving to Firebase...`);
    const firebaseSaveStart = Date.now();
    const firebaseId = await saveSpecToFirebase(overviewContent, answers);
    const firebaseSaveTime = Date.now() - firebaseSaveStart;
    console.log(`[${requestId}] ✅ Saved to Firebase (${firebaseSaveTime}ms): ${firebaseId}`);
    
    // Consume credit after successful spec creation
    try {
      console.log(`[${requestId}] 💳 Consuming credit...`);
      const token = await user.getIdToken();
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
      const consumeResponse = await fetch(`${apiBaseUrl}/api/specs/consume-credit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ specId: firebaseId })
      });

      if (!consumeResponse.ok) {
        const errorData = await consumeResponse.json();
        console.error(`[${requestId}] ❌ Failed to consume credit:`, errorData);
        // Don't fail the spec creation, but log the error
      } else {
        console.log(`[${requestId}] ✅ Credit consumed successfully`);
        // Refresh credits display and clear cache
        if (typeof window.clearEntitlementsCache !== 'undefined') {
          window.clearEntitlementsCache();
        }
        if (typeof window.updateCreditsDisplay !== 'undefined') {
          window.updateCreditsDisplay();
        }
      }
    } catch (creditError) {
      console.error(`[${requestId}] ❌ Error consuming credit:`, creditError);
      // Don't fail spec creation
    }
    
    // Trigger OpenAI upload (non-blocking)
    if (window.ENABLE_OPENAI_STORAGE !== false) {
      console.log(`[${requestId}] 📤 Triggering OpenAI upload (background)...`);
      triggerOpenAIUpload(firebaseId).catch(err => {
        console.error(`[${requestId}] ❌ Background OpenAI upload failed:`, err);
      });
    }
    
    // Store in localStorage for backup
    localStorage.setItem('generatedOverviewContent', overviewContent);
    localStorage.setItem('initialAnswers', JSON.stringify(answers));
    console.log(`[${requestId}] 💾 Stored in localStorage for backup`);
    
    const totalTime = Date.now() - requestStartTime;
    console.log(`[${requestId}] ✅ Successfully completed specification generation (${totalTime}ms total)`);
    console.log(`[${requestId}] 🔄 Redirecting to spec viewer...`);
    console.log(`[${requestId}] ===== CLIENT: generateSpecification SUCCESS =====`);
    
    // Redirect to spec viewer with Firebase ID
    setTimeout(() => {
      window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
    }, 1000);
    
  } catch (error) {
    // Hide loading overlay
    hideLoadingOverlay();
    
    // Use requestStartTime if available, otherwise calculate from start
    const totalTime = requestStartTime ? Date.now() - requestStartTime : 0;
    
    // Show detailed error message
    console.error(`[${requestId}] ❌ Full error in generateSpecification (${totalTime}ms):`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error(`[${requestId}] ===== CLIENT: generateSpecification ERROR =====`);
    
    const errorMessage = error.message || 'Error generating specification. Please try again.';
    
    // Show user-friendly error message
    alert(`Error: ${errorMessage}\n\nPlease check the console for more details.`);
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
    } catch (e) {
      overviewData = { ideaSummary: overviewContent };
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
    
    // Check if we're in EDIT mode (explicit edit, not normal creation)
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('edit') === 'true';
    const existingSpecId = urlParams.get('id');
    
    let docRef;
    
    if (isEditMode && existingSpecId) {
      // UPDATE existing spec (only in explicit edit mode)
      try {
        docRef = firebase.firestore().collection('specs').doc(existingSpecId);
        const { createdAt, userId, ...updateData } = specDoc;
        await docRef.update({
          ...updateData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return existingSpecId;
      } catch (updateError) {
        // Fall through to create new document
      }
    }
    
    // CREATE new document (normal creation flow or fallback from failed update)
    docRef = await firebase.firestore().collection('specs').add(specDoc);
    // Don't store in localStorage - we always want to create new specs
    
    return docRef.id;
  } catch (error) {
    throw error;
  }
}

// ===== OPENAI UPLOAD TRIGGER =====
async function triggerOpenAIUpload(specId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      return;
    }
    
    const token = await user.getIdToken();
    const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
    const response = await fetch(`${apiBaseUrl}/api/specs/${specId}/upload-to-openai`, {
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
  } catch (error) {
    // OpenAI upload trigger failed (non-critical)
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
  
  // Show maintenance modal immediately
  setTimeout(() => {
    showMaintenanceModal();
  }, 500);
  
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
      closeMaintenanceModal();
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
