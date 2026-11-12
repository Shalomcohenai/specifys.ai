/**
 * Loading, empty, and error copy for spec generation and the workspace.
 * Classic script (window.SpecFlowFeedback). Copy is fixed so raw server
 * errors are not rendered into the page.
 */
(function (root) {
  var STAGES = [
    { id: 'brief', label: 'Saving your brief' },
    { id: 'start', label: 'Starting generation' },
    { id: 'open', label: 'Opening your spec' }
  ];

  var progressHost = null;
  var progressIndex = 0;
  var progressTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function codeFrom(input) {
    if (!input) return 'generic';
    if (typeof input === 'string') return input;
    if (input.code) return String(input.code);
    var status = input.status;
    var message = String(input.message || '').toLowerCase();
    if (status === 401 || /auth|sign in|log in|unauthenticated/.test(message)) return 'auth';
    if (status === 403 || /credit|paywall|upgrade|subscribe/.test(message)) return 'credits';
    if (/failed to fetch|network|timeout|offline|econnrefused/.test(message)) return 'network';
    if (/save|firestore|permission-denied/.test(message)) return 'save';
    if (/unavailable|could not generate/.test(message)) return 'unavailable';
    return 'generic';
  }

  function describeGenerationError(input) {
    var code = codeFrom(input);
    if (code === 'auth') {
      return {
        title: 'Sign in to generate',
        message: 'Your brief stays on this page. A spec is saved to your account, so generation starts after sign-in.',
        nextStep: 'Sign in, then come back — choose Generate again.',
        actions: [
          { label: 'Sign in', href: '/pages/auth.html?next=' + encodeURIComponent('/?resumeBrief=1'), primary: true },
          { label: 'Keep editing', action: 'dismiss' }
        ]
      };
    }
    if (code === 'credits') {
      return {
        title: 'No specification credits left',
        message: 'This account needs a credit before another spec can be generated.',
        nextStep: 'Review plans, or open a spec you already created.',
        actions: [
          { label: 'View plans', href: '/pages/pricing.html', primary: true },
          { label: 'Open workspace', href: '/pages/profile.html' }
        ]
      };
    }
    if (code === 'network') {
      return {
        title: 'Could not reach Specifys',
        message: 'The request did not finish. Your brief is still in the chat.',
        nextStep: 'Check your connection, then try Generate again.',
        actions: [{ label: 'Try again', action: 'retry', primary: true }]
      };
    }
    if (code === 'save') {
      return {
        title: 'Could not save the specification',
        message: 'Generation did not start because the spec could not be saved.',
        nextStep: 'Try again. If it keeps failing, open your workspace and check whether a draft appeared.',
        actions: [
          { label: 'Try again', action: 'retry', primary: true },
          { label: 'Open workspace', href: '/pages/profile.html' }
        ]
      };
    }
    if (code === 'unavailable') {
      return {
        title: 'Generation is not available',
        message: 'This page could not start the specification.',
        nextStep: 'Reload the homepage and try Generate again.',
        actions: [{ label: 'Reload homepage', href: '/', primary: true }]
      };
    }
    return {
      title: 'Specification did not start',
      message: 'Something went wrong before generation could begin.',
      nextStep: 'Try again. If the brief is thin, add who the product is for, then Generate.',
      actions: [{ label: 'Try again', action: 'retry', primary: true }]
    };
  }

  function describeLoadError(message) {
    var lower = String(message || '').toLowerCase();
    if (lower.indexOf('authenticated') !== -1 || lower.indexOf('sign in') !== -1 || lower.indexOf('log in') !== -1) {
      return {
        title: 'Sign in to open this spec',
        message: 'Specifications are saved to an account.',
        nextStep: 'Sign in, then open the spec from your workspace.',
        actions: [
          { label: 'Sign in', href: '/pages/auth.html?next=' + encodeURIComponent('/pages/profile.html'), primary: true },
          { label: 'Back home', href: '/' }
        ]
      };
    }
    if (lower.indexOf('permission') !== -1) {
      return {
        title: 'You can’t open this spec',
        message: 'It belongs to a different account.',
        nextStep: 'Sign in with the account that created it, or return to your workspace.',
        actions: [
          { label: 'Sign in', href: '/pages/auth.html?next=' + encodeURIComponent('/pages/profile.html'), primary: true },
          { label: 'Workspace', href: '/pages/profile.html' }
        ]
      };
    }
    if (lower.indexOf('no specification id') !== -1 || lower.indexOf('no spec') !== -1) {
      return {
        title: 'No specification selected',
        message: 'This link does not include a spec id.',
        nextStep: 'Open a spec from your workspace, or describe a new product on the homepage.',
        actions: [
          { label: 'Go to workspace', href: '/pages/profile.html', primary: true },
          { label: 'Create a spec', href: '/' }
        ]
      };
    }
    return {
      title: 'This spec didn’t load',
      message: 'We couldn’t read it just now. Nothing was deleted.',
      nextStep: 'Retry the load. If it keeps failing, open the spec again from your workspace.',
      actions: [
        { label: 'Try again', action: 'retry', primary: true },
        { label: 'Workspace', href: '/pages/profile.html' }
      ]
    };
  }

  function describeEmptyWorkspace(reason) {
    if (reason === 'error') {
      return {
        title: 'Workspace could not load',
        message: 'We couldn’t read your specifications just now.',
        nextStep: 'Retry the load. Specs you already generated are still saved.',
        actions: [
          { label: 'Try again', action: 'retry', primary: true },
          { label: 'Create a spec', href: '/' }
        ]
      };
    }
    return {
      title: 'No specifications yet',
      message: 'A spec is a PRD, technical plan, and prompts. Most are ready in a few minutes.',
      nextStep: 'Describe the product on the homepage, then choose Generate.',
      actions: [
        { label: 'Create your first spec', action: 'create', primary: true },
        { label: 'See an example', href: '/pages/demo-spec.html?example=relaydesk' }
      ]
    };
  }

  function describeStageError(stage) {
    var label = stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'This section';
    return {
      title: label + ' did not generate',
      message: 'The rest of the spec is still available.',
      nextStep: 'Use the Retry button in this section’s header. If it fails again, continue with the sections that are ready.',
      actions: []
    };
  }

  function renderActions(actions) {
    return (actions || []).map(function (action) {
      var cls = 'flow-state__btn' + (action.primary ? ' flow-state__btn--primary' : ' flow-state__btn--secondary');
      if (action.href) {
        return '<a class="' + cls + '" href="' + escapeHtml(action.href) + '">' + escapeHtml(action.label) + '</a>';
      }
      return '<button type="button" class="' + cls + '" data-flow-action="' + escapeHtml(action.action || 'dismiss') + '">' + escapeHtml(action.label) + '</button>';
    }).join('');
  }

  function renderNoticeHTML(model) {
    var notice = model || describeGenerationError('generic');
    var actions = renderActions(notice.actions);
    return (
      '<div class="flow-state" role="alert">' +
        '<h3 class="flow-state__title">' + escapeHtml(notice.title) + '</h3>' +
        '<p class="flow-state__message">' + escapeHtml(notice.message) + '</p>' +
        '<p class="flow-state__next"><span class="flow-state__next-label">Next:</span> ' + escapeHtml(notice.nextStep) + '</p>' +
        (actions ? '<div class="flow-state__actions">' + actions + '</div>' : '') +
      '</div>'
    );
  }

  function renderProgressHTML(activeIndex) {
    var index = typeof activeIndex === 'number' ? activeIndex : 0;
    var items = STAGES.map(function (stage, i) {
      var state = i < index ? 'done' : i === index ? 'current' : 'upcoming';
      var current = i === index ? ' aria-current="step"' : '';
      return '<li class="flow-progress__step is-' + state + '"' + current + '>' + escapeHtml(stage.label) + '</li>';
    }).join('');
    var pct = Math.round(((index + 1) / STAGES.length) * 100);
    var currentLabel = (STAGES[index] && STAGES[index].label) || STAGES[0].label;
    return (
      '<div class="flow-progress" role="status" aria-live="polite">' +
        '<p class="flow-progress__title">Creating your specification</p>' +
        '<p class="flow-progress__current">' + escapeHtml(currentLabel) + '</p>' +
        '<ol class="flow-progress__steps">' + items + '</ol>' +
        '<div class="flow-progress__track" aria-hidden="true"><span class="flow-progress__fill" style="width:' + pct + '%"></span></div>' +
      '</div>'
    );
  }

  function renderLoadingHTML(label) {
    return (
      '<div class="flow-loading" role="status" aria-live="polite">' +
        '<p class="flow-loading__label">' + escapeHtml(label || 'Loading your specifications…') + '</p>' +
        '<div class="flow-loading__track" aria-hidden="true"><span class="flow-loading__fill"></span></div>' +
        '<div class="flow-skeleton" aria-hidden="true">' +
          '<div class="flow-skeleton__card"></div>' +
          '<div class="flow-skeleton__card"></div>' +
          '<div class="flow-skeleton__card"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function paintProgress() {
    if (!progressHost) return;
    progressHost.innerHTML = renderProgressHTML(progressIndex);
  }

  function clearProgressTimer() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function mountProgress(host) {
    progressHost = host || null;
    progressIndex = 0;
    paintProgress();
  }

  function setGenerationStage(index) {
    var next = Math.max(0, Math.min(STAGES.length - 1, index));
    progressIndex = next;
    paintProgress();
  }

  function startGenerationProgress(host) {
    if (host) progressHost = host;
    if (!progressHost && typeof document !== 'undefined') {
      progressHost = document.querySelector('.lb-msg--creating') || document.getElementById('flow-generation-host');
    }
    progressIndex = 0;
    paintProgress();
    clearProgressTimer();
    progressTimer = setInterval(function () {
      if (progressIndex < STAGES.length - 1) {
        progressIndex += 1;
        paintProgress();
      }
    }, 1600);
  }

  function bindNotice(container, handlers) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('[data-flow-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-flow-action');
        if (action === 'retry' && handlers && typeof handlers.onRetry === 'function') handlers.onRetry();
        else if (action === 'create' && handlers && typeof handlers.onCreate === 'function') handlers.onCreate();
        else if (action === 'dismiss' && handlers && typeof handlers.onDismiss === 'function') handlers.onDismiss();
        else if (action === 'retry' && typeof root.retryLoad === 'function') root.retryLoad();
        else if (action === 'create' && typeof root.goToCreateSpec === 'function') root.goToCreateSpec();
        else if (action === 'dismiss') {
          var row = button.closest('.lb-msg--flow, .flow-generation-host, .lb-msg--creating');
          if (row) row.remove();
        }
      });
    });
  }

  function presentGenerationStop(input, handlers) {
    clearProgressTimer();
    var html = renderNoticeHTML(describeGenerationError(input));
    var host = progressHost;
    if (!host && typeof document !== 'undefined') {
      host = document.querySelector('.lb-msg--creating') || document.getElementById('flow-generation-host');
    }
    if (!host || typeof document === 'undefined') return html;
    host.hidden = false;
    host.classList.remove('lb-msg--creating');
    host.classList.add('lb-msg--flow');
    host.setAttribute('role', 'alert');
    host.innerHTML = html;
    bindNotice(host, handlers);
    progressHost = host;
    return html;
  }

  function fillContainer(container, html, handlers) {
    if (!container) return;
    container.innerHTML = html;
    bindNotice(container, handlers);
  }

  root.SpecFlowFeedback = {
    stages: STAGES,
    describeGenerationError: describeGenerationError,
    describeLoadError: describeLoadError,
    describeEmptyWorkspace: describeEmptyWorkspace,
    describeStageError: describeStageError,
    renderNoticeHTML: renderNoticeHTML,
    renderProgressHTML: renderProgressHTML,
    renderLoadingHTML: renderLoadingHTML,
    mountProgress: mountProgress,
    setGenerationStage: setGenerationStage,
    startGenerationProgress: startGenerationProgress,
    presentGenerationStop: presentGenerationStop,
    fillContainer: fillContainer,
    escapeHtml: escapeHtml
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
