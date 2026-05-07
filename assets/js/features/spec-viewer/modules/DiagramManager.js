export function attachDiagramBridge(windowTarget = window) {
  const keys = ['displayDiagrams', 'openFullscreen', 'zoomIn', 'zoomOut', 'resetZoom', 'closeFullscreen'];
  keys.forEach((key) => {
    if (typeof windowTarget[key] === 'function') {
      windowTarget[key] = windowTarget[key].bind(windowTarget);
    }
  });
}
