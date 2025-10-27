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
    // Get tools count from tools.json
    const toolsResponse = await fetch('/tools/map/tools.json');
    const toolsData = await toolsResponse.json();
    const toolsCount = toolsData.length; // 104 tools
    
    // Get specs count from Firebase
    let specsCount = 0;
    try {
      // Check if Firebase is available
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        const db = firebase.firestore();
        const specsSnapshot = await db.collection('specs').get();
        specsCount = specsSnapshot.size;
      }
    } catch (error) {
      console.log('Could not fetch specs from Firebase:', error);
      specsCount = 0;
    }
    
    // Add base number to specs (4590 as requested)
    const specsWithBase = specsCount + 4590;
    
    // Calculate Tool Finder users (specs + base multiplier)
    const toolFinderUsers = specsCount + 850; // Adding 850 to specs count
    
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
    dot.classList.remove('current', 'completed');
    
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

function updateLightbulbTooltip() {
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
}

function jumpToQuestion(questionIndex) {
  if (questionIndex >= 0 && questionIndex < questions.length) {
    currentQuestionIndex = questionIndex;
    
    // Restore answer if exists
    const textarea = document.getElementById('mainInput');
    if (textarea) {
      textarea.value = answers[currentQuestionIndex] || '';
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
  
  if (!answer) return;
  
  // Save the answer
  answers[currentQuestionIndex] = answer;
  
  // Clear the textarea
  textarea.value = '';
  
  // Reset button state
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.style.background = '#cccccc';
    sendBtn.disabled = true;
  }
  
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
    const minLength = 20;
    
    if (textLength >= minLength) {
      // Orange (active) button
      sendBtn.style.background = '#FF6B35';
      sendBtn.style.cursor = 'pointer';
      sendBtn.disabled = false;
    } else {
      // Gray (disabled) button
      sendBtn.style.background = '#cccccc';
      sendBtn.style.cursor = 'not-allowed';
      sendBtn.disabled = true;
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
    // Prevent action if button is disabled
    if (sendBtn.disabled) return;
    nextQuestion();
    autoResize();
    updateButtonState();
  });
  
  // Demo buttons functionality
  for (let i = 1; i <= 5; i++) {
    const demoBtn = document.getElementById(`demoBtn${i}`);
    if (demoBtn) {
      const demoType = demoBtn.getAttribute('data-demo');
      demoBtn.addEventListener('click', function() {
        fillDemoAnswers(demoType);
      });
    }
  }

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only allow sending if button is not disabled (20+ characters)
      if (!sendBtn.disabled) {
        sendBtn.click();
      }
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
function fillDemoAnswers(demoType = 'recipe') {
  console.log(`🚀 Filling demo answers for: ${demoType}...`);
  
  let demoAnswers = [];
  
  // Different demo scenarios
  const demos = {
    recipe: [
      "RecipeShare is a social cooking and meal planning mobile application that helps users discover new recipes, plan their weekly meals, create shopping lists, and share their culinary creations with a community of food lovers. The app includes features like personalized recipe recommendations, step-by-step cooking instructions with video tutorials, nutritional information, dietary filters, and the ability to save and organize favorite recipes.",
      "Users start by browsing recipes or searching for specific dishes based on ingredients, cuisine type, dietary preferences, or cooking time. They can save recipes to their collection and add them to a weekly meal planner. The app automatically generates a shopping list based on selected recipes. Users can follow cooking video tutorials, rate and review recipes, and share their own recipe creations with photos. The app sends meal reminders and grocery shopping notifications.",
      "The target audience includes home cooks aged 25-55 who enjoy cooking and meal planning. This includes busy professionals who want to meal prep efficiently, families looking for healthy dinner ideas, students learning to cook, and food enthusiasts who want to try new cuisines. The app caters to people with various dietary needs including vegetarian, vegan, gluten-free, keto, and allergy-friendly options.",
      "The app includes social features where users can follow other home chefs, create recipe collections, participate in cooking challenges, and get inspiration from community-created content. It integrates with popular grocery delivery services, includes nutrition tracking, meal prep tips, and a premium subscription tier with exclusive chef-created recipes, advanced meal planning tools, and ad-free browsing experience."
    ],
    fitness: [
      "FitTracker Pro is a comprehensive fitness and health tracking mobile application designed to help users achieve their fitness goals. The app offers workout planning with video demonstrations, progress tracking with photos and measurements, nutrition logging with calorie counting, step and activity tracking with wearable device integration, social features to share achievements, and personalized workout recommendations based on fitness level.",
      "Users begin by setting fitness goals and completing a fitness assessment. They then receive personalized workout plans or can browse pre-made routines by body part or fitness type. During workouts, users follow video demonstrations, log sets and reps, and track rest periods. The app automatically syncs with fitness wearables to record steps and calories burned. Users log meals through photo recognition or manual entry, view macro and micronutrient breakdowns, and receive meal suggestions. Progress photos and body measurements are recorded at regular intervals, and achievements are shared with friends for motivation.",
      "The target audience includes fitness enthusiasts aged 18-45, gym-goers looking for structured programs, people starting their fitness journey who need guidance, professionals who want efficient workout plans, and anyone tracking weight loss or muscle gain goals. The app serves both beginners needing step-by-step instructions and advanced users wanting complex training programs.",
      "The app integrates with popular fitness wearables, offers live workout classes with trainers, provides access to a database of thousands of exercises, includes AI-powered form correction using camera technology, offers nutritionist consultations in-app, features community challenges and competitions, provides premium content from celebrity trainers, and includes a marketplace for fitness equipment and supplements."
    ],
    tasks: [
      "TaskFlow is an intelligent task management and productivity web application that helps individuals and teams organize, prioritize, and complete work efficiently. The app features smart task creation with natural language processing, AI-powered task prioritization, project organization with boards and lists, team collaboration with comments and file attachments, deadline tracking with calendar integration, automation for recurring tasks, and time tracking for productivity insights.",
      "Users start by creating tasks using natural language like 'meet with John tomorrow at 3pm about the project' and the app automatically parses details. Tasks are organized into projects and can be viewed as lists, boards, or calendar. The AI assistant suggests priorities based on deadlines, importance, and user patterns. Team members are invited to projects where they can add comments, attach files, assign tasks, and track progress. The app sends smart reminders before deadlines, identifies scheduling conflicts, suggests optimal meeting times, and automates recurring tasks like weekly reviews. Time tracking runs automatically when users work on specific tasks, and weekly reports show productivity trends.",
      "The target audience includes professionals managing multiple projects, remote teams needing coordination tools, freelancers tracking billable hours, students organizing coursework, entrepreneurs managing startups, and anyone overwhelmed with to-dos who needs intelligent automation. The app serves both individuals and teams of up to 100 members.",
      "The app integrates with email clients to create tasks from emails, connects with calendar apps for scheduling, offers browser extensions for quick task capture, provides templates for common project types, includes reporting and analytics for time management, features Zapier integrations for automation with other tools, offers white-label solutions for agencies, provides custom AI models trained on company workflows, and includes enterprise features like SSO, advanced permissions, and data export capabilities."
    ],
    social: [
      "ConnectSphere is a location-based social networking mobile application that helps people discover events, activities, and like-minded individuals in their area. The app features interest-based communities, local event discovery and RSVP, real-time chat and messaging, activity feed with photos and videos, friend connections and social graphs, location-based recommendations, privacy controls, and group planning features for activities and outings.",
      "Users create profiles highlighting their interests, hobbies, and what they're looking for. They can join interest-based communities like photography, hiking, board games, or entrepreneurship. The app shows nearby events based on interests and location, and users can RSVP to events visible to their friends or community members. Users discover people with similar interests nearby, send connection requests, and chat in groups or one-on-one. Posts in the activity feed show what friends and community members are doing, and users can react, comment, or share. When planning activities, users create polls, schedule meetups, split expenses, and coordinate logistics within the app.",
      "The target audience includes young professionals aged 22-35 looking to expand their social circle, people new to a city seeking connections, hobbyists wanting to find interest groups, professionals networking in their field, students looking for study groups or social activities, and anyone wanting to discover local happenings and meet people with shared passions. The app serves both introverts wanting low-pressure interactions and extroverts seeking constant social opportunities.",
      "The app includes advanced privacy controls allowing users to control profile visibility and location sharing, offers verification badges for businesses and professionals, includes monetization features for event organizers to sell tickets, integrates with calendar apps for event reminders, provides safety features like reporting and blocking mechanisms, features live streaming for events and meetups, offers premium memberships with enhanced features like unlimited communities and advanced filters, and includes analytics for event organizers to track engagement and attendance."
    ],
    learning: [
      "SkillVault is an interactive e-learning platform for web and mobile that helps users acquire new skills through video courses, interactive exercises, and peer learning. The app offers curated courses from expert instructors, hands-on coding challenges and projects, skill assessments and certifications, interactive Q&A with instructors, peer code review and collaboration, progress tracking with streaks and achievements, offline download for mobile learning, and career path guidance with personalized recommendations.",
      "Learners start by choosing a skill path like web development, data science, or digital marketing. They enroll in structured courses with video lessons, reading materials, and interactive exercises. As they progress, they complete hands-on projects that are reviewed by peers and instructors. The app tracks learning streaks and awards badges for consistency and achievements. Learners can ask questions anytime and get responses from instructors or the community. The AI learning assistant suggests the next course based on goals and completed content. Learners can download course materials for offline study, sync progress across devices, and share achievements on social media. Career coaching features help learners identify skills needed for target jobs and recommend specific courses.",
      "The target audience includes career changers looking to acquire new skills, recent graduates seeking practical experience, working professionals wanting to upskill, students supplementing formal education, hobbyists learning for personal interest, entrepreneurs needing business skills, and unemployed individuals preparing for new careers. The platform serves both beginners starting from scratch and experienced professionals wanting advanced specializations.",
      "The app offers accredited certifications recognized by employers, provides live workshops and office hours with instructors, includes career services like resume review and interview prep, partners with companies to offer job placement assistance, features a marketplace where learners can monetize their own courses, provides API access for enterprise training programs, includes white-label solutions for organizations, offers analytics dashboards for learners to track skill growth, integrates with LinkedIn to showcase certifications and skills, and provides scholarships for low-income learners."
    ]
  };
  
  // Get the demo answers for the selected type
  demoAnswers = demos[demoType] || demos.recipe;
  
  // Initialize answers array if it doesn't exist
  if (!answers) {
    answers = [];
  }
  
  // Fill all answers at once
  answers = [...demoAnswers];
  
  // Set current question index to last question to trigger generation
  currentQuestionIndex = questions.length;
  
  // Show a loading message
  const textarea = document.getElementById('mainInput');
  if (textarea) {
    textarea.value = `🚀 ${demoType.charAt(0).toUpperCase() + demoType.slice(1)} demo loaded! Sending to API...`;
    textarea.style.color = '#ff6b35';
  }
  
  // Update progress dots
  updateProgressDots();
  
  // Wait a moment then call the API
  setTimeout(() => {
    console.log('🚀 Demo answers:', answers);
    console.log('🚀 Answers length:', answers.length);
    generateSpecification();
  }, 1000);
}

// ===== API INTEGRATION =====
async function generateSpecification() {
  try {
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
    try {
      const token = await user.getIdToken();
      const statusResponse = await fetch(`${window.API_BASE_URL || 'http://localhost:3001'}/api/specs/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('🎯 Credits status:', statusData);
        
        if (!statusData.canCreate) {
          hideLoadingOverlay();
          console.warn('⚠️ No credits available:', statusData.reason);
          
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
                description: '3 additional specifications (Save $5)'
              },
              {
                id: 'pro_monthly',
                name: 'Pro Monthly',
                price: 29.90,
                currency: 'USD',
                description: 'Unlimited specifications + editing'
              },
              {
                id: 'pro_yearly',
                name: 'Pro Yearly',
                price: 299.90,
                currency: 'USD',
                description: 'Unlimited specifications + editing (Save $58.90)'
              }
            ]
          };
          
          showPaywall(paywallData);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking credits:', error);
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
    
    // Call the new API endpoint with authorization
    const response = await fetch(`${window.API_BASE_URL || 'http://localhost:3001'}/api/specs/create`, {
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

    if (response.status === 402) {
      // Payment required - show paywall
      const paywallData = await response.json();
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
    
    console.log('📝 Saving spec document to Firebase:', {
      title: specDoc.title,
      hasOverview: !!specDoc.overview,
      overviewType: typeof specDoc.overview,
      overviewLength: specDoc.overview ? specDoc.overview.length : 0,
      answersCount: specDoc.answers.length,
      mode: specDoc.mode,
      status: specDoc.status
    });
    
    // Check if we have an existing spec ID in localStorage or URL
    let existingSpecId = localStorage.getItem('currentSpecId');
    if (!existingSpecId) {
      // Check URL parameters for existing spec ID
      const urlParams = new URLSearchParams(window.location.search);
      existingSpecId = urlParams.get('id');
    }
    
    let docRef;
    if (existingSpecId) {
      // Update existing document
      docRef = firebase.firestore().collection('specs').doc(existingSpecId);
      await docRef.update({
        ...specDoc,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Spec updated in Firebase with ID:', existingSpecId);
    } else {
      // Create new document
      docRef = await firebase.firestore().collection('specs').add(specDoc);
      console.log('Spec saved to Firebase with ID:', docRef.id);
      // Store the new ID for future updates
      localStorage.setItem('currentSpecId', docRef.id);
    }
    
    return docRef.id || existingSpecId;
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
    const response = await fetch(`${window.API_BASE_URL || 'http://localhost:3001'}/api/specs/${specId}/upload-to-openai`, {
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
  if (window.paywallManager) {
    window.paywallManager.showPaywall(paywallData, (entitlements) => {
      // Success callback - retry specification generation
      console.log('Purchase successful, retry specification generation');
      generateSpecification();
    });
  } else {
    // Fallback if paywall manager not loaded
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