/**
 * Hero Demo Window Scroll Handler
 * Manages three-phase scroll experience: embedded growth, full-screen interaction, exit
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    phaseAEnd: 300,
    phaseBEnd: 800,
    initialScale: 0.3,
    finalScale: 1.0
  };

  let demoWindow = null;
  let heroSection = null;
  let currentPhase = 'initial';
  let rafId = null;

  function init() {
    demoWindow = document.getElementById('heroDemoWindow');
    heroSection = document.querySelector('.hero-section');

    if (!demoWindow || !heroSection) {
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupScrollHandler);
    } else {
      setupScrollHandler();
    }
  }

  function setupScrollHandler() {
    let ticking = false;

    function handleScroll() {
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          updateDemoState();
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateDemoState();
  }

  function updateDemoState() {
    if (!demoWindow || !heroSection) {
      return;
    }
    
    if (!document.body.contains(demoWindow)) {
      return;
    }

    const scrollY = window.scrollY || window.pageYOffset;
    const heroTop = heroSection.offsetTop;
    const heroHeight = heroSection.offsetHeight;
    const relativeScroll = scrollY - (heroTop + heroHeight * 0.5);

    let newPhase = 'initial';
    let scale = CONFIG.initialScale;
    let opacity = 0;

    if (relativeScroll <= 0) {
      newPhase = 'initial';
      scale = CONFIG.initialScale;
      opacity = 0;
    } else if (relativeScroll > 0 && relativeScroll <= CONFIG.phaseAEnd) {
      newPhase = 'phase-a';
      const progress = Math.min(relativeScroll / CONFIG.phaseAEnd, 1);
      scale = CONFIG.initialScale + (CONFIG.finalScale - CONFIG.initialScale) * progress;
      opacity = progress;
    } else if (relativeScroll > CONFIG.phaseAEnd && relativeScroll <= CONFIG.phaseBEnd) {
      newPhase = 'phase-b';
      scale = CONFIG.finalScale;
      opacity = 1;
    } else {
      newPhase = 'phase-c';
      scale = CONFIG.finalScale;
      const exitProgress = Math.min((relativeScroll - CONFIG.phaseBEnd) / 200, 1);
      opacity = 1 - exitProgress;
    }

    if (currentPhase !== newPhase) {
      demoWindow.classList.remove('hero-demo-window--phase-a', 'hero-demo-window--phase-b', 'hero-demo-window--phase-c');
      if (newPhase !== 'initial') {
        demoWindow.classList.add(`hero-demo-window--${newPhase}`);
      }
      currentPhase = newPhase;
    }

    if (newPhase === 'phase-a') {
      demoWindow.style.transform = `scale(${scale})`;
      demoWindow.style.opacity = opacity;
    } else if (newPhase === 'initial') {
      demoWindow.style.transform = `scale(${CONFIG.initialScale})`;
      demoWindow.style.opacity = 0;
    } else {
      demoWindow.style.transform = '';
      demoWindow.style.opacity = '';
    }
  }

  function setupButtonInteractions() {
    if (!demoWindow) return;

    const actionButtons = demoWindow.querySelectorAll('.demo-action-btn');
    
    actionButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('clicked');
        setTimeout(() => {
          this.classList.remove('clicked');
        }, 300);
      });

      button.addEventListener('mousedown', function(e) {
        e.preventDefault();
      });
    });
  }

  init();
  setTimeout(setupButtonInteractions, 100);

  window.addEventListener('beforeunload', function() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  });

})();
