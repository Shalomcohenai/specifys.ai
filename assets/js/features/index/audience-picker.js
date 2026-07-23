/**
 * Audience picker — sits above the hero H1 and adapts headline/CTA by persona.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'specifys_audience';

  const MESSAGING = {
    founder: {
      h1: 'Plan your startup before AI writes a single line of code',
      tagline: 'Stop prompting. Start planning.',
      cta: 'Start free',
      seeExample: 'See example'
    },
    developer: {
      h1: 'Give AI the plan it needs before it writes code',
      tagline: 'Stop prompting. Start planning.',
      cta: 'Start free',
      seeExample: 'See example'
    },
    pm: {
      h1: 'Align your team with a PRD in minutes',
      tagline: 'Stop prompting. Start planning.',
      cta: 'Create a PRD',
      seeExample: 'See example'
    },
    agency: {
      h1: 'Deliver client-ready specs in one sitting',
      tagline: 'Stop prompting. Start planning.',
      cta: 'Generate client spec',
      seeExample: 'See example'
    },
    default: {
      h1: 'Plan your app before AI writes a single line of code',
      tagline: 'Stop prompting. Start planning.',
      cta: 'Start free',
      seeExample: 'See example'
    }
  };

  function getStoredAudience() {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function setStoredAudience(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      /* ignore */
    }
  }

  function applyMessaging(audienceId) {
    const msg = MESSAGING[audienceId] || MESSAGING.default;
    const h1 = document.querySelector('.hero-description-text');
    const tagline = document.querySelector('.hero-tagline');
    const startBtn = document.getElementById('startButton');
    const finalBtn = document.getElementById('finalStartButton');
    const seeExample = document.querySelector('.hero-cta-see-example');

    if (h1) {
      h1.setAttribute('data-audience-h1', audienceId || 'default');
      h1.textContent = msg.h1;
    }
    if (tagline) tagline.textContent = msg.tagline;
    [startBtn, finalBtn].forEach(function (btn) {
      if (!btn) return;
      const label = btn.querySelector('.hero-cta-label');
      if (label) label.textContent = msg.cta;
      else {
        const svg = btn.querySelector('svg');
        btn.textContent = '';
        if (svg) btn.appendChild(svg);
        const span = document.createElement('span');
        span.className = 'hero-cta-label';
        span.textContent = msg.cta;
        btn.appendChild(span);
      }
      btn.setAttribute('aria-label', msg.cta);
    });
    if (seeExample) {
      seeExample.textContent = msg.seeExample;
      seeExample.setAttribute('aria-label', msg.seeExample);
    }

    document.querySelectorAll('.audience-picker-btn').forEach(function (btn) {
      const active = btn.getAttribute('data-audience') === audienceId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function init() {
    const picker = document.getElementById('audiencePicker');
    if (!picker) return;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('audience');
    const stored = getStoredAudience();
    const initial =
      fromUrl && MESSAGING[fromUrl] ? fromUrl : stored && MESSAGING[stored] ? stored : 'default';

    if (fromUrl && MESSAGING[fromUrl]) setStoredAudience(fromUrl);
    applyMessaging(initial === 'default' ? 'default' : initial);

    picker.addEventListener('click', function (e) {
      const btn = e.target.closest('.audience-picker-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-audience');
      if (!id || !MESSAGING[id]) return;
      setStoredAudience(id);
      applyMessaging(id);
      if (typeof gtag !== 'undefined') {
        gtag('event', 'audience_selected', {
          event_category: 'engagement',
          event_label: id
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
