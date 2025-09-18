let formData = {};

function selectTopic(button, topic) {
  const buttons = document.querySelectorAll("#topicSelector button");
  buttons.forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");
  formData.topic = topic;
}

function selectPlatform(button, platform) {
  const buttons = document.querySelectorAll("#platformSelector button");
  buttons.forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");
  formData.platform = platform;

  buttons.forEach((btn) => btn.classList.remove("required"));
}

function saveAndProceed() {
  const ideaInput = document.getElementById("ideaInput").value.trim();
  const platformButtons = document.querySelectorAll("#platformSelector button");
  let platformSelected = false;

  platformButtons.forEach((button) => {
    if (button.classList.contains("active")) {
      platformSelected = true;
    }
  });

  if (!formData.topic) {
    alert("Please select a topic.");
    return;
  }

  if (!ideaInput) {
    alert("Please enter your app idea.");
    return;
  }

  formData.idea = ideaInput;
  localStorage.setItem("formData", JSON.stringify(formData));
  window.location.href = "processing.html";
}

function handleLogin() {
  window.location.href = "login.html";
}

function handleRegister() {
  window.location.href = "register.html";
}

// Steps Animation for Auth Page
class StepsAnimation {
  constructor() {
    this.currentStep = 0;
    this.steps = [
      {
        icon: "",
        title: "App Specification",
        description: "Define your app requirements, features, and functionality with our intelligent specification tool. Create detailed technical specifications and user stories."
      },
      {
        icon: "",
        title: "Market Research",
        description: "Conduct comprehensive market analysis to understand your target audience and competition. Get insights on market trends and user needs."
      },
      {
        icon: "",
        title: "Development Management",
        description: "Manage your app development process efficiently with our project management tools. Track progress, coordinate teams, and ensure timely delivery."
      }
    ];
    this.interval = null;
    this.init();
  }

  init() {
    this.createStepsHTML();
    this.setupEventListeners();
    this.startAutoPlay();
  }

  createStepsHTML() {
    const container = document.querySelector('.steps-container');
    if (!container) return;

    container.innerHTML = `
      ${this.steps.map((step, index) => `
        <div class="step-slide ${index === 0 ? 'active' : ''}" data-step="${index}">
          <div class="step-icon">${step.icon}</div>
          <h2 class="step-title">${step.title}</h2>
          <p class="step-description">${step.description}</p>
        </div>
      `).join('')}
      <div class="step-indicators">
        ${this.steps.map((_, index) => `
          <div class="step-indicator ${index === 0 ? 'active' : ''}" data-step="${index}"></div>
        `).join('')}
      </div>
    `;
  }

  setupEventListeners() {
    const indicators = document.querySelectorAll('.step-indicator');
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        this.goToStep(index);
      });
    });
  }

  goToStep(stepIndex) {
    if (stepIndex === this.currentStep) return;

    const slides = document.querySelectorAll('.step-slide');
    const indicators = document.querySelectorAll('.step-indicator');

    // Remove active classes
    slides[this.currentStep].classList.remove('active');
    indicators[this.currentStep].classList.remove('active');

    // Add prev class to current slide
    slides[this.currentStep].classList.add('prev');

    // Set new current step
    this.currentStep = stepIndex;

    // Add active classes
    slides[this.currentStep].classList.add('active');
    indicators[this.currentStep].classList.add('active');

    // Remove prev class after animation
    setTimeout(() => {
      slides.forEach(slide => slide.classList.remove('prev'));
    }, 800);
  }

  nextStep() {
    const nextIndex = (this.currentStep + 1) % this.steps.length;
    this.goToStep(nextIndex);
  }

  startAutoPlay() {
    this.interval = setInterval(() => {
      this.nextStep();
    }, 4000); // Change step every 4 seconds
  }

  stopAutoPlay() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  destroy() {
    this.stopAutoPlay();
  }
}

// Initialize steps animation when page loads
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.steps-container')) {
    new StepsAnimation();
  }
});

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
}
