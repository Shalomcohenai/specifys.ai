const _state = {
  currentTab: 'overview',
  specUnsub: null,
  dataService: null
};

const _renderers = new Map();

export function getCurrentTab() {
  return _state.currentTab;
}

export function registerRenderer(tabName, renderer) {
  if (!tabName || typeof renderer !== 'function') return;
  _renderers.set(tabName, renderer);
}

export function unregisterRenderer(tabName) {
  _renderers.delete(tabName);
}

export function renderActive(spec) {
  const renderer = _renderers.get(_state.currentTab);
  if (!renderer) return;
  renderer(spec);
}

function closeMobileMenuIfOpen() {
  if (window.innerWidth > 768) return;
  const sideMenu = document.getElementById('sideMenu');
  const sideMenuToggle = document.getElementById('sideMenuToggle');
  const overlay = document.querySelector('.side-menu-overlay');

  if (sideMenu && sideMenu.classList.contains('active')) {
    sideMenu.classList.remove('active');
    if (sideMenuToggle) {
      sideMenuToggle.setAttribute('aria-expanded', 'false');
    }
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
  }
}

function scrollPageToTop() {
  const reduce = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: reduce ? 'auto' : 'smooth'
  });
}

export async function showTab(tabName, opts = {}) {
  const scrollToTop = !!(opts && opts.scrollToTop);
  closeMobileMenuIfOpen();

  if (tabName === 'mockup' || tabName === 'visibility-engine') {
    const hasProAccess = await window.checkProAccess?.();
    if (!hasProAccess) {
      const featureName = tabName === 'mockup' ? 'Mockup' : 'AIO & SEO Visibility Engine';
      window.showNotification?.(`${featureName} is available for PRO users only. Please upgrade to PRO to access it.`, 'error');
      return;
    }
  }

  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.style.display = 'none';
  });

  document.querySelectorAll('.side-menu-button').forEach((btn) => {
    btn.classList.remove('active');
  });

  const tabContent = document.getElementById(`${tabName}-content`);
  if (tabContent) {
    tabContent.style.display = 'block';
  }

  const tabButton = document.getElementById(`${tabName}Tab`);
  if (tabButton && !tabButton.disabled) {
    tabButton.classList.add('active');
    tabButton.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.side-menu-button').forEach((btn) => {
      if (btn !== tabButton) {
        btn.setAttribute('aria-selected', 'false');
      }
    });
    if (typeof window.focusManager?.announce === 'function') {
      window.focusManager.announce(`Switched to ${tabName} tab`, 'polite');
    }
  }

  const notificationDot = document.getElementById(`${tabName}Notification`);
  if (notificationDot) {
    notificationDot.style.display = 'none';
    notificationDot.classList.remove('generating', 'notification', 'chat-notification');
  }

  if (tabName !== 'chat') {
    window.markTabAsViewed?.(tabName);
    if (tabButton) {
      tabButton.classList.add('viewed');
    }
  }

  const currentSpecData = window.dataService?.getSpec?.() || window.currentSpecData;
  if (currentSpecData && currentSpecData.status) {
    const status = currentSpecData.status[tabName] || currentSpecData.status[tabName === 'mockup' ? 'mockup' : tabName];
    if (status) {
      window.updateNotificationDot?.(tabName, status);
    }
  }

  window.updateSubsections?.(tabName);
  if (tabName === 'mindmap') {
    window.initializeMindMapTab?.();
  }

  _state.currentTab = tabName;
  window.currentTab = tabName;
  renderActive(currentSpecData);
  if (scrollToTop) {
    requestAnimationFrame(() => {
      scrollPageToTop();
    });
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('specViewerTabChange', { detail: { tabName } }));
  }
}

export function attach({ dataService } = {}) {
  if (!dataService || typeof dataService.on !== 'function') return;
  teardown();
  _state.dataService = dataService;
  _state.specUnsub = dataService.on('specUpdated', (spec) => {
    renderActive(spec);
  });
}

export function teardown() {
  if (_state.specUnsub) {
    _state.specUnsub();
    _state.specUnsub = null;
  }
  _state.currentTab = window.currentTab || 'overview';
}

