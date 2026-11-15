(function () {
  function initHeaderMenu() {
    var header = document.querySelector('.thematic-header');
    var button = document.querySelector('.header-menu-toggle');
    var nav = document.getElementById('header-nav');
    if (!header || !button || !nav || button.dataset.menuReady === '1') return;
    button.dataset.menuReady = '1';

    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open) button.focus();
    }

    function items() {
      return [button].concat(Array.from(nav.querySelectorAll('a')));
    }

    button.addEventListener('click', function () {
      setOpen(!header.classList.contains('nav-open'));
    });

    document.addEventListener('keydown', function (event) {
      if (!header.classList.contains('nav-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      var list = items();
      var first = list[0];
      var last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (!window.matchMedia('(max-width: 768px)').matches) {
        header.classList.remove('nav-open');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Open menu');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderMenu);
  } else {
    initHeaderMenu();
  }
})();
