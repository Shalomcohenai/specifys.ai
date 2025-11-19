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
  
  // Use new Question Flow Controller
  if (window.questionFlowController) {
    try {
      window.questionFlowController.start('typing').catch(error => {
        // Fallback to old flow if controller fails
        proceedWithAppPlanning();
      });
    } catch (error) {
      // Fallback to old flow if controller fails
      proceedWithAppPlanning();
    }
  } else {
    proceedWithAppPlanning();
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
      
      // Check if first 2 questions are answered
      let allAnswered = true;
      for (let i = 0; i < 2; i++) {
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
    
    // Check if answers come from Live Brief modal
    if (window.liveBriefAnswers && Array.isArray(window.liveBriefAnswers) && window.liveBriefAnswers.length === 3) {
      answers = window.liveBriefAnswers;
      if (window.liveBriefSelectedPlatforms) {
        selectedPlatforms = window.liveBriefSelectedPlatforms;
      }
      // Clear the window variables after using them
      delete window.liveBriefAnswers;
      delete window.liveBriefSelectedPlatforms;
    }
    
    // Check if answers exist and are valid (support both 3 and 4 answers for compatibility)
    if (!answers || (answers.length !== 3 && answers.length !== 4)) {
      hideLoadingOverlay();
      alert('Error: Invalid answers provided. Please provide answers to all required questions.');
      return;
    }
    
    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      hideLoadingOverlay();
      showRegistrationModal();
      return;
    }
    
    // Check credits before generating spec
    if (typeof checkEntitlement !== 'undefined') {
      const entitlementCheck = await checkEntitlement();
      if (!entitlementCheck.hasAccess) {
        hideLoadingOverlay();
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
    
    const response = await fetch(`${apiBaseUrl}/api/generate-spec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userInput: enhancedPrompt
      })
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        hideLoadingOverlay();
        let paywallPayload;
        try {
          const cloned = response.clone();
          const payload = await cloned.json();
          paywallPayload = payload?.paywallData || {
            reason: payload?.error || 'insufficient_credits',
            message: payload?.message || payload?.details || 'You have no remaining spec credits'
          };
        } catch (parseError) {
          // Unable to parse 403 payload
        }
        if (!paywallPayload) {
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
      } catch (parseError) {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          errorDetails = { text: errorText };
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        } catch (textError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          errorDetails = { parseError: textError.message };
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Extract overview content from the response
    const overviewContent = data.specification || 'No overview generated';
    
    // Consume credit BEFORE saving to Firebase
    // If save fails, we'll refund the credit
    let creditConsumed = false;
    let consumeTransactionId = null;
    
    try {
      const token = await user.getIdToken();
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
      
      // First, create a temporary spec ID for credit consumption
      // We'll update it with the real spec ID after saving
      const tempSpecId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const consumeResponse = await fetch(`${apiBaseUrl}/api/specs/consume-credit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ specId: tempSpecId })
      });

      if (!consumeResponse.ok) {
        const errorData = await consumeResponse.json();
        throw new Error(errorData.message || 'Failed to consume credit');
      }
      
      const consumeResult = await consumeResponse.json();
      creditConsumed = true;
      consumeTransactionId = consumeResult.transactionId || tempSpecId;
      
    } catch (creditError) {
      hideLoadingOverlay();
      throw new Error(`Failed to consume credit: ${creditError.message}`);
    }
    
    // Save to Firebase and redirect
    let firebaseId = null;
    try {
      firebaseId = await saveSpecToFirebase(overviewContent, answers);
    } catch (saveError) {
      // Refund credit if save failed
      if (creditConsumed) {
        try {
          const token = await user.getIdToken();
          const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
          
          const refundResponse = await fetch(`${apiBaseUrl}/api/credits/refund`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: 1,
              reason: 'Spec creation failed - save to Firebase failed',
              originalTransactionId: consumeTransactionId
            })
          });
          
          if (!refundResponse.ok) {
            await refundResponse.json();
          }
        } catch (refundError) {
          // Error refunding credit - the main error is the save failure
        }
      }
      
      hideLoadingOverlay();
      throw new Error(`Failed to save specification: ${saveError.message}`);
    }
    
    // Refresh credits display and clear cache
    if (typeof window.clearEntitlementsCache !== 'undefined') {
      window.clearEntitlementsCache();
    }
    if (typeof window.updateCreditsDisplay !== 'undefined') {
      window.updateCreditsDisplay();
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
    
    // Redirect to spec viewer with Firebase ID
    setTimeout(() => {
      window.location.href = `/pages/spec-viewer.html?id=${firebaseId}`;
    }, 1000);
    
  } catch (error) {
    // Hide loading overlay
    hideLoadingOverlay();
    
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
    const uploadUrl = `${apiBaseUrl}/api/specs/${specId}/upload-to-openai`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      let errorDetails = null;
      try {
        const error = await response.json();
        errorDetails = {
          status: response.status,
          statusText: response.statusText,
          error: error.error || 'Upload failed',
          details: error.details || null,
          requestId: error.requestId || null
        };
        throw new Error(error.error || 'Upload failed');
      } catch (parseError) {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          errorDetails = {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500)
          };
          throw new Error(`Upload failed: HTTP ${response.status} ${response.statusText}`);
        } catch (textError) {
          errorDetails = {
            status: response.status,
            statusText: response.statusText,
            parseError: textError.message
          };
          throw new Error(`Upload failed: HTTP ${response.status} ${response.statusText}`);
        }
      }
    }
    
    await response.json();
  } catch (error) {
    // Note: This is non-critical, so we don't throw - upload happens in background
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
  
  checkFirstVisit();
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
