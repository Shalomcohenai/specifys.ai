// Cursor & Windsurf Integration Page JavaScript

(function() {
  'use strict';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Show all fade-in elements immediately if they're in viewport
    setTimeout(function() {
      const fadeElements = document.querySelectorAll('.fade-in');
      fadeElements.forEach(function(element) {
        const rect = element.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight + 200 && rect.bottom > -200;
        if (isInViewport) {
          element.classList.add('visible');
        }
      });
    }, 100);
    
    initScrollAnimations();
    initFAQ();
    initFileTooltips();
  });

  /**
   * Initialize scroll-triggered fade-in animations
   */
  function initScrollAnimations() {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.01
    };

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    // Observe all fade-in elements that aren't already visible
    const fadeElements = document.querySelectorAll('.fade-in:not(.visible)');
    fadeElements.forEach(function(element) {
      observer.observe(element);
    });

    // Staggered animation for feature cards and benefit cards
    const cardObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry, index) {
        if (entry.isIntersecting) {
          setTimeout(function() {
            entry.target.classList.add('visible');
          }, index * 100); // 100ms delay between each card
        }
      });
    }, observerOptions);

    const featureCards = document.querySelectorAll('.feature-card, .benefit-card');
    featureCards.forEach(function(card) {
      cardObserver.observe(card);
    });
  }

  /**
   * Initialize FAQ - no accordion needed, all cards are always visible
   */
  function initFAQ() {
    // FAQ cards are always visible, no interaction needed
    // This function is kept for consistency but does nothing
  }

  /**
   * Initialize file tooltips on hover
   */
  function initFileTooltips() {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(function(item) {
      item.addEventListener('mouseenter', function() {
        // Add active class for styling
        this.classList.add('active');
      });
      
      item.addEventListener('mouseleave', function() {
        // Remove active class
        this.classList.remove('active');
      });
    });

    // Handle mobile - show tooltip on click
    if (window.innerWidth <= 768) {
      fileItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.preventDefault();
          const tooltip = this.querySelector('.file-tooltip');
          
          // Close all other tooltips
          document.querySelectorAll('.file-tooltip').forEach(function(t) {
            if (t !== tooltip) {
              t.style.display = 'none';
            }
          });
          
          // Toggle current tooltip
          if (tooltip) {
            const isVisible = tooltip.style.display === 'block';
            tooltip.style.display = isVisible ? 'none' : 'block';
            
            // Auto-hide after 5 seconds
            if (!isVisible) {
              setTimeout(function() {
                tooltip.style.display = 'none';
              }, 5000);
            }
          }
        });
      });
    }
  }

  /**
   * Smooth scroll to section
   */
  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  // Expose functions globally if needed
  window.scrollToSection = scrollToSection;
})();

