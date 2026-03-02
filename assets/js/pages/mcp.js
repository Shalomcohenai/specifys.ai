/**
 * MCP page: fade-in on scroll, rotating example commands (real use cases), interactive command buttons with auto-rotate.
 */
(function () {
  'use strict';

  var ROTATE_EXAMPLE_MS = 5800;
  var ROTATE_CMD_MS = 4500;

  var exampleData = [
    { quote: 'List my specs so I can pick which one to work on.', tools: 'list_my_specs' },
    { quote: 'Build the site according to the architecture in my spec, then style it using the design spec.', tools: 'get_spec, get_spec_design' },
    { quote: 'Use my spec overview and technical section to implement the auth flow.', tools: 'get_spec_overview, get_spec_technical' },
    { quote: 'Update the overview with the new feature we just agreed on.', tools: 'update_spec_overview' },
    { quote: 'What prompt templates does Specifys use for the technical section?', tools: 'get_spec_prompts' },
    { quote: 'Show me the full spec for this project so you have full context.', tools: 'get_spec' },
    { quote: 'Change the market section to include the new competitor analysis.', tools: 'update_spec_market' },
  ];

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function initFadeIn() {
    var observerOptions = {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.01
    };
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    var fadeEls = document.querySelectorAll('.mcp-page .fade-in');
    fadeEls.forEach(function (el) {
      observer.observe(el);
    });

    setTimeout(function () {
      var hero = document.querySelector('.mcp-hero');
      if (hero) {
        var inHero = hero.querySelectorAll('.fade-in');
        inHero.forEach(function (el) {
          var rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight + 100) {
            el.classList.add('visible');
          }
        });
      }
    }, 150);
  }

  function initRotatingExamples() {
    var card = document.getElementById('mcp-example-card');
    var quoteEl = document.getElementById('mcp-example-quote');
    var toolsEl = document.getElementById('mcp-example-tools');
    if (!card || !quoteEl || !toolsEl) return;

    var index = 0;
    function next() {
      card.classList.add('fade-swap');
      setTimeout(function () {
        var item = exampleData[index % exampleData.length];
        quoteEl.textContent = item.quote;
        toolsEl.textContent = 'Uses: ' + item.tools;
        index += 1;
        card.classList.remove('fade-swap');
      }, 400);
    }

    setInterval(next, ROTATE_EXAMPLE_MS);
  }

  function initCommandButtons() {
    var buttons = document.querySelectorAll('.mcp-cmd-btn');
    var explanationEl = document.getElementById('mcp-cmd-explanation');
    if (!buttons.length || !explanationEl) return;

    var currentIndex = 0;
    var autoTimer = null;

    function setActive(i) {
      currentIndex = (i + buttons.length) % buttons.length;
      var btn = buttons[currentIndex];
      buttons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      var desc = btn.getAttribute('data-desc');
      if (desc) {
        explanationEl.textContent = desc;
      }
    }

    function startAutoRotate() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        setActive(currentIndex + 1);
      }, ROTATE_CMD_MS);
    }

    function stopAutoRotate() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        stopAutoRotate();
        setActive(i);
        startAutoRotate();
      });
      btn.addEventListener('focus', function () {
        stopAutoRotate();
        setActive(i);
      });
      btn.addEventListener('blur', function () {
        startAutoRotate();
      });
      btn.addEventListener('mouseenter', function () {
        stopAutoRotate();
        setActive(i);
      });
      btn.addEventListener('mouseleave', function () {
        startAutoRotate();
      });
    });

    setActive(0);
    startAutoRotate();
  }

  ready(function () {
    initFadeIn();
    initRotatingExamples();
    initCommandButtons();
  });
})();
