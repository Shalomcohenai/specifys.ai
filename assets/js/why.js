// Why Page - Clean JavaScript

(function() {
  'use strict';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    initScrollReveal();
    initPromptAnimation();
    initLogoJumpAnimation();
  });

  // Scroll Reveal - Staggered reveal: title first, then subtitle, then container content
  function initScrollReveal() {
    // Observer for titles - reveals early
    const titleObserverOptions = {
      root: null,
      rootMargin: '100px 0px -200px 0px',
      threshold: 0.1
    };

    const titleObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, titleObserverOptions);

    // Observer for subtitles - reveals after title
    const subtitleObserverOptions = {
      root: null,
      rootMargin: '50px 0px -150px 0px',
      threshold: 0.1
    };

    const subtitleObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, subtitleObserverOptions);

    // Observer for content layouts - reveals images and text containers
    const layoutObserverOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.2
    };

    const layoutObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, layoutObserverOptions);

    // Observe titles
    const titles = document.querySelectorAll('.section-title');
    titles.forEach(function(title) {
      titleObserver.observe(title);
    });

    // Observe subtitles
    const subtitles = document.querySelectorAll('.section-subtitle');
    subtitles.forEach(function(subtitle) {
      subtitleObserver.observe(subtitle);
    });

    // Observe content layouts (not containers)
    const layouts = document.querySelectorAll('.content-layout');
    layouts.forEach(function(layout) {
      layoutObserver.observe(layout);
    });

    // Observe content-text-centered
    const centeredTexts = document.querySelectorAll('.content-text-centered');
    centeredTexts.forEach(function(text) {
      layoutObserver.observe(text);
    });

    // Observe standalone containers (like spec-cards-showcase-orange)
    const standaloneContainers = document.querySelectorAll('.spec-cards-showcase-orange');
    standaloneContainers.forEach(function(container) {
      layoutObserver.observe(container);
    });
  }

  // Prompt Animation - Continuous fade out/in effect with many credits and prompts
  function initPromptAnimation() {
    const container = document.getElementById('promptAnimationContainer');
    if (!container) return;

    // List of prompts - expanded list
    const prompts = [
      'Create me a website for banking',
      'Build an app that tracks subscriptions',
      'Make a social media platform',
      'Create an e-commerce store',
      'Build a task management app',
      'Create a fitness tracking platform',
      'Make a food delivery app',
      'Build a dating app',
      'Create a music streaming service',
      'Make a video editing tool',
      'Build a project management system',
      'Create a learning platform',
      'Make a real estate app',
      'Build a healthcare app',
      'Create a travel booking platform',
      'Make a weather app',
      'Build a note-taking app',
      'Create a photo sharing app',
      'Make a budgeting app',
      'Build a habit tracker',
      'Create a recipe app',
      'Make a language learning app',
      'Build a meditation app',
      'Create a news aggregator',
      'Make a podcast app',
      'Build a calendar app',
      'Create a password manager',
      'Make a shopping list app',
      'Build a workout planner',
      'Create a sleep tracker'
    ];

    // Credit counter sizes and positions - many positions, all below container top (starting from 30% to avoid container)
    // Positions are spread out to avoid overlap
    const creditPositions = [
      // Top area (below container top - starting from 30%)
      { size: 'large', top: '30%', left: '2%' },
      { size: 'medium', top: '32%', right: '2%' },
      { size: 'small', top: '34%', left: '5%' },
      { size: 'tiny', top: '36%', right: '5%' },
      { size: 'medium', top: '38%', left: '8%' },
      { size: 'small', top: '40%', right: '8%' },
      { size: 'large', top: '42%', left: '12%' },
      { size: 'tiny', top: '44%', right: '12%' },
      { size: 'medium', top: '46%', left: '15%' },
      { size: 'small', top: '48%', right: '15%' },
      { size: 'tiny', top: '50%', left: '18%' },
      { size: 'large', top: '52%', right: '18%' },
      // Left side - spread out vertically and horizontally
      { size: 'large', top: '54%', left: '1%' },
      { size: 'medium', top: '58%', left: '3%' },
      { size: 'small', top: '62%', left: '2%' },
      { size: 'tiny', top: '66%', left: '4%' },
      { size: 'medium', top: '70%', left: '1%' },
      { size: 'small', top: '74%', left: '6%' },
      { size: 'tiny', top: '78%', left: '3%' },
      { size: 'medium', top: '82%', left: '5%' },
      { size: 'small', top: '86%', left: '2%' },
      { size: 'tiny', top: '90%', left: '7%' },
      { size: 'large', top: '56%', left: '9%' },
      { size: 'small', top: '60%', left: '11%' },
      { size: 'tiny', top: '64%', left: '8%' },
      { size: 'medium', top: '68%', left: '10%' },
      { size: 'small', top: '72%', left: '13%' },
      { size: 'tiny', top: '76%', left: '9%' },
      { size: 'medium', top: '80%', left: '12%' },
      { size: 'small', top: '84%', left: '10%' },
      // Right side - spread out vertically and horizontally
      { size: 'large', top: '54%', right: '1%' },
      { size: 'medium', top: '58%', right: '3%' },
      { size: 'small', top: '62%', right: '2%' },
      { size: 'tiny', top: '66%', right: '4%' },
      { size: 'medium', top: '70%', right: '1%' },
      { size: 'small', top: '74%', right: '6%' },
      { size: 'tiny', top: '78%', right: '3%' },
      { size: 'medium', top: '82%', right: '5%' },
      { size: 'small', top: '86%', right: '2%' },
      { size: 'tiny', top: '90%', right: '7%' },
      { size: 'large', top: '56%', right: '9%' },
      { size: 'small', top: '60%', right: '11%' },
      { size: 'tiny', top: '64%', right: '8%' },
      { size: 'medium', top: '68%', right: '10%' },
      { size: 'small', top: '72%', right: '13%' },
      { size: 'tiny', top: '76%', right: '9%' },
      { size: 'medium', top: '80%', right: '12%' },
      { size: 'small', top: '84%', right: '10%' },
      // Bottom area
      { size: 'large', top: '88%', left: '5%' },
      { size: 'medium', top: '90%', right: '8%' },
      { size: 'small', top: '92%', left: '10%' },
      { size: 'tiny', top: '94%', right: '10%' },
      { size: 'medium', top: '91%', left: '50%', transform: 'translateX(-50%)' },
      // Center area (behind container) - between 40% and 75% - spread out
      { size: 'small', top: '43%', left: '20%' },
      { size: 'tiny', top: '47%', right: '20%' },
      { size: 'small', top: '51%', left: '25%' },
      { size: 'tiny', top: '55%', right: '25%' },
      { size: 'medium', top: '59%', left: '30%' },
      { size: 'small', top: '63%', right: '30%' },
      { size: 'tiny', top: '67%', left: '35%' },
      { size: 'small', top: '71%', right: '35%' },
      { size: 'tiny', top: '45%', left: '40%' },
      { size: 'small', top: '49%', right: '40%' },
      { size: 'medium', top: '53%', left: '45%' },
      { size: 'tiny', top: '57%', right: '45%' },
      { size: 'small', top: '61%', left: '50%' },
      { size: 'tiny', top: '65%', right: '50%' },
      { size: 'medium', top: '69%', left: '55%' },
      { size: 'small', top: '73%', right: '55%' }
    ];

    // Prompt positions - many positions, all below container top (starting from 30% to avoid container)
    // Positions are spread out to avoid overlap
    const promptPositions = [
      // Top area (below container top - starting from 30%) - spread out
      { top: '30%', left: '2%' },
      { top: '32%', right: '2%' },
      { top: '34%', left: '5%' },
      { top: '36%', right: '5%' },
      { top: '38%', left: '8%' },
      { top: '40%', right: '8%' },
      { top: '42%', left: '11%' },
      { top: '44%', right: '11%' },
      { top: '46%', left: '14%' },
      { top: '48%', right: '14%' },
      { top: '50%', left: '17%' },
      { top: '52%', right: '17%' },
      // Left side - spread out vertically and horizontally
      { top: '54%', left: '1%' },
      { top: '58%', left: '3%' },
      { top: '62%', left: '2%' },
      { top: '66%', left: '4%' },
      { top: '70%', left: '1%' },
      { top: '74%', left: '6%' },
      { top: '78%', left: '3%' },
      { top: '82%', left: '5%' },
      { top: '86%', left: '2%' },
      { top: '90%', left: '7%' },
      { top: '56%', left: '9%' },
      { top: '60%', left: '11%' },
      { top: '64%', left: '8%' },
      { top: '68%', left: '10%' },
      { top: '72%', left: '13%' },
      { top: '76%', left: '9%' },
      { top: '80%', left: '12%' },
      { top: '84%', left: '10%' },
      // Right side - spread out vertically and horizontally
      { top: '54%', right: '1%' },
      { top: '58%', right: '3%' },
      { top: '62%', right: '2%' },
      { top: '66%', right: '4%' },
      { top: '70%', right: '1%' },
      { top: '74%', right: '6%' },
      { top: '78%', right: '3%' },
      { top: '82%', right: '5%' },
      { top: '86%', right: '2%' },
      { top: '90%', right: '7%' },
      { top: '56%', right: '9%' },
      { top: '60%', right: '11%' },
      { top: '64%', right: '8%' },
      { top: '68%', right: '10%' },
      { top: '72%', right: '13%' },
      { top: '76%', right: '9%' },
      { top: '80%', right: '12%' },
      { top: '84%', right: '10%' },
      // Bottom area
      { top: '86%', left: '8%' },
      { top: '88%', right: '10%' },
      { top: '90%', left: '12%' },
      { top: '92%', right: '12%' },
      { top: '94%', left: '10%' },
      // Center area (behind container) - between 40% and 75% - spread out
      { top: '45%', left: '20%' },
      { top: '49%', right: '20%' },
      { top: '53%', left: '25%' },
      { top: '57%', right: '25%' },
      { top: '61%', left: '30%' },
      { top: '65%', right: '30%' },
      { top: '69%', left: '35%' },
      { top: '73%', right: '35%' },
      { top: '47%', left: '40%' },
      { top: '51%', right: '40%' },
      { top: '55%', left: '45%' },
      { top: '59%', right: '45%' },
      { top: '63%', left: '50%' },
      { top: '67%', right: '50%' },
      { top: '71%', left: '55%' },
      { top: '75%', right: '55%' }
    ];

    let creditCounter = 0;
    let activeCredits = [];
    let activePrompts = [];

    // Create a credit counter element
    function createCreditCounter(position, amount) {
      const credit = document.createElement('div');
      credit.className = `credit-counter ${position.size}`;
      credit.style.top = position.top;
      credit.style.left = position.left || 'auto';
      credit.style.right = position.right || 'auto';
      if (position.transform) {
        credit.style.transform = position.transform;
      }
      credit.innerHTML = `
        <div class="credit-icon">$</div>
        <div class="credit-amount">${amount}</div>
      `;
      return credit;
    }

    // Create a prompt element
    function createPrompt(position, text) {
      const promptContainer = document.createElement('div');
      promptContainer.className = 'prompt-text-container';
      promptContainer.style.top = position.top;
      promptContainer.style.left = position.left || 'auto';
      promptContainer.style.right = position.right || 'auto';
      promptContainer.style.position = 'absolute';
      promptContainer.style.width = 'auto';
      promptContainer.style.minWidth = '250px';
      promptContainer.style.maxWidth = 'none';
      promptContainer.style.whiteSpace = 'nowrap';
      
      const prompt = document.createElement('div');
      prompt.className = 'prompt-text';
      prompt.style.whiteSpace = 'nowrap';
      prompt.innerHTML = `<span class="prompt-label">prompt:</span> ${text}`;
      promptContainer.appendChild(prompt);
      
      return promptContainer;
    }

    // Show a new credit counter
    function showNewCredit() {
      const position = creditPositions[Math.floor(Math.random() * creditPositions.length)];
      const amount = Math.floor(Math.random() * 3) + 1; // 1-3 dollars
      const credit = createCreditCounter(position, amount);
      container.appendChild(credit);
      
      // Trigger fade in
      setTimeout(function() {
        credit.classList.add('visible');
      }, 10);
      
      activeCredits.push(credit);
      
      // Fade out after 2-3 seconds
      const fadeOutDelay = 2000 + Math.random() * 1000;
      setTimeout(function() {
        credit.classList.remove('visible');
        credit.classList.add('fading-out');
        setTimeout(function() {
          if (credit.parentNode) {
            credit.parentNode.removeChild(credit);
          }
          activeCredits = activeCredits.filter(function(c) { return c !== credit; });
        }, 1000);
      }, fadeOutDelay);
    }

    // Show a new prompt
    function showNewPrompt() {
      const position = promptPositions[Math.floor(Math.random() * promptPositions.length)];
      const text = prompts[Math.floor(Math.random() * prompts.length)];
      const promptContainer = createPrompt(position, text);
      container.appendChild(promptContainer);
      
      const prompt = promptContainer.querySelector('.prompt-text');
      
      // Trigger fade in
      setTimeout(function() {
        prompt.classList.add('visible');
      }, 10);
      
      activePrompts.push(promptContainer);
      
      // Fade out after 2.5-3.5 seconds
      const fadeOutDelay = 2500 + Math.random() * 1000;
      setTimeout(function() {
        prompt.classList.remove('visible');
        prompt.classList.add('fading-out');
        setTimeout(function() {
          if (promptContainer.parentNode) {
            promptContainer.parentNode.removeChild(promptContainer);
          }
          activePrompts = activePrompts.filter(function(p) { return p !== promptContainer; });
        }, 1000);
      }, fadeOutDelay);
    }

    // Start showing credits and prompts continuously
    function startAnimation() {
      // Show initial credits and prompts immediately - many more
      for (let i = 0; i < 8; i++) {
        setTimeout(function() {
          showNewCredit();
        }, i * 200);
      }
      
      for (let i = 0; i < 6; i++) {
        setTimeout(function() {
          showNewPrompt();
        }, i * 250);
      }

      // Continue showing new credits every 0.5-1 second (more frequent)
      function continueCredits() {
        showNewCredit();
        setTimeout(continueCredits, 500 + Math.random() * 500);
      }
      setTimeout(continueCredits, 500);

      // Continue showing new prompts every 0.6-1.2 seconds (more frequent)
      function continuePrompts() {
        showNewPrompt();
        setTimeout(continuePrompts, 600 + Math.random() * 600);
      }
      setTimeout(continuePrompts, 600);
    }

    // Start animation when container is visible
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          startAnimation();
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(container);
  }

  // Tab Preview - Removed (replaced with spec cards)

  // Logo Jump Animation - makes logos jump one by one
  function initLogoJumpAnimation() {
    const logoItems = document.querySelectorAll('.logo-placeholder');
    if (logoItems.length === 0) return;

    let currentIndex = 0;

    function jumpNextLogo() {
      // Remove jumping class from all logos
      logoItems.forEach(function(logo) {
        logo.classList.remove('jumping');
      });

      // Add jumping class to current logo
      logoItems[currentIndex].classList.add('jumping');

      // Move to next logo
      currentIndex = (currentIndex + 1) % logoItems.length;

      // Schedule next jump (random interval between 1.5-3 seconds)
      setTimeout(jumpNextLogo, 1500 + Math.random() * 1500);
    }

    // Start animation after a short delay
    setTimeout(jumpNextLogo, 1000);
  }

})();

