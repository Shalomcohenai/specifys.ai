export function attachUiBridge(windowTarget = window) {
  const keys = [
    'showTab',
    'toggleSubmenu',
    'filterMenuItems',
    'scrollToSection',
    'toggleEditMode',
    'updateStatus',
    'showNotification'
  ];
  keys.forEach((key) => {
    if (typeof windowTarget[key] === 'function') {
      windowTarget[key] = windowTarget[key].bind(windowTarget);
    }
  });
}
