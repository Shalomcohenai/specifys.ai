/**
 * Spec Viewer first-visit spotlight tour
 * Triggered once after create redirect (?welcome=1), skipped thereafter via localStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'specViewerTourSeen';
  var PENDING_KEY = 'specViewerTourPending';
  var ROOT_ID = 'spec-viewer-tour';
  var PAD = 6;

  var active = false;
  var started = false;
  var currentIndex = 0;
  var steps = [];
  var rootEl = null;
  var overlayEl = null;
  var spotlightEl = null;
  var cardEl = null;
  var titleEl = null;
  var bodyEl = null;
  var progressEl = null;
  var backBtn = null;
  var nextBtn = null;
  var startTimer = null;
  var completeCallbacks = [];

  function hasSeenTour() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) { /* ignore */ }
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) { /* ignore */ }
  }

  function hasPendingTour() {
    if (hasSeenTour()) return false;
    try {
      return sessionStorage.getItem(PENDING_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function consumeWelcomeFlag() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      try {
        sessionStorage.setItem(PENDING_KEY, '1');
      } catch (e) { /* ignore */ }
      params.delete('welcome');
      var qs = params.toString();
      var nextUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState({}, '', nextUrl);
    }

    return hasPendingTour();
  }

  function isElementVisible(el) {
    if (!el || el.hidden || el.classList.contains('hidden')) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function buildSteps() {
    var list = [
      {
        id: 'stages',
        selector: '#specNavTop',
        title: 'Your specification stages',
        body:
          'The top bar is your map: <strong>Overview</strong>, then Technical, Market Research, Design &amp; Branding, Architecture, Prompts, and GEO &amp; SEO. Advanced stages stay locked until you continue from Overview.'
      },
      {
        id: 'approve',
        selector: '#approval-container',
        fallbackSelector: '#approveBtn',
        title: 'Continue to unlock advanced specs',
        body:
          'When Overview looks right, press <strong>Continue to Technical + Prompts</strong>. That queues Technical, Market, Design, Architecture, GEO &amp; SEO, and Prompts in the background.'
      },
      {
        id: 'tools',
        selector: '#specNavBottom',
        title: 'Tools under the page',
        body:
          '<strong>AI Chat</strong> unlocks after you continue. <strong>Brain Dump</strong> unlocks after the full pipeline. Use <strong>Export &amp; Integration</strong> and <strong>MCP</strong> to take the spec into your editor.'
      },
      {
        id: 'export-mcp',
        selector: '#specNavBottom',
        highlightSelectors: ['#exportTab', '#sideMenuMcpBtn'],
        title: 'Export &amp; MCP',
        body:
          'After Prompts are ready, export for Cursor / Windsurf or connect <strong>MCP</strong> so your AI coding tools can read this spec directly.'
      },
      {
        id: 'summary',
        selector: null,
        title: 'You are ready',
        body:
          'Read the Overview, hit Continue, then follow tabs as they light up with <strong>New!</strong> When Prompts land, copy them or connect MCP and start building.'
      }
    ];

    return list.filter(function (step) {
      if (step.id === 'approve') {
        var approval = document.getElementById('approval-container');
        var approveBtn = document.getElementById('approveBtn');
        return isElementVisible(approval) || isElementVisible(approveBtn);
      }
      if (!step.selector) return true;
      return !!document.querySelector(step.selector);
    });
  }

  function ensureDom() {
    rootEl = document.getElementById(ROOT_ID);
    if (rootEl) {
      overlayEl = rootEl.querySelector('[data-sv-tour-overlay]');
      spotlightEl = rootEl.querySelector('[data-sv-tour-spotlight]');
      cardEl = rootEl.querySelector('.sv-tour-card');
      titleEl = rootEl.querySelector('#sv-tour-title');
      bodyEl = rootEl.querySelector('#sv-tour-body');
      progressEl = rootEl.querySelector('#sv-tour-progress');
      backBtn = rootEl.querySelector('#sv-tour-back');
      nextBtn = rootEl.querySelector('#sv-tour-next');
      return;
    }

    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    rootEl.className = 'sv-tour-root';
    rootEl.hidden = true;
    rootEl.innerHTML =
      '<div class="sv-tour-overlay" data-sv-tour-overlay aria-hidden="true"></div>' +
      '<div class="sv-tour-spotlight" data-sv-tour-spotlight hidden aria-hidden="true"></div>' +
      '<div class="sv-tour-card" role="dialog" aria-modal="true" aria-labelledby="sv-tour-title" aria-describedby="sv-tour-body">' +
      '  <div class="sv-tour-card-header">' +
      '    <span class="sv-tour-step-label" id="sv-tour-step-label">Guide</span>' +
      '    <button type="button" class="sv-tour-skip" id="sv-tour-skip">Skip</button>' +
      '  </div>' +
      '  <h2 class="sv-tour-title" id="sv-tour-title"></h2>' +
      '  <p class="sv-tour-body" id="sv-tour-body"></p>' +
      '  <div class="sv-tour-footer">' +
      '    <span class="sv-tour-progress" id="sv-tour-progress"></span>' +
      '    <div class="sv-tour-actions">' +
      '      <button type="button" class="sv-tour-btn" id="sv-tour-back">Back</button>' +
      '      <button type="button" class="sv-tour-btn sv-tour-btn--primary" id="sv-tour-next">Next</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(rootEl);

    overlayEl = rootEl.querySelector('[data-sv-tour-overlay]');
    spotlightEl = rootEl.querySelector('[data-sv-tour-spotlight]');
    cardEl = rootEl.querySelector('.sv-tour-card');
    titleEl = rootEl.querySelector('#sv-tour-title');
    bodyEl = rootEl.querySelector('#sv-tour-body');
    progressEl = rootEl.querySelector('#sv-tour-progress');
    backBtn = rootEl.querySelector('#sv-tour-back');
    nextBtn = rootEl.querySelector('#sv-tour-next');

    rootEl.querySelector('#sv-tour-skip').addEventListener('click', function () {
      finish('skip');
    });
    backBtn.addEventListener('click', function () {
      goTo(currentIndex - 1);
    });
    nextBtn.addEventListener('click', function () {
      if (currentIndex >= steps.length - 1) {
        finish('done');
      } else {
        goTo(currentIndex + 1);
      }
    });
  }

  function unionRect(selectors) {
    var left = Infinity;
    var top = Infinity;
    var right = -Infinity;
    var bottom = -Infinity;
    var found = false;

    selectors.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || !isElementVisible(el)) return;
      var r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      found = true;
    });

    if (!found) return null;
    return { left: left, top: top, width: right - left, height: bottom - top };
  }

  function resolveTarget(step) {
    if (!step) return null;
    if (step.highlightSelectors && step.highlightSelectors.length) {
      var combined = unionRect(step.highlightSelectors);
      if (combined) {
        return { rect: combined, el: document.querySelector(step.selector) };
      }
    }
    if (step.selector) {
      var el = document.querySelector(step.selector);
      if (el && isElementVisible(el)) {
        return { rect: el.getBoundingClientRect(), el: el };
      }
    }
    if (step.fallbackSelector) {
      var fallback = document.querySelector(step.fallbackSelector);
      if (fallback && isElementVisible(fallback)) {
        return { rect: fallback.getBoundingClientRect(), el: fallback };
      }
    }
    return null;
  }

  function updateSpotlight(target) {
    if (!spotlightEl || !overlayEl) return;

    if (!target || !target.rect) {
      spotlightEl.hidden = true;
      overlayEl.hidden = false;
      return;
    }

    var r = target.rect;
    overlayEl.hidden = true;
    spotlightEl.hidden = false;
    spotlightEl.style.left = Math.max(0, r.left - PAD) + 'px';
    spotlightEl.style.top = Math.max(0, r.top - PAD) + 'px';
    spotlightEl.style.width = Math.max(0, r.width + PAD * 2) + 'px';
    spotlightEl.style.height = Math.max(0, r.height + PAD * 2) + 'px';
  }

  function positionCard(target) {
    if (!cardEl) return;

    var isMobile = window.matchMedia('(max-width: 720px)').matches;
    cardEl.classList.remove('sv-tour-card--centered');
    cardEl.style.left = '';
    cardEl.style.top = '';
    cardEl.style.right = '';
    cardEl.style.bottom = '';
    cardEl.style.transform = '';

    if (!target || !target.rect) {
      cardEl.classList.add('sv-tour-card--centered');
      return;
    }

    if (isMobile) {
      cardEl.style.left = '16px';
      cardEl.style.right = '16px';
      cardEl.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
      cardEl.style.top = 'auto';
      return;
    }

    var rect = target.rect;
    var cardWidth = Math.min(360, window.innerWidth - 32);
    var gap = 14;
    var left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - cardWidth / 2),
      window.innerWidth - cardWidth - 16
    );

    var estimatedHeight = cardEl.offsetHeight || 220;
    var topBelow = rect.bottom + gap;
    var topAbove = rect.top - estimatedHeight - gap;
    var top;
    if (topBelow + estimatedHeight < window.innerHeight - 16) {
      top = topBelow;
    } else if (topAbove > 16) {
      top = topAbove;
    } else {
      top = Math.max(16, Math.min(topBelow, window.innerHeight - estimatedHeight - 16));
    }

    var el = target.el;
    if (el && (el.id === 'specNavBottom' || (el.closest && el.closest('#specNavBottom')))) {
      top = Math.max(16, rect.top - estimatedHeight - gap);
    }
    if (el && (el.id === 'specNavTop' || (el.closest && el.closest('#specNavTop')))) {
      top = Math.min(window.innerHeight - estimatedHeight - 16, rect.bottom + gap);
    }

    cardEl.style.left = left + 'px';
    cardEl.style.top = top + 'px';
  }

  function renderStep() {
    var step = steps[currentIndex];
    if (!step) return;

    var target = resolveTarget(step);
    if (target && target.el) {
      try {
        target.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } catch (e) {
        target.el.scrollIntoView(false);
      }
      // Re-measure after scroll
      target = resolveTarget(step);
    }

    updateSpotlight(target);

    titleEl.textContent = step.title;
    bodyEl.innerHTML = step.body;
    progressEl.textContent = currentIndex + 1 + ' / ' + steps.length;
    backBtn.disabled = currentIndex === 0;
    nextBtn.textContent = currentIndex >= steps.length - 1 ? 'Done' : 'Next';

    requestAnimationFrame(function () {
      // Refresh rect after layout
      var refreshed = resolveTarget(step);
      updateSpotlight(refreshed);
      positionCard(refreshed);
      if (nextBtn) nextBtn.focus();
    });
  }

  function goTo(index) {
    if (index < 0 || index >= steps.length) return;
    currentIndex = index;
    renderStep();
  }

  function onKeyDown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('escape');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (currentIndex >= steps.length - 1) finish('done');
      else goTo(currentIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(currentIndex - 1);
    }
  }

  function onDocumentClick(event) {
    if (!active) return;
    if (event.target.closest && event.target.closest('#approveBtn')) {
      finish('approve');
    }
  }

  function onTabChange(event) {
    if (!active) return;
    var tabName = event && event.detail && event.detail.tabName;
    if (tabName && tabName !== 'overview') {
      finish('tab');
    }
  }

  function onViewportChange() {
    if (!active) return;
    var step = steps[currentIndex];
    var target = resolveTarget(step);
    updateSpotlight(target);
    positionCard(target);
  }

  function flushCompleteCallbacks() {
    var cbs = completeCallbacks.slice();
    completeCallbacks = [];
    cbs.forEach(function (cb) {
      try {
        cb();
      } catch (e) { /* ignore */ }
    });
  }

  function finish(/* reason */) {
    if (!active && !started) {
      markSeen();
      flushCompleteCallbacks();
      return;
    }
    active = false;
    if (rootEl) rootEl.hidden = true;
    if (spotlightEl) spotlightEl.hidden = true;
    if (overlayEl) overlayEl.hidden = false;
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', onDocumentClick, true);
    window.removeEventListener('specViewerTabChange', onTabChange);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
    markSeen();
    flushCompleteCallbacks();
  }

  function startTour() {
    if (active || hasSeenTour()) return false;

    steps = buildSteps();
    if (!steps.length) {
      markSeen();
      flushCompleteCallbacks();
      return false;
    }

    ensureDom();
    active = true;
    started = true;
    currentIndex = 0;
    rootEl.hidden = false;

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('specViewerTabChange', onTabChange);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    renderStep();
    return true;
  }

  /**
   * Entry point from displaySpec. Safe to call multiple times.
   * @param {{ delayMs?: number }} [options]
   */
  function maybeStartSpecViewerTour(options) {
    consumeWelcomeFlag();

    if (hasSeenTour()) {
      try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
      return false;
    }
    if (started) return false;

    if (!hasPendingTour()) return false;

    var delayMs = options && typeof options.delayMs === 'number' ? options.delayMs : 700;

    if (startTimer) {
      clearTimeout(startTimer);
      startTimer = null;
    }

    startTimer = setTimeout(function () {
      startTimer = null;
      if (hasSeenTour() || active) return;
      var content = document.getElementById('content');
      if (content && content.classList.contains('hidden')) {
        maybeStartSpecViewerTour({ delayMs: 500 });
        return;
      }
      startTour();
    }, delayMs);

    return true;
  }

  function isActive() {
    return active;
  }

  function isPending() {
    return hasPendingTour() && !hasSeenTour();
  }

  function onComplete(cb) {
    if (typeof cb !== 'function') return;
    if (active || (isPending() && !hasSeenTour())) {
      completeCallbacks.push(cb);
      return;
    }
    cb();
  }

  consumeWelcomeFlag();

  window.maybeStartSpecViewerTour = maybeStartSpecViewerTour;
  window.specViewerTour = {
    maybeStart: maybeStartSpecViewerTour,
    isActive: isActive,
    isPending: isPending,
    onComplete: onComplete,
    finish: function () { finish('api'); }
  };
})();
