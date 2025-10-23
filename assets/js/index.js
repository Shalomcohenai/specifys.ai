// Index Page Specific JavaScript - Specifys.ai
// This file contains all the JavaScript functionality specific to the index page

// ===== WELCOME MODAL FUNCTIONS =====
function showWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    if (typeof gtag !== 'undefined') {
      gtag('event', 'view', {
        'event_category': 'Welcome Modal',
        'event_label': 'First Visit Welcome'
      });
    }
  }
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    if (typeof gtag !== 'undefined') {
      gtag('event', 'close', {
        'event_category': 'Welcome Modal',
        'event_label': 'Welcome Modal Closed'
      });
    }
  }
}

// Check if this is the first visit
function checkFirstVisit() {
  const hasVisited = localStorage.getItem('specifys_visited');
  if (!hasVisited) {
    setTimeout(() => {
      showWelcomeModal();
    }, 1000);
    
    localStorage.setItem('specifys_visited', 'true');
    
    if (typeof gtag !== 'undefined') {
      gtag('event', 'first_visit', {
        'event_category': 'User Engagement',
        'event_label': 'First Time Visitor'
      });
    }
  }
}

// ===== MENU TOGGLE FUNCTIONALITY =====
function initMenuToggle() {
  const menuToggle = document.querySelector('.menu-toggle');
  const clipPathMenu = document.querySelector('.clip-path-menu');

  if (menuToggle && clipPathMenu) {
    menuToggle.addEventListener('click', () => {
      const isActive = clipPathMenu.classList.contains('active');
      clipPathMenu.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', !isActive);
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!menuToggle.contains(e.target) && !clipPathMenu.contains(e.target)) {
        clipPathMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

// ===== FAQ ACCORDION FUNCTIONALITY =====
function initFAQAccordion() {
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener("click", () => {
      const answer = question.nextElementSibling;
      const isOpen = answer.classList.contains("open");
      
      // Close all other FAQ items
      document.querySelectorAll(".faq-answer").forEach(ans => {
        ans.classList.remove("open");
        ans.previousElementSibling.classList.remove("open");
      });
      
      // Toggle current FAQ item
      if (!isOpen) {
        answer.classList.add("open");
        question.classList.add("open");
      }
    });
  });
}

// ===== COUNTER ANIMATION FOR STATS =====
function initCounterAnimation() {
  const statNumbers = document.querySelectorAll('.stat-number');
  let hasAnimated = false;

  function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    function updateCounter() {
      if (start < target) {
        start += increment;
        element.textContent = Math.floor(start) + "+";
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target + "+";
      }
    }
    requestAnimationFrame(updateCounter);
  }

  const statsSection = document.querySelector(".stats-list");
  if (statsSection) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated) {
        statNumbers.forEach(stat => {
          const target = parseInt(stat.getAttribute("data-target"));
          animateCounter(stat, target);
        });
        hasAnimated = true;
        observer.unobserve(statsSection);
      }
    }, { threshold: 0.5 });
    observer.observe(statsSection);
  }
}

// ===== TOOLS SHOWCASE INTERACTIONS =====
function initToolsShowcase() {
  document.addEventListener('DOMContentLoaded', function() {
    const toolSquares = document.querySelectorAll('.tool-square');
    const toolsShowcase = document.querySelector('.tools-showcase');
    
    // Check if device is mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    toolSquares.forEach(square => {
      square.addEventListener('click', function(e) {
        if (isMobile) {
          // Check if clicking on a link inside the content
          const clickedLink = e.target.closest('.tool-link');
          const isExpanded = this.classList.contains('active');
          
          if (!isExpanded && !clickedLink) {
            // First click on the square: show content
            e.preventDefault();
            e.stopPropagation();
            // Remove active class from all other squares
            toolSquares.forEach(s => s.classList.remove('active'));
            // Add active class to clicked square
            this.classList.add('active');
          } else if (clickedLink && isExpanded) {
            // Second click on the link: allow navigation
            if (typeof gtag !== 'undefined') {
              const toolName = this.getAttribute('data-tool') || 'plan-smart';
              gtag('event', 'click', {
                'event_category': 'Tools Showcase',
                'event_label': toolName + '_navigate'
              });
            }
          } else if (!clickedLink && isExpanded) {
            // Clicking on expanded square (not on link): keep it expanded
            e.preventDefault();
          }
        } else {
          // Desktop: track click
          if (typeof gtag !== 'undefined') {
            const toolName = this.getAttribute('data-tool') || 'plan-smart';
            gtag('event', 'click', {
              'event_category': 'Tools Showcase',
              'event_label': toolName + '_click'
            });
          }
        }
      });
    });
    
    // Close expanded square when clicking outside
    if (isMobile) {
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.tool-square')) {
          toolSquares.forEach(s => s.classList.remove('active'));
        }
      });
    }
  });
}

// ===== ANALYTICS TRACKING FUNCTIONS =====
function trackStartNowClick() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'click', {
      'event_category': 'engagement',
      'event_label': 'start_now_button',
      'event_source': 'hero_section'
    });
  }
}

// ===== KEYBOARD AND SCROLL EVENT HANDLERS =====
function initEventHandlers() {
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const welcomeModal = document.getElementById('welcomeModal');
      if (welcomeModal && welcomeModal.style.display === 'flex') {
        closeWelcomeModal();
      }
    }
  });

  // Close welcome modal when clicking outside
  document.addEventListener('DOMContentLoaded', () => {
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
      welcomeModal.addEventListener('click', (e) => {
        if (e.target.id === 'welcomeModal') {
          closeWelcomeModal();
        }
      });
    }
  });
}

// ===== INITIALIZATION FUNCTION =====
function initIndexPage() {
  // Initialize all components when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    initMenuToggle();
    initFAQAccordion();
    initCounterAnimation();
    initToolsShowcase();
    initEventHandlers();
    
    // Check for first visit
    checkFirstVisit();
  });
}

// Auto-initialize when script loads
initIndexPage();
