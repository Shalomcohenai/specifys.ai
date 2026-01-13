// Access Code Verification Script
(function() {
  // ===== CONFIGURATION =====
  // Set to true to enable the access code modal (site under maintenance)
  // Set to false to disable the modal and allow normal site access
  const ENABLE_ACCESS_CODE_MODAL = false;
  
  const ACCESS_CODE = '1997';
  const STORAGE_KEY = 'site_access_granted';
  let attemptCount = 0;
  
  // If modal is disabled, show content normally and exit
  if (!ENABLE_ACCESS_CODE_MODAL) {
    const modal = document.getElementById('accessCodeModal');
    const mainContent = document.getElementById('main-content');
    const header = document.querySelector('header');
    
    if (modal) modal.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (header) header.style.display = 'flex';
    return;
  }
  
  // Check if access was already granted
  const hasAccess = sessionStorage.getItem(STORAGE_KEY) === 'true';
  
  const modal = document.getElementById('accessCodeModal');
  const input = document.getElementById('accessCodeInput');
  const submitBtn = document.getElementById('accessCodeSubmit');
  const errorMsg = document.getElementById('accessCodeError');
  const mainContent = document.getElementById('main-content');
  const header = document.querySelector('header');
  
  function grantAccess() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    modal.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (header) header.style.display = 'flex';
  }
  
  function denyAccess() {
    attemptCount++;
    errorMsg.style.display = 'block';
    input.value = '';
    input.focus();
  }
  
  function checkAccess() {
    const enteredCode = input.value.trim();
    if (enteredCode === ACCESS_CODE) {
      grantAccess();
    } else {
      denyAccess();
    }
  }
  
  // Initialize
  if (!hasAccess) {
    // Hide main content until access is granted
    if (mainContent) mainContent.style.display = 'none';
    if (header) header.style.display = 'none';
    modal.style.display = 'flex';
    
    // Focus input
    setTimeout(() => {
      if (input) input.focus();
    }, 100);
    
    // Submit button click
    if (submitBtn) {
      submitBtn.addEventListener('click', checkAccess);
    }
    
    // Enter key press
    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          checkAccess();
        }
      });
    }
  } else {
    modal.style.display = 'none';
  }
})();
