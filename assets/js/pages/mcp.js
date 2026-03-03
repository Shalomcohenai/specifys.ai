/**
 * MCP page: fade-in on scroll, rotating example commands (real use cases), interactive command buttons with auto-rotate.
 */
(function () {
  'use strict';

  var ROTATE_EXAMPLE_MS = 5800;
  var ROTATE_CMD_MS = 4500;

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  var exampleData = [
    '@specifys list_my_specs so I can pick which one to work on.',
    '@specifys get_spec and get_spec_design - build the site from my spec architecture and style it with the design spec.',
    '@specifys get_spec_overview get_spec_technical - use my spec overview and technical section to implement the auth flow.',
    '@specifys update_spec_overview with the new feature we just agreed on.',
    '@specifys get_spec_prompts - what prompt templates does Specifys use for the technical section?',
    '@specifys get_spec so you have full context for this project.',
    '@specifys update_spec_market - change the market section to include the new competitor analysis.',
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
    var lineEl = document.getElementById('mcp-example-line');
    if (!card || !lineEl) return;

    var index = 0;
    function next() {
      card.classList.add('fade-swap');
      setTimeout(function () {
        var item = exampleData[index % exampleData.length];
        var escaped = escapeHtml(item);
        lineEl.innerHTML = escaped.replace(/@specifys/g, '<span class="mcp-example-prompt__at">@specifys</span>');
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

  function initFaqAccordion() {
    var faqItems = document.querySelectorAll('.mcp-faq .faq-item');
    faqItems.forEach(function (item, index) {
      item.addEventListener('click', function () {
        var question = item.querySelector('.faq-question');
        var answer = item.querySelector('.faq-answer');
        if (question && answer) {
          question.classList.toggle('open');
          answer.classList.toggle('open');
        }
      });
    });
  }

  function trackMcpPageView() {
    var auth = window.auth;
    if (!auth || !auth.currentUser) return;
    var apiBaseUrl = (typeof window.getApiBaseUrl === 'function' && window.getApiBaseUrl()) || window.API_BASE_URL || window.BACKEND_URL || '';
    if (!apiBaseUrl) return;
    auth.currentUser.getIdToken().then(function (token) {
      fetch(apiBaseUrl + '/api/users/me/mcp-event', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mcp_page_view' })
      }).catch(function () {});
    }).catch(function () {});
  }

  ready(function () {
    initFadeIn();
    initRotatingExamples();
    initCommandButtons();
    initFaqAccordion();
    trackMcpPageView();
  });
})();
