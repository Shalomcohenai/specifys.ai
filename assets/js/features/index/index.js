// Index Page JavaScript - Specifys.ai
// Optimized and cleaned up version

// ===== MODAL FUNCTIONS =====
// Initialize modals using Modal component
let welcomeModalInstance = null;
let registrationModalInstance = null;

function initModals() {
  // Wait for Modal class to be available
  if (typeof window.Modal !== 'undefined') {
    const welcomeModalEl = document.getElementById('welcomeModal');
    const registrationModalEl = document.getElementById('registrationModal');
    
    if (welcomeModalEl && !welcomeModalInstance) {
      welcomeModalInstance = new window.Modal(welcomeModalEl);
    }
    
    if (registrationModalEl && !registrationModalInstance) {
      registrationModalInstance = new window.Modal(registrationModalEl);
    }
  } else {
    // Retry after a short delay if Modal not loaded yet
    setTimeout(initModals, 100);
  }
}

function showWelcomeModal() {
  if (welcomeModalInstance) {
    welcomeModalInstance.open();
  } else {
    // Fallback to old method if Modal not initialized
    const modal = document.getElementById('welcomeModal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }
}

function closeWelcomeModal() {
  if (welcomeModalInstance) {
    welcomeModalInstance.close();
  } else {
    // Fallback to old method if Modal not initialized
    const modal = document.getElementById('welcomeModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }
}

function showRegistrationModal() {
  if (registrationModalInstance) {
    registrationModalInstance.open();
  } else {
    // Fallback to old method if Modal not initialized
    const modal = document.getElementById('registrationModal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }
}

function closeRegistrationModal() {
  if (registrationModalInstance) {
    registrationModalInstance.close();
  } else {
    // Fallback to old method if Modal not initialized
    const modal = document.getElementById('registrationModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }
}

// ===== CREDIT POPUP FOR NEW USERS =====
function showCreditPopup() {
  // Check if popup already exists
  let popup = document.getElementById('creditPopup');
  if (popup) {
    popup.remove();
  }

  // Create popup element
  popup = document.createElement('div');
  popup.id = 'creditPopup';
  popup.className = 'credit-popup';
  
  popup.innerHTML = `
    <div class="credit-popup-content">
      <button class="credit-popup-close" id="creditPopupClose" aria-label="Close">×</button>
      <div class="credit-popup-icon">🎉</div>
      <h3 class="credit-popup-title">Congratulations!</h3>
      <p class="credit-popup-message">You received one credit to use - use it wisely!</p>
      <div class="credit-popup-timer">
        <span id="creditPopupTimer">5</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Show popup with animation
  setTimeout(() => {
    popup.classList.add('show');
  }, 100);
  
  // Timer countdown
  let timeLeft = 5;
  const timerElement = document.getElementById('creditPopupTimer');
  const timerInterval = setInterval(() => {
    timeLeft--;
    if (timerElement) {
      timerElement.textContent = timeLeft;
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      closeCreditPopup();
    }
  }, 1000);
  
  // Close button handler
  const closeBtn = document.getElementById('creditPopupClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      closeCreditPopup();
    });
  }
  
  // Close on escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      clearInterval(timerInterval);
      closeCreditPopup();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeCreditPopup() {
  const popup = document.getElementById('creditPopup');
  if (popup) {
    popup.classList.remove('show');
    setTimeout(() => {
      popup.remove();
    }, 300);
  }
}

function checkForCreditPopup() {
  // Check if we should show the credit popup
  const showPopup = sessionStorage.getItem('showCreditPopup');
  
  if (showPopup === 'true') {
    // Remove the flag
    sessionStorage.removeItem('showCreditPopup');
    // Show popup after a short delay to ensure page is loaded
    setTimeout(() => {
      showCreditPopup();
    }, 500);
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
  
  // Show planning interface
  showPlanningInterface();
}

// ===== PLANNING INTERFACE =====
function showPlanningInterface() {
  const heroContent = document.getElementById('heroContent');
  const planningContainer = document.getElementById('planningContainer');
  
  if (heroContent) {
    heroContent.classList.add('fade-out');
  }
  
  setTimeout(() => {
    if (heroContent) {
      heroContent.style.display = 'none';
    }
    if (planningContainer) {
      planningContainer.classList.remove('hidden');
      planningContainer.style.display = 'block';
      
      // Initialize planning interface components
      if (typeof renderDesign === 'function') {
        renderDesign();
      }
      if (typeof renderIntegrations === 'function') {
        renderIntegrations();
      }
      if (typeof renderFeatures === 'function') {
        renderFeatures();
      }
      if (typeof renderAudience === 'function') {
        renderAudience();
      }
      if (typeof renderPredefinedPages === 'function') {
        renderPredefinedPages();
      }
    }
  }, 500);
}

// ===== GENERATE SPEC FROM PLANNING =====
window.generateSpecFromPlanning = function() {
  // Get planning text
  const planningText = window.generatePlanningText ? window.generatePlanningText() : '';
  
  // Store planning data for generateSpecification
  if (window.generateJSON) {
    const planningData = window.generateJSON();
    window.planningData = planningData.object;
    window.planningText = planningText;
  }
  
  // Call generateSpecification
  if (typeof generateSpecification === 'function') {
    generateSpecification();
  } else {
    alert('Error: Could not generate specification.');
  }
}

// ===== APP PLANNING FLOW =====
function proceedWithAppPlanning() {
  // Use new Question Flow Controller
  if (window.questionFlowController) {
    window.questionFlowController.start('typing');
  } else {
    // Fallback to old implementation
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
  "Additional details"
];

const questionDetails = [
  "Describe the main idea of your application - including core features, target audience, and the problem it solves",
  "Walk through a typical user journey step by step - explain how users interact with different features and workflows",
  "Add any technical requirements, integrations with other services, future features, or special considerations"
];

// Character limits for each question
const characterLimits = [
  900, // Question 1: Describe your application
  800, // Question 2: Describe the workflow
  600  // Question 3: Additional details
];

function showModernInput(prefilledAnswers = null) {
  // Use new Question Flow Controller
  if (window.questionFlowController) {
    window.questionFlowController.switchToTyping(prefilledAnswers);
  } else {
    // Fallback to old implementation
    const liveBriefContainer = document.getElementById('liveBriefContainer');
    if (liveBriefContainer) {
      liveBriefContainer.style.display = 'none';
      liveBriefContainer.style.visibility = 'hidden';
      liveBriefContainer.style.opacity = '0';
      liveBriefContainer.style.transition = 'none';
      liveBriefContainer.classList.remove('fade-in');
    }
    
    const inputContainer = document.getElementById('modernInputContainer');
    const questionsDisplay = document.getElementById('questionsDisplay');
    const heroContent = document.getElementById('heroContent');
    const specCardsShowcase = document.getElementById('specCardsShowcase');
    
    if (inputContainer) {
      inputContainer.style.display = 'block';
      inputContainer.style.visibility = 'visible';
      inputContainer.style.opacity = '1';
      inputContainer.style.transition = 'none';
    }
    
    if (questionsDisplay) {
      questionsDisplay.style.display = 'block';
      questionsDisplay.style.visibility = 'visible';
      questionsDisplay.style.opacity = '1';
      questionsDisplay.style.transition = 'none';
      questionsDisplay.style.pointerEvents = 'auto';
      if (typeof showCurrentQuestion === 'function') {
        showCurrentQuestion();
      }
      
      // Scroll to top on mobile when questions are shown
      // Check if mobile device (screen width <= 768px or touch device)
      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      if (isMobile) {
        // Use setTimeout to ensure DOM is updated before scrolling
        setTimeout(() => {
          questionsDisplay.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }, 100);
      }
    }
    
    if (specCardsShowcase) {
      specCardsShowcase.style.display = 'none';
    }
    
    if (heroContent) {
      heroContent.classList.add('fade-out');
    }
    
    if (prefilledAnswers && Array.isArray(prefilledAnswers)) {
      currentQuestionIndex = 0;
      answers = [];
      for (let i = 0; i < Math.min(prefilledAnswers.length, 3); i++) {
        if (prefilledAnswers[i]) {
          answers[i] = prefilledAnswers[i];
        }
      }
      if (answers[0]) {
        const textarea = document.getElementById('mainInput');
        if (textarea) {
          textarea.value = answers[0];
          if (typeof updateCharacterLimit === 'function') {
            updateCharacterLimit();
          }
          if (typeof updateButtonState === 'function') {
            updateButtonState();
          }
          if (typeof autoResize === 'function') {
            autoResize();
          }
        }
      }
    }
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
  
  // Update character limit for current question
  updateCharacterLimit();
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
    // Mark first 2 questions as error if not answered (excluding last question)
    if (index < 2 && (!answers[index] || answers[index].trim() === '')) {
      dot.classList.add('error');
    }
  });
}

function updateLightbulbTooltip() {
// Removed duplicated tooltip init block (handled by updateLightbulbTooltip)
}

// ===== CHARACTER LIMIT MANAGEMENT =====
function updateCharacterLimit() {
  const textarea = document.getElementById('mainInput');
  const characterCountElement = document.getElementById('characterCount');
  
  if (!textarea || !characterCountElement || currentQuestionIndex >= characterLimits.length) {
    return;
  }
  
  const maxLength = characterLimits[currentQuestionIndex];
  textarea.maxLength = maxLength;
  
  // Update character count display
  const currentLength = textarea.value.length;
  characterCountElement.textContent = `${currentLength} / ${maxLength}`;
  
  // Update styling based on character count
  const percentage = (currentLength / maxLength) * 100;
  if (percentage >= 100) {
    characterCountElement.classList.add('danger');
    characterCountElement.classList.remove('warning');
  } else if (percentage >= 90) {
    characterCountElement.classList.add('warning');
    characterCountElement.classList.remove('danger');
  } else {
    characterCountElement.classList.remove('warning', 'danger');
  }
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
      // Update character limit for new question
      updateCharacterLimit();
    }
    
    // Update button state after restoring answer
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      // All questions are optional - no minimum length required
      // Always keep button enabled and active
      sendBtn.disabled = false;
      
      sendBtn.style.background = '#FF6B35';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.opacity = '1';
      
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
        updateCharacterLimit();
      }, 600);
    }
  }
}
  const tooltipContent = document.querySelector('.tooltip-content');
  if (tooltipContent) {
    const tooltips = [
      "💡 Be specific about your app's main purpose and core features\n💡 Mention the platform (web, mobile, desktop) you're targeting\n💡 Include key functionalities that make your app unique\n💡 Describe the problem your app solves for users",
      "💡 Walk through a typical user journey step by step\n💡 Explain how users interact with different features\n💡 Describe the main user actions and workflows\n💡 Include any important user flows or processes", 
      "💡 Add any technical requirements or constraints\n💡 Mention integrations with other services or platforms\n💡 Include future features or expansion plans\n💡 Add any special considerations or unique aspects"
    ];
    
    const currentTooltip = tooltips[currentQuestionIndex] || "💡 Provide detailed and specific information for better results";
    tooltipContent.textContent = currentTooltip;
  }

function nextQuestion() {
  const textarea = document.getElementById('mainInput');
  const answer = textarea.value.trim();
  
  // All questions are optional - allow empty answers
  // Save the answer (can be empty for any question)
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
          // All questions are optional - no minimum length required
          // Always show button as active
          sendBtn.style.background = '#FF6B35';
          sendBtn.style.cursor = 'pointer';
          sendBtn.style.opacity = '1';
          
          // Update character limit for new question
          updateCharacterLimit();
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
      // Update character limit for new question
      updateCharacterLimit();
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
        // Update character limit
        updateCharacterLimit();
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
    // All questions are optional - no minimum length required
    // Always keep button enabled and active
    sendBtn.disabled = false;
    
    // Always show as active (orange) button
    sendBtn.style.background = '#FF6B35';
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.opacity = '1';
    
    // Update character count
    updateCharacterLimit();
  }
  
  textarea.addEventListener('input', function() {
    // Trim text if it exceeds the limit (handles paste events)
    const maxLength = characterLimits[currentQuestionIndex] || 900;
    if (textarea.value.length > maxLength) {
      textarea.value = textarea.value.substring(0, maxLength);
    }
    autoResize();
    updateButtonState();
  });
  
  textarea.addEventListener('keyup', updateButtonState);
  
  // Handle paste events to prevent exceeding limit
  textarea.addEventListener('paste', function(e) {
    const maxLength = characterLimits[currentQuestionIndex] || 900;
    setTimeout(() => {
      if (textarea.value.length > maxLength) {
        textarea.value = textarea.value.substring(0, maxLength);
        updateButtonState();
      }
    }, 0);
  });
  
  // Initialize button state and character limit
  updateButtonState();
  updateCharacterLimit();
  
  sendBtn.addEventListener('click', function() {
    // Platform validation check - only for question 1 (index 0)
    if (currentQuestionIndex === 0 && !selectedPlatforms.mobile && !selectedPlatforms.web) {
      triggerPlatformHint();
      return;
    }
    
    // If on last question and trying to generate, check first 2 answers (question 3 is optional)
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    if (isLastQuestion) {
      // Save current answer (all questions are optional)
      const currentAnswer = textarea.value.trim();
      answers[currentQuestionIndex] = currentAnswer;
    }
    
    nextQuestion();
    autoResize();
    updateButtonState();
  });

  textarea.addEventListener('keydown', function(e) {
    // Prevent input beyond character limit
    const maxLength = characterLimits[currentQuestionIndex] || 900;
    if (textarea.value.length >= maxLength && e.key !== 'Backspace' && e.key !== 'Delete' && !e.ctrlKey && !e.metaKey) {
      // Allow navigation keys, shortcuts, and Enter/Backspace for navigation
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
    }
    
    // Handle Enter key for navigation
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
    
    // Handle Backspace to go to previous question when textarea is empty
    if (e.key === 'Backspace' && textarea.value === '') {
      e.preventDefault();
      previousQuestion();
    }
  });
  
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const id = this.getAttribute('id');
      
      // If new controller exists, skip platform button handling (controller handles it)
      if ((id === 'phoneBtn' || id === 'computerBtn') && window.questionFlowController) {
        // Let the controller handle it - don't do anything here
        return;
      }
      
      if (id === 'phoneBtn') {
        // Toggle mobile selection (old code - only if controller doesn't exist)
        selectedPlatforms.mobile = !selectedPlatforms.mobile;
        this.classList.toggle('selected');
      } else if (id === 'computerBtn') {
        // Toggle web selection (old code - only if controller doesn't exist)
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
  
  // Add click events for progress dots (only if new controller doesn't exist)
  if (!window.questionFlowController) {
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
    case 2: // Additional details
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
    // Use browser/system language or fallback to English
    const browserLanguage = navigator.language || navigator.userLanguage || 'en-US';
    recognition.lang = browserLanguage;
    
    recognition.onstart = function() {
      isRecording = true;
      updateMicrophoneButton();
    };
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const textarea = document.getElementById('mainInput');
      if (textarea) {
        // Trim transcript if it exceeds the limit
        const maxLength = characterLimits[currentQuestionIndex] || 900;
        const trimmedTranscript = transcript.substring(0, maxLength);
        textarea.value = trimmedTranscript;
        // Trigger auto-resize and update UI
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        // Update character count - this will also trigger updateButtonState via input event
        updateCharacterLimit();
        // Manually trigger input event to update button state
        textarea.dispatchEvent(new Event('input'));
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
  try {
    // Clear any previous spec data to force creating a NEW spec
    localStorage.removeItem('currentSpecId');
    localStorage.removeItem('generatedOverviewContent');
    localStorage.removeItem('initialAnswers');
    
    // Check if planning data exists (new planning interface)
    let planningText = '';
    let planningData = null;
    
    if (window.planningText) {
      planningText = window.planningText;
      planningData = window.planningData;
      // Clear after using
      delete window.planningText;
      delete window.planningData;
    }
    
    // Fallback: Check if answers come from Live Brief modal (old flow)
    if (!planningText && window.liveBriefAnswers && Array.isArray(window.liveBriefAnswers) && window.liveBriefAnswers.length === 3) {
      answers = window.liveBriefAnswers;
      if (window.liveBriefSelectedPlatforms) {
        selectedPlatforms = window.liveBriefSelectedPlatforms;
      }
      // Clear the window variables after using them
      delete window.liveBriefAnswers;
      delete window.liveBriefSelectedPlatforms;
    }
    
    // Fallback: Check if answers exist (all questions are optional)
    if (!planningText && (!answers || answers.length === 0)) {
      answers = [];
    }
    
    // Fallback: Ensure we have 3 answers (pad with empty strings if needed)
    if (!planningText) {
      while (answers.length < 3) {
        answers.push('');
      }
    }
    
    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
      if (generateButton) {
        setButtonLoading(generateButton, false);
      }
      showRegistrationModal();
      return;
    }
    
    // Update store with loading state
    if (window.store) {
      window.store.set('loading', true);
    }
    
    // Check credits before generating spec
    if (typeof checkEntitlement !== 'undefined') {
      const entitlementCheck = await checkEntitlement();
      if (!entitlementCheck.hasAccess) {
        const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
        if (generateButton) {
          setButtonLoading(generateButton, false);
        }
        if (window.store) {
          window.store.set('loading', false);
        }
        const paywallPayload = entitlementCheck.paywallData || {
          reason: 'insufficient_credits',
          message: 'You have no remaining spec credits'
        };
        try {
          const searchParams = new URLSearchParams({
            reason: paywallPayload.reason || 'insufficient_credits',
            message: paywallPayload.message || 'You have no remaining spec credits'
          });
          window.location.href = `/pages/pricing.html?${searchParams.toString()}`;
        } catch (redirectError) {
          alert(paywallPayload.message || 'You do not have enough credits to create a spec. Please purchase credits or upgrade to Pro.');
        }
        return;
      }
    }
    
    // Show loading state on button
    const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
    if (generateButton) {
      setButtonLoading(generateButton, true);
    }
    
    // Prepare the prompt for overview generation
    let prompt = '';
    let enhancedPrompt = '';
    
    if (planningText) {
      // Use new planning data
      const mainPitch = planningData?.vision?.description || '';
      const pagesText = planningData?.pages?.list?.length > 0 
        ? `\n\nPages:\n${planningData.pages.list.map((p, i) => `${i+1}. ${p.name}${p.description && p.description !== 'No description provided' ? ' - ' + p.description : ''}`).join('\n')}`
        : '';
      const workflowsText = planningData?.workflows?.list?.length > 0
        ? `\n\nWorkflows:\n${planningData.workflows.list.map((w, i) => {
            let text = `${i+1}. ${w.name || 'Unnamed Workflow'}`;
            if (w.steps && w.steps.length > 0) {
              text += '\n' + w.steps.map((s, si) => `   Step ${si+1}: ${s}`).join('\n');
            }
            return text;
          }).join('\n\n')}`
        : '';
      const featuresText = planningData?.features 
        ? `\n\nFeatures:\n${[...(planningData.features.selected || []), ...(planningData.features.custom || [])].map((f, i) => `${i+1}. ${f}`).join('\n')}`
        : '';
      const designText = planningData?.design?.selected
        ? `\n\nDesign Style: ${planningData.design.selected}${planningData.design.description ? ' - ' + planningData.design.description : ''}`
        : '';
      const integrationsText = planningData?.integrations?.list?.length > 0
        ? `\n\nIntegrations: ${planningData.integrations.list.join(', ')}`
        : '';
      const audienceText = planningData?.audience
        ? `\n\nTarget Audience:\n${planningData.audience.platform ? `Platform: ${planningData.audience.platform.label || planningData.audience.platform.type}\n` : ''}${planningData.audience.interests?.list?.length > 0 ? `Interests: ${planningData.audience.interests.list.join(', ')}\n` : ''}${planningData.audience.ageRange ? `Age Range: ${planningData.audience.ageRange.min} - ${planningData.audience.ageRange.max} years\n` : ''}${planningData.audience.gender ? `Gender: ${planningData.audience.gender.label || planningData.audience.gender.type}` : ''}`
        : '';
      
      // Create comprehensive user input from planning data
      const userInput = `App Description: ${mainPitch}${pagesText}${workflowsText}${featuresText}${designText}${integrationsText}${audienceText}`;
      
      // Use PROMPTS.overview with the user input as a single answer
      prompt = PROMPTS.overview([userInput, '', '']);
    } else {
      // Fallback to old 3-question flow
      prompt = PROMPTS.overview(answers);
      
      // Add platform information to the prompt
      const platformInfo = [];
      if (selectedPlatforms && selectedPlatforms.mobile) platformInfo.push("Mobile App");
      if (selectedPlatforms && selectedPlatforms.web) platformInfo.push("Web App");
      
      const platformText = platformInfo.length > 0 
        ? `Target Platform: ${platformInfo.join(', ')}` 
        : 'Target Platform: Not specified';
      
      enhancedPrompt = `${prompt}\n\n${platformText}`;
    }
    
    // Use enhanced prompt if available, otherwise use regular prompt
    if (!enhancedPrompt) {
      enhancedPrompt = prompt;
    }
    
    // CRITICAL: Consume credit BEFORE creating spec and starting background job
    // This prevents race condition where background job runs but spec gets deleted due to credit error
    let creditConsumed = false;
    let consumeTransactionId = null;
    let tempSpecIdForCredit = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const consumeResult = await window.api.post('/api/v3/credits/consume', {
        specId: tempSpecIdForCredit
      });
      
      creditConsumed = true;
      consumeTransactionId = consumeResult.transactionId || tempSpecIdForCredit;
      
      // Update credits display
      if (typeof window.clearCreditsCache === 'function') {
        window.clearCreditsCache();
      }
      if (typeof window.updateCreditsDisplay !== 'undefined') {
        await window.updateCreditsDisplay({ forceRefresh: true }).catch(err => {});
      }
    } catch (creditError) {
      // Handle credit errors - don't create spec if credit consumption fails
      const errorMessage = creditError.message || 'Failed to consume credit';
      if (errorMessage.includes('already processed') || errorMessage.includes('alreadyProcessed')) {
        creditConsumed = true;
        consumeTransactionId = `idempotent-${Date.now()}`;
      } else {
        // Credit consumption failed - don't create spec or start background job
        const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
        if (generateButton) {
          setButtonLoading(generateButton, false);
        }
        if (window.store) {
          window.store.set('loading', false);
        }
        
        // Handle 403 errors (insufficient credits)
        if (creditError.status === 403) {
          const errorData = creditError.data || {};
          const userMessage = errorData.message || errorData.details?.message || 'You do not have enough credits to create a spec';
          
          const paywallPayload = {
            reason: 'insufficient_credits',
            message: userMessage
          };
          try {
            const searchParams = new URLSearchParams({
              reason: paywallPayload.reason || 'insufficient_credits',
              message: paywallPayload.message || 'You have no remaining spec credits'
            });
            window.location.href = `/pages/pricing.html?${searchParams.toString()}`;
          } catch (redirectError) {
            alert(paywallPayload.message || 'You do not have enough credits to create a spec. Please purchase credits or upgrade to Pro.');
          }
          return;
        }
        
        // Other errors
        alert(errorMessage || 'Failed to consume credit. Please try again.');
        return;
      }
    }
    
    // Generate specification - try queue API first, fallback to direct API
    // Now that credit is consumed, we can safely create spec and start background job
    let data;
    let useQueue = true; // Try queue first
    let specIdForQueue = null;
    
    try {
      // Create spec document with pending status (needed for queue API)
      const user = firebase.auth().currentUser;
      if (useQueue && user) {
        try {
          // Create temporary spec document
          const tempSpecDoc = {
            title: "Generating...",
            overview: null,
            technical: null,
            market: null,
            status: {
              overview: "generating",
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
          
          const tempDocRef = await firebase.firestore().collection('specs').add(tempSpecDoc);
          specIdForQueue = tempDocRef.id;
          
          // Update the credit transaction with the real specId (for record keeping)
          // Note: This is optional - the credit was already consumed with temp specId
          
          // Try queue API
          const queueResponse = await window.api.post('/api/specs/generate-overview', {
            userInput: enhancedPrompt,
            specId: specIdForQueue
          });
          
          if (queueResponse.success) {
            // Queue started successfully - use the specId and continue
            showNotification('Overview generation started in background. Redirecting...', 'info');
            data = { specification: null, pending: true, specId: specIdForQueue };
          } else {
            // Delete temp spec and fallback
            await firebase.firestore().collection('specs').doc(specIdForQueue).delete();
            specIdForQueue = null;
            useQueue = false;
          }
        } catch (queueError) {
          console.warn('Queue API failed, falling back to direct API:', queueError);
          // Delete temp spec if created
          if (specIdForQueue) {
            try {
              await firebase.firestore().collection('specs').doc(specIdForQueue).delete();
            } catch (e) {}
            specIdForQueue = null;
          }
          useQueue = false;
        }
      }
      
      // Fallback to direct API if queue failed or not used
      // But still create specId immediately and use queue API for background generation
      if (!useQueue || !data || !data.pending) {
        const user = firebase.auth().currentUser;
        if (user) {
          try {
            // Create specId immediately (like queue flow)
            const tempSpecDoc = {
              title: "Generating...",
              overview: null,
              technical: null,
              market: null,
              status: {
                overview: "generating",
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
            
            const tempDocRef = await firebase.firestore().collection('specs').add(tempSpecDoc);
            const directSpecId = tempDocRef.id;
            
            // Try to use queue API for background generation
            try {
              const queueResponse = await window.api.post('/api/specs/generate-overview', {
                userInput: enhancedPrompt,
                specId: directSpecId
              });
              
              if (queueResponse.success) {
                // Queue started successfully - use the specId and continue
                data = { specification: null, pending: true, specId: directSpecId };
                specIdForQueue = directSpecId;
                useQueue = true;
              } else {
                // Queue API failed, but we have specId - use direct API in background
                // We'll update the spec after redirect
                data = { specification: null, pending: true, specId: directSpecId, useDirectAPI: true, userInput: enhancedPrompt };
                specIdForQueue = directSpecId;
                useQueue = true;
              }
            } catch (queueError) {
              console.warn('Queue API failed for direct flow, will use direct API in background:', queueError);
              // Queue API failed, but we have specId - use direct API in background
              data = { specification: null, pending: true, specId: directSpecId, useDirectAPI: true, userInput: enhancedPrompt };
              specIdForQueue = directSpecId;
              useQueue = true;
            }
          } catch (specCreationError) {
            console.error('Failed to create spec document:', specCreationError);
            // Fallback to old direct API flow if spec creation fails
            data = await window.api.post('/api/generate-spec', {
              userInput: enhancedPrompt
            });
          }
        } else {
          // User not authenticated - fallback to old direct API
          data = await window.api.post('/api/generate-spec', {
            userInput: enhancedPrompt
          });
        }
      }
    } catch (error) {
      // Cleanup: Delete any spec that was created but failed
      if (specIdForQueue) {
        try {
          await firebase.firestore().collection('specs').doc(specIdForQueue).delete();
          console.log('Cleaned up spec after error:', specIdForQueue);
        } catch (cleanupError) {
          console.warn('Failed to cleanup spec after error:', cleanupError);
        }
      }
      
      // Handle 403 (paywall) errors
      if (error.status === 403) {
        const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
        if (generateButton) {
          setButtonLoading(generateButton, false);
        }
        if (window.store) {
          window.store.set('loading', false);
        }
        
        // Handle insufficient credits
        let paywallPayload;
        if (error.data) {
          paywallPayload = error.data?.paywallData || {
            reason: error.data?.error || 'insufficient_credits',
            message: error.data?.message || error.data?.details || 'You have no remaining spec credits'
          };
        } else {
          paywallPayload = {
            reason: 'insufficient_credits',
            message: 'You have no remaining spec credits'
          };
        }
        try {
          const searchParams = new URLSearchParams({
            reason: paywallPayload.reason || 'insufficient_credits',
            message: paywallPayload.message || 'You have no remaining spec credits'
          });
          window.location.href = `/pages/pricing.html?${searchParams.toString()}`;
        } catch (redirectError) {
          alert(paywallPayload.message || 'You do not have enough credits to create a spec. Please purchase credits or upgrade to Pro.');
        }
        return;
      }
      // Handle other errors
      let errorMessage = error.message || 'Failed to generate specification';
      if (error.data) {
        const errorData = error.data;
        if (errorData.requestId) {
          errorMessage += ` [Server Request ID: ${errorData.requestId}]`;
        }
        if (errorData.errorType) {
          errorMessage += ` (${errorData.errorType})`;
        }
      }
      
      const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
      if (generateButton) {
        setButtonLoading(generateButton, false);
      }
      if (window.store) {
        window.store.set('loading', false);
      }
      
      throw new Error(errorMessage);
    }
    
    // Extract overview content from the response
    let overviewContent;
    let firebaseId = null;
    
    // If using queue, spec already exists and overview will be updated by queue
    // Credit was already consumed before creating spec, so we can proceed
    if (data && data.pending && specIdForQueue) {
      firebaseId = specIdForQueue;
      overviewContent = null; // Will be updated by queue
      
      // Credit was already consumed before creating spec - no need to consume again
      // Update store
      if (window.store) {
        window.store.set('loading', false);
        window.store.set('currentSpec', { id: firebaseId, overview: null });
      }
      
      // Redirect to spec viewer immediately - listener will update when ready
      window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
      return; // Exit early - queue will handle the rest
    }
    
    // Normal flow - direct API was used
    overviewContent = data.specification || 'No overview generated';
    
    // Update store with loading state
    if (window.store) {
      window.store.set('loading', false);
    }
    
    // Credit was already consumed before creating spec - no need to consume again
    // Save to Firebase and redirect
    try {
      firebaseId = await saveSpecToFirebase(overviewContent, answers);
    } catch (saveError) {
      // Note: Credit was already consumed, so we can't refund it here
      // The spec creation failed, but credit was already consumed
      const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
      if (generateButton) {
        setButtonLoading(generateButton, false);
      }
      throw new Error(`Failed to save specification: ${saveError.message}`);
    }
    
    // Update store with new spec
    if (window.store) {
      window.store.set('currentSpec', { id: firebaseId, overview: overviewContent });
      // Refresh specs list if needed
      const currentSpecs = window.store.get('specs') || [];
      window.store.set('specs', [...currentSpecs, { id: firebaseId, overview: overviewContent }]);
    }
    
    // Refresh credits display and clear cache
    // This is a trigger to update credits after spec creation
    // Use new credits system
    if (typeof window.clearCreditsCache === 'function') {
      window.clearCreditsCache();
    }
    if (typeof window.updateCreditsDisplay !== 'undefined') {
      // Update credits display immediately after spec creation (trigger-based update)
      await window.updateCreditsDisplay({ forceRefresh: true });
    }
    
    // Update store with credits (will be updated by credits-v3-display.js)
    if (window.store) {
      window.store.subscribe((newState, prevState) => {
        if (newState.credits !== prevState.credits) {
          // Credits updated
        }
      }, ['credits']);
    }
    
    // Trigger OpenAI upload (non-blocking)
    if (window.ENABLE_OPENAI_STORAGE !== false) {
      triggerOpenAIUpload(firebaseId).catch(err => {
        // Background OpenAI upload failed
      });
    }
    
    // Store in localStorage for backup
    localStorage.setItem('generatedOverviewContent', overviewContent);
    localStorage.setItem('initialAnswers', JSON.stringify(answers));
    
    // Redirect to spec viewer immediately with Firebase ID
    window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
    
  } catch (error) {
    // Reset button loading state
    const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
    if (generateButton) {
      setButtonLoading(generateButton, false);
    }
    
    const errorMessage = error.message || 'Error generating specification. Please try again.';
    
    // Show user-friendly error message
    alert(`Error: ${errorMessage}\n\nPlease check the console for more details.`);
  }
}

// ===== BUTTON LOADING STATE FUNCTIONS =====
function setButtonLoading(buttonSelector, isLoading) {
  const button = typeof buttonSelector === 'string' 
    ? document.querySelector(buttonSelector) 
    : buttonSelector;
  
  if (!button) return;
  
  if (isLoading) {
    button.disabled = true;
    const originalText = button.textContent || button.innerHTML;
    button.dataset.originalText = originalText;
    button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';
    button.classList.add('loading');
  } else {
    button.disabled = false;
    const originalText = button.dataset.originalText || 'Generate Final Spec';
    button.innerHTML = originalText;
    button.classList.remove('loading');
  }
}

// Make function globally accessible
window.setButtonLoading = setButtonLoading;

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
    
    const specId = docRef.id;
    
    // Record activity in admin log (fire and forget - don't block on this)
    if (window.api) {
      window.api.post(`/api/specs/${specId}/record-activity`).catch(err => {
        // Failed to record spec activity
      });
    }
    
    return specId;
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
    
    await window.api.post(`/api/specs/${specId}/upload-to-openai`);
    
    // Upload successful - no need to do anything else
    return;
  } catch (error) {
    // Note: This is non-critical, so we don't throw - upload happens in background
    // Log error for debugging if needed
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

// ===== CREDIT INITIALIZATION LOADING =====
async function initializeCreditsWithLoading() {
  // Wait for Firebase to be available
  if (typeof firebase === 'undefined' || !firebase.auth) {
    setTimeout(initializeCreditsWithLoading, 100);
    return;
  }
  
  const user = firebase.auth().currentUser;
  if (!user) {
    return; // User not authenticated, skip
  }
  
  try {
    // Show loading state in credits button immediately (via updateCreditsDisplay)
    // This uses the existing loading state in the header credits button
    if (typeof window.updateCreditsDisplay === 'function') {
      // This will show "Loading credits..." in the header button
      await window.updateCreditsDisplay({ forceRefresh: false });
    }
    
    // Wait for ensureUserDocument to complete (it's called from firebase-auth.html)
    // Poll until user is initialized or timeout
    let attempts = 0;
    const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds max (reduced from 20 for faster loading)
    let userInitialized = false;
    let lastError = null;
    
    while (attempts < maxAttempts && !userInitialized) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      
      // Try to get credits - if it succeeds, user is initialized
      try {
        if (typeof window.clearCreditsCache === 'function') {
          window.clearCreditsCache();
        }
        if (typeof window.updateCreditsDisplay === 'function') {
          // Try to update credits - if user is initialized, this will work
          await window.updateCreditsDisplay({ forceRefresh: true });
          userInitialized = true;
          break;
        }
      } catch (error) {
        lastError = error;
        // Check if error is about user not being initialized
        const errorMessage = error.message || error.toString() || '';
        const errorString = JSON.stringify(error).toLowerCase();
        
        if (errorMessage.includes('must be initialized') || 
            errorMessage.includes('User credits not found') ||
            errorMessage.includes('500') ||
            errorString.includes('must be initialized') ||
            errorString.includes('user credits not found')) {
          // User not initialized yet, keep waiting
          continue;
        }
        // Other errors - might be network issues
      }
    }
    
    if (!userInitialized) {
      // Try one more time with forceRefresh - maybe user was initialized in the meantime
      if (typeof window.clearCreditsCache === 'function') {
        window.clearCreditsCache();
      }
      if (typeof window.updateCreditsDisplay === 'function') {
        try {
          await window.updateCreditsDisplay({ forceRefresh: true });
        } catch (finalError) {
          // Credits will show "unavailable" - user can refresh page
        }
      }
    } else {
      // User initialized successfully, do final refresh to ensure latest data
      if (typeof window.clearCreditsCache === 'function') {
        window.clearCreditsCache();
      }
      if (typeof window.updateCreditsDisplay === 'function') {
        await window.updateCreditsDisplay({ forceRefresh: true });
      }
    }
  } catch (error) {
    // Even on error, try to show credits (might be cached)
    if (typeof window.updateCreditsDisplay === 'function') {
      try {
        await window.updateCreditsDisplay({ forceRefresh: false });
      } catch (e) {
        // Ignore secondary errors
      }
    }
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
  // Clear any stale spec data when user arrives at fresh form
  localStorage.removeItem('currentSpecId');
  localStorage.removeItem('generatedOverviewContent');
  
  // Ensure button is not in loading state on page load
  const generateButton = document.querySelector('button[onclick="generateSpecFromPlanning()"]');
  if (generateButton) {
    setButtonLoading(generateButton, false);
  }
  
  // Check if user is authenticated and initialize credits with loading
  // Wait for Firebase to be available
  function checkAuthAndInitialize() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(checkAuthAndInitialize, 100);
      return;
    }
    
    const user = firebase.auth().currentUser;
    if (user) {
      initializeCreditsWithLoading();
    } else {
      // Listen for auth state changes
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          initializeCreditsWithLoading();
        }
      });
    }
  }
  
  checkAuthAndInitialize();
  
  checkFirstVisit();
  // Delay checkForCreditPopup until after credit initialization (reduced delay for faster UX)
  setTimeout(() => {
    checkForCreditPopup();
  }, 1000); // Reduced from 3s to 1s for faster popup display
  setupModernInput();
  checkAutoStart();
  
  // Initialize Live Brief Modal (after DOM is ready)
  // Wait a bit to ensure all scripts are loaded
  setTimeout(() => {
    if (typeof LiveBriefModal !== 'undefined') {
      try {
        window.liveBriefModal = new LiveBriefModal();
      } catch (error) {
        // Error initializing Live Brief Modal
      }
    }
  }, 100);
  
  const startButton = document.getElementById('startButton');
  if (startButton) {
    startButton.addEventListener('click', handleStartButtonClick);
  }
  
  // Function to switch to voice mode
  function switchToVoiceMode() {
    // Use new Question Flow Controller
    if (window.questionFlowController) {
      window.questionFlowController.switchToVoice();
    } else {
      // Fallback to old implementation
      const currentAnswer = document.getElementById('mainInput')?.value || '';
      if (currentAnswer && currentQuestionIndex < answers.length) {
        answers[currentQuestionIndex] = currentAnswer;
      }
      
      const inputContainer = document.getElementById('modernInputContainer');
      const questionsDisplay = document.getElementById('questionsDisplay');
      
      if (inputContainer) {
        inputContainer.style.display = 'none';
        inputContainer.style.visibility = 'hidden';
        inputContainer.style.opacity = '0';
        inputContainer.style.transition = 'none';
        inputContainer.classList.remove('fade-in');
      }
      
      if (questionsDisplay) {
        questionsDisplay.style.display = 'none';
        questionsDisplay.style.visibility = 'hidden';
        questionsDisplay.style.opacity = '0';
        questionsDisplay.style.transition = 'none';
        questionsDisplay.classList.remove('fade-in');
      }
      
      if (window.liveBriefModal) {
        const answersToPrefill = [];
        for (let i = 0; i < 3; i++) {
          if (i === currentQuestionIndex && currentAnswer) {
            answersToPrefill[i] = currentAnswer;
          } else if (answers[i]) {
            answersToPrefill[i] = answers[i];
          }
        }
        window.liveBriefModal.open(answersToPrefill.length > 0 ? answersToPrefill : null);
      }
    }
  }
  
  // Setup typing mode toggle handlers - called when typing mode is shown
  // Make it available globally so Live Brief modal can call it
  window.setupTypingModeToggle = function() {
    // Helper function to update toggle and labels state
    const updateToggleState = (checked) => {
      const toggleInput = document.getElementById('typingModeToggleSwitch');
      if (toggleInput) {
        toggleInput.checked = checked;
      }
      const voiceLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="voice"]');
      const typingLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="typing"]');
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
    const toggleInput = document.getElementById('typingModeToggleSwitch');
    if (toggleInput) {
      toggleInput.disabled = false;
      toggleInput.style.pointerEvents = 'auto';
      toggleInput.style.cursor = 'pointer';
      
      // Remove any existing listeners by cloning
      const newToggle = toggleInput.cloneNode(true);
      toggleInput.parentNode.replaceChild(newToggle, toggleInput);
      
      newToggle.addEventListener('change', function(e) {
        // Use Question Flow Controller if available
        if (window.questionFlowController) {
          if (!e.target.checked) {
            window.questionFlowController.switchToVoice();
          } else {
            // Already in typing mode
            window.questionFlowController.switchToMode('typing');
          }
        } else {
          // Fallback to old implementation
          updateToggleState(e.target.checked);
          if (!e.target.checked) {
            switchToVoiceMode();
          }
        }
      });
    }
    
    // Get mode labels
    const voiceLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="voice"]');
    const typingLabel = document.querySelector('.typing-mode-toggle .mode-label[data-mode="typing"]');
    
    // Remove any existing listeners by cloning and replacing
    if (voiceLabel) {
      const newVoiceLabel = voiceLabel.cloneNode(true);
      voiceLabel.parentNode.replaceChild(newVoiceLabel, voiceLabel);
      
      newVoiceLabel.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.questionFlowController) {
          window.questionFlowController.switchToVoice();
        } else {
          updateToggleState(false);
          switchToVoiceMode();
        }
      });
    }
    
    if (typingLabel) {
      const newTypingLabel = typingLabel.cloneNode(true);
      typingLabel.parentNode.replaceChild(newTypingLabel, typingLabel);
      
      newTypingLabel.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Already in typing mode, just update visual state
        updateToggleState(true);
      });
    }
  };
  
  // Override showModernInput to setup toggle handlers
  const originalShowModernInput = showModernInput;
  showModernInput = function(prefilledAnswers) {
    originalShowModernInput(prefilledAnswers);
    // Setup toggle handlers after a short delay to ensure DOM is ready
    setTimeout(() => {
      window.setupTypingModeToggle();
    }, 100);
  };
  
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
  
  // Load dynamic stats - lazy load only when stats section is visible (no delay)
  function loadStatsWhenVisible() {
    const statsSection = document.querySelector('.section[style*="--section-index: 1"]') || 
                         document.querySelector('.stats-list')?.closest('.section');
    
    if (!statsSection) {
      // Fallback: load after short delay if section not found
      setTimeout(() => {
        loadDynamicStats().then(() => {
          setupStatsAnimations();
        });
      }, 500);
      return;
    }
    
    // Load stats only when section enters viewport
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.disconnect();
          // Load stats data
          loadDynamicStats().then(() => {
            setupStatsAnimations();
          });
        }
      });
    }, { rootMargin: '100px' }); // Start loading 100px before visible
    
    observer.observe(statsSection);
  }
  
  function setupStatsAnimations() {
    // Intersection Observer for counter animations
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target.querySelector('.stat-number');
          if (counter) {
            const target = parseInt(counter.dataset.target);
            animateCounter(counter, target);
            counterObserver.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.1 });
    
    const statsItems = document.querySelectorAll('.stat-item');
    statsItems.forEach(item => counterObserver.observe(item));
  }
  
  loadStatsWhenVisible();
  
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
  
  // Fade-in animation for hero title, description, icons, and button
  function initHeroFadeIn() {
    const heroTitle = document.querySelector('.hero-main-title');
    const heroDescription = document.querySelector('.hero-description-text');
    const specIcons = document.querySelectorAll('.spec-card-square .spec-icon');
    const startButton = document.querySelector('.hero-cta-button-new');
    
    // Fade in title after 0.3s
    if (heroTitle) {
      setTimeout(() => {
        heroTitle.classList.add('fade-in');
      }, 300);
    }
    
    // Fade in description after 0.5s
    if (heroDescription) {
      setTimeout(() => {
        heroDescription.classList.add('fade-in');
      }, 500);
    }
    
    // Fade in tagline after 0.7s
    const heroTagline = document.querySelector('.hero-tagline');
    if (heroTagline) {
      setTimeout(() => {
        heroTagline.classList.add('fade-in');
      }, 700);
    }
    
    // Fade in icons with staggered delay (starting after 0.7s)
    specIcons.forEach((icon, index) => {
      setTimeout(() => {
        icon.classList.add('fade-in');
      }, 700 + (index * 100)); // Each icon appears 100ms after the previous one
    });
    
    // Fade in Start button and secondary buttons (Why?) last, before Vanta (~1.1s - after icons start appearing)
    if (startButton) {
      setTimeout(() => {
        startButton.classList.add('fade-in');
        
        // Fade in all secondary buttons (Why?) at the same time
        // Note: View Demo button is now inside browser window and appears on hover
        const secondaryButtons = document.querySelectorAll('.hero-cta-button-secondary');
        secondaryButtons.forEach((button) => {
          button.classList.add('fade-in');
        });
        
        // Fade in subtext after buttons appear
        const subtext = document.querySelector('.start-now-subtext');
        if (subtext) {
          setTimeout(() => {
            subtext.classList.add('visible');
          }, 300); // Appears 300ms after buttons
        }
        
        // Fade in MCP teaser after subtext (part of same sequence)
        const mcpTeaser = document.querySelector('.hero-mcp-teaser');
        if (mcpTeaser) {
          setTimeout(() => {
            mcpTeaser.classList.add('visible');
          }, 500); // Appears 500ms after buttons (200ms after subtext)
        }
        
        // Fade in browser window after Start button appears
        const browserWindow = document.querySelector('.browser-window-preview');
        if (browserWindow) {
          setTimeout(() => {
            browserWindow.classList.add('fade-in');
          }, 500); // Appears 500ms after Start button
        }
      }, 1100); // Appears after icons start, before Vanta
    }
  }
  
  // Initialize fade-in animation
  initHeroFadeIn();
  
  // Initialize scroll reveal for section titles
  initSectionTitlesFadeIn();
  
});

// Scroll reveal for section titles and content
function initSectionTitlesFadeIn() {
  // Fallback: reveal all titles and subtitles after a short delay if IntersectionObserver is not available
  const revealAllFallback = function() {
    setTimeout(function() {
      const allTitles = document.querySelectorAll('.section-title, .section-subtitle, .section-container, .content-layout, .content-text');
      allTitles.forEach(function(element) {
        element.classList.add('revealed');
      });
    }, 500);
  };

  // Check if IntersectionObserver is available
  if (typeof IntersectionObserver === 'undefined') {
    revealAllFallback();
    return;
  }

  // Observer for why-section titles and subtitles - triggers when element enters viewport (delayed)
  const whySectionTitleObserverOptions = {
    root: null,
    rootMargin: '0px 0px -200px 0px',
    threshold: 0.1
  };

  const whySectionTitleObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, whySectionTitleObserverOptions);

  // Observer for why-section content - triggers when element enters viewport (delayed)
  const whySectionContentObserverOptions = {
    root: null,
    rootMargin: '0px 0px -150px 0px',
    threshold: 0.2
  };

  const whySectionContentObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, whySectionContentObserverOptions);

  // Observer for other section titles (extra-sections, etc.) - delayed
  const titleObserverOptions = {
    root: null,
    rootMargin: '0px 0px -200px 0px',
    threshold: 0.1
  };

  const titleObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, titleObserverOptions);

  // Observer for other section content - delayed
  const contentObserverOptions = {
    root: null,
    rootMargin: '0px 0px -150px 0px',
    threshold: 0.2
  };

  const contentObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, contentObserverOptions);

  // Observe why-section titles and subtitles with specific observer
  const whySectionTitles = document.querySelectorAll('.why-section .section-title, .why-section .section-subtitle');
  whySectionTitles.forEach(function(title) {
    whySectionTitleObserver.observe(title);
  });

  // Observe why-section content-layout and content-text-centered with specific observer
  // When content-layout enters viewport, it gets 'revealed' class which triggers animations on children
  const whySectionContentLayouts = document.querySelectorAll('.why-section .content-layout, .why-section .content-text-centered');
  whySectionContentLayouts.forEach(function(element) {
    whySectionContentObserver.observe(element);
  });

  // Observe all other section titles and subtitles (extra-sections, etc.)
  const sectionTitles = document.querySelectorAll('.section-title, .section-subtitle');
  sectionTitles.forEach(function(title) {
    // Skip if already observed by whySectionTitleObserver
    if (!title.closest('.why-section')) {
      titleObserver.observe(title);
    }
  });

  // Observe h2 elements in .section (extra-sections) - they also need fade in
  const extraSectionH2s = document.querySelectorAll('.extra-sections .section h2');
  extraSectionH2s.forEach(function(h2) {
    titleObserver.observe(h2);
  });

  // Observe all other section containers and content layouts
  const sectionContainers = document.querySelectorAll('.section-container, .content-layout, .content-text, .content-image, .section');
  sectionContainers.forEach(function(container) {
    // Skip if already observed by whySectionContentObserver
    if (!container.closest('.why-section')) {
      contentObserver.observe(container);
    }
  });
  
  // Also observe .content-layout specifically - it needs revealed class for children to show
  const contentLayouts = document.querySelectorAll('.content-layout');
  contentLayouts.forEach(function(layout) {
    // Skip if already observed
    if (!layout.closest('.why-section')) {
      contentObserver.observe(layout);
    }
  });
  
  // Observe .section elements in .extra-sections - they need revealed class
  const extraSections = document.querySelectorAll('.extra-sections .section');
  extraSections.forEach(function(section) {
    contentObserver.observe(section);
  });

  // Fallback: if after 10 seconds no elements were revealed (for accessibility), reveal them all
  // This is only for edge cases where IntersectionObserver might not work
  setTimeout(function() {
    const unrevealed = document.querySelectorAll('.section-title:not(.revealed), .section-subtitle:not(.revealed), .section-container:not(.revealed), .content-layout:not(.revealed), .content-image:not(.revealed), .content-text:not(.revealed), .content-text-centered:not(.revealed), .extra-sections .section:not(.revealed), .extra-sections .section h2:not(.revealed)');
    if (unrevealed.length > 0) {
      unrevealed.forEach(function(element) {
        element.classList.add('revealed');
      });
    }
  }, 10000);
}

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

// ===== BROWSER WINDOW TABS AUTO-SWITCH =====
(function() {
  const tabs = ['overview', 'technical', 'market', 'design', 'diagrams', 'prompts'];
  let currentTabIndex = 4; // Start with 'diagrams' (index 4)
  let autoSwitchInterval = null;
  let hasScrolled = false;
  let isHoveringTabs = false;
  const switchInterval = 4000; // 4 seconds
  const scrollDelayInterval = 5000; // 5 seconds after scroll

  function switchTab(index) {
    const tabButtons = document.querySelectorAll('.browser-window-tab');
    if (tabButtons.length === 0) return;

    // Remove active class from all tabs
    tabButtons.forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });

    // Add active class to current tab
    if (tabButtons[index]) {
      tabButtons[index].classList.add('active');
      tabButtons[index].setAttribute('aria-selected', 'true');
    }

    // Show corresponding content
    const tabContents = document.querySelectorAll('.browser-tab-content');
    const currentTab = tabs[index];
    
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.getAttribute('data-tab-content') === currentTab) {
        content.classList.add('active');
        
        // Render Mermaid diagrams if diagrams tab is active
        if (currentTab === 'diagrams' && typeof mermaid !== 'undefined') {
          setTimeout(() => {
            renderBrowserDiagrams();
          }, 300);
        }
      }
    });

    currentTabIndex = index;
  }
  
  function renderBrowserDiagrams() {
    if (typeof mermaid === 'undefined') {
      return;
    }
    
    try {
      const diagramsContainer = document.querySelector('.browser-tab-content[data-tab-content="diagrams"]');
      if (!diagramsContainer) return;
      
      const mermaidElements = diagramsContainer.querySelectorAll('.mermaid:not(:has(svg))');
      if (mermaidElements.length === 0) return;
      
      // Initialize Mermaid if not already initialized
      if (!window.mermaidInitialized) {
        mermaid.initialize({ 
          startOnLoad: false,
          theme: 'default',
          themeVariables: {
            primaryColor: '#FF6B35',
            primaryTextColor: '#333',
            primaryBorderColor: '#FF6B35',
            lineColor: '#333',
            secondaryColor: '#f5f5f5',
            tertiaryColor: '#fff'
          }
        });
        window.mermaidInitialized = true;
      }
      
      // Render diagrams
      if (mermaid.run) {
        mermaid.run({ 
          querySelector: '.browser-tab-content[data-tab-content="diagrams"] .mermaid:not(:has(svg))' 
        });
      } else if (mermaid.contentLoaded) {
        mermaid.contentLoaded();
      }
    } catch (error) {
      // Error rendering browser diagrams
    }
  }

  function nextTab() {
    // Don't switch if hovering over tabs
    if (isHoveringTabs) return;
    
    currentTabIndex = (currentTabIndex + 1) % tabs.length;
    switchTab(currentTabIndex);
  }

  function startAutoSwitch() {
    if (autoSwitchInterval) return; // Already running
    if (isHoveringTabs) return; // Don't start if hovering
    
    autoSwitchInterval = setInterval(() => {
      nextTab();
    }, switchInterval);
  }

  function stopAutoSwitch() {
    if (autoSwitchInterval) {
      clearInterval(autoSwitchInterval);
      autoSwitchInterval = null;
    }
  }

  function checkIfScrolled() {
    if (hasScrolled) return;
    
    if (window.scrollY > 100) {
      hasScrolled = true;
      // Start auto-switch after scrollDelayInterval (5 seconds)
      setTimeout(() => {
        startAutoSwitch();
      }, scrollDelayInterval);
    }
  }


  // Initialize tabs on page load
  document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.browser-window-tab');
    if (tabButtons.length === 0) return;
    
    
    // Initialize content visibility
    const tabContents = document.querySelectorAll('.browser-tab-content');
    tabContents.forEach(content => {
      if (content.getAttribute('data-tab-content') === 'diagrams') {
        content.classList.add('active');
      }
    });
    
    // Set diagrams as default active
    switchTab(4); // diagrams index
    
    // Render diagrams after a delay if diagrams tab is active
    setTimeout(() => {
      if (document.querySelector('.browser-tab-content[data-tab-content="diagrams"]').classList.contains('active')) {
        renderBrowserDiagrams();
      }
    }, 1000);

    // Handle manual tab clicks
    tabButtons.forEach((tab, index) => {
      tab.addEventListener('click', function() {
        stopAutoSwitch();
        switchTab(index);
        // Restart auto-switch after delay if user has scrolled
        if (hasScrolled) {
          setTimeout(() => {
            startAutoSwitch();
          }, scrollDelayInterval);
        }
      });
      
      // Pause auto-switch when hovering over tabs
      tab.addEventListener('mouseenter', function() {
        isHoveringTabs = true;
        stopAutoSwitch();
      });
      
      tab.addEventListener('mouseleave', function() {
        isHoveringTabs = false;
        // Restart auto-switch after delay if user has scrolled
        if (hasScrolled) {
          setTimeout(() => {
            startAutoSwitch();
          }, scrollDelayInterval);
        }
      });
    });
    
    // Also handle hover on tabs container
    const tabsContainer = document.querySelector('.browser-window-tabs');
    if (tabsContainer) {
      tabsContainer.addEventListener('mouseenter', function() {
        isHoveringTabs = true;
        stopAutoSwitch();
      });
      
      tabsContainer.addEventListener('mouseleave', function() {
        isHoveringTabs = false;
        // Restart auto-switch after delay if user has scrolled
        if (hasScrolled) {
          setTimeout(() => {
            startAutoSwitch();
          }, scrollDelayInterval);
        }
      });
    }

    // Check scroll position - start timer only after user scrolls
    let scrollCheckTimeout;
    window.addEventListener('scroll', function() {
      if (!hasScrolled) {
        clearTimeout(scrollCheckTimeout);
        scrollCheckTimeout = setTimeout(checkIfScrolled, 100);
      }
    });

    // Initial check - don't start auto-switch until user scrolls
    // checkIfScrolled(); // Commented out - wait for user scroll
    
  });
})();
