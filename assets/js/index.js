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

// ===== COUNTER ANIMATION =====
function animateCounter(element, target, duration = 2000) {
  let start = 0;
  const increment = target / (duration / 16);
  
  function updateCounter() {
    start += increment;
    if (start < target) {
      element.textContent = Math.floor(start);
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
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
  
  if (isUserAuthenticated()) {
    proceedWithAppPlanning();
  } else {
    showRegistrationModal();
  }
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

const questions = [
  "Describe your application",
  "Describe the workflow", 
  "Target audience and goals",
  "Additional details"
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
  if (currentQuestionElement && currentQuestionIndex < questions.length) {
    currentQuestionElement.textContent = questions[currentQuestionIndex];
  }
}

function nextQuestion() {
  const textarea = document.getElementById('mainInput');
  const answer = textarea.value.trim();
  
  if (!answer) return;
  
  // Save the answer
  answers[currentQuestionIndex] = answer;
  
  // Clear the textarea
  textarea.value = '';
  
  // Move to next question
  currentQuestionIndex++;
  
  if (currentQuestionIndex < questions.length) {
    // Show next question with fade transition
    const currentQuestionElement = document.getElementById('currentQuestion');
    if (currentQuestionElement) {
      currentQuestionElement.style.opacity = '0';
      setTimeout(() => {
        currentQuestionElement.textContent = questions[currentQuestionIndex];
        currentQuestionElement.style.opacity = '1';
      }, 300);
    }
  } else {
    // All questions completed - call API
    console.log('All questions completed:', answers);
    generateSpecification();
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
  
  textarea.addEventListener('input', autoResize);
  
  sendBtn.addEventListener('click', function() {
    nextQuestion();
    autoResize();
  });
  
  // Demo button functionality
  const demoBtn = document.getElementById('demoBtn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function() {
      fillDemoAnswers();
    });
  }

  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
    
    if (e.key === ' ') {
      console.log('AI shortcut triggered');
    }
    
    if (e.key === '/') {
      console.log('Saved replies triggered');
    }
  });
  
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const title = this.getAttribute('title');
      console.log(title + ' clicked');
    });
  });
}

// ===== DEMO FUNCTIONALITY =====
function fillDemoAnswers() {
  console.log('🚀 Filling demo answers...');
  
  // Demo answers for a fitness tracking app
  const demoAnswers = [
    "FitTracker Pro is a comprehensive fitness tracking mobile application that helps users monitor their daily physical activities, set fitness goals, and track their progress over time. The app includes features like step counting, workout logging, nutrition tracking, and social challenges to keep users motivated on their fitness journey.",
    
    "Users start by creating a profile and setting their fitness goals. They can log daily activities like walking, running, or gym workouts. The app tracks calories burned, steps taken, and workout duration. Users can also log their meals and water intake. The app provides weekly progress reports and sends motivational notifications to keep users engaged.",
    
    "The target audience includes fitness enthusiasts aged 18-45 who want to track their health and fitness progress. This includes gym-goers, runners, cyclists, and anyone looking to maintain a healthy lifestyle. The app is designed for both beginners who need guidance and advanced users who want detailed analytics.",
    
    "The app includes social features where users can connect with friends, participate in fitness challenges, and share their achievements. It also integrates with popular fitness wearables and includes a premium subscription tier with advanced analytics, personalized workout plans, and nutrition coaching."
  ];
  
  // Fill all answers at once
  answers = [...demoAnswers];
  
  // Show a loading message
  const textarea = document.getElementById('mainInput');
  if (textarea) {
    textarea.value = "🚀 Demo answers loaded! Sending to API...";
    textarea.style.color = '#ff6b35';
  }
  
  // Wait a moment then call the API
  setTimeout(() => {
    console.log('🚀 Demo answers:', answers);
    generateSpecification();
  }, 1000);
}

// ===== API INTEGRATION =====
async function generateSpecification() {
  try {
    console.log('🚀 Starting generateSpecification...');
    
    // Show loading overlay
    showLoadingOverlay();
    
    // Prepare the prompt for overview generation
    const prompt = PROMPTS.overview(answers);
    
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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const overviewContent = await response.text();
    console.log('✅ API response received:', overviewContent);
    
    // Save to Firebase and redirect
    const firebaseId = await saveSpecToFirebase(overviewContent, answers);
    console.log('✅ Saved to Firebase successfully with ID:', firebaseId);
    
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

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
  checkFirstVisit();
  setupModernInput();
  
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