// Share Prompt Modal - Encourages users to share their spec
// Appears 5 seconds after overview is ready

(function() {
  'use strict';

  let shareModal = null;
  let shareOptionsModal = null;
  let currentSpecId = null;
  let currentSpecTitle = null;

  const SHARE_TEXT = `I just turned an app idea into a full spec in minutes 🤯

Clear features.
Tech stack.
Market & UX thinking.

Built with @SpecifysAI`;

  /**
   * Create main share prompt modal
   */
  function createShareModal() {
    if (shareModal) return shareModal;

    const modal = document.createElement('div');
    modal.id = 'share-prompt-modal';
    modal.className = 'share-prompt-overlay';
    modal.innerHTML = `
      <div class="share-prompt-content">
        <button class="share-prompt-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="share-prompt-body">
          <h2 class="share-prompt-title">Turn your spec into a bonus credit</h2>
          <p class="share-prompt-description">Share your spec and get +1 free credit!</p>
          <div class="share-prompt-actions">
            <button class="share-prompt-btn share-prompt-btn-primary" id="share-prompt-share-btn">
              Share & get +1 free credit
            </button>
            <button class="share-prompt-btn share-prompt-btn-secondary" id="share-prompt-later-btn">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    shareModal = modal;

    // Setup event listeners
    const closeBtn = modal.querySelector('.share-prompt-close');
    const shareBtn = modal.querySelector('#share-prompt-share-btn');
    const laterBtn = modal.querySelector('#share-prompt-later-btn');

    closeBtn.addEventListener('click', handleDismissPermanently);
    shareBtn.addEventListener('click', handleShareClick);
    laterBtn.addEventListener('click', handleMaybeLater);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleDismissPermanently();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        handleDismissPermanently();
      }
    });

    return modal;
  }

  /**
   * Create share options modal (shows after clicking Share)
   */
  function createShareOptionsModal() {
    if (shareOptionsModal) return shareOptionsModal;

    const modal = document.createElement('div');
    modal.id = 'share-options-modal';
    modal.className = 'share-options-overlay';
    modal.innerHTML = `
      <div class="share-options-content">
        <div class="share-options-header">
          <h3>Share your spec</h3>
          <button class="share-options-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="share-options-body">
          <div class="share-text-container">
            <textarea class="share-text-input" id="share-text-input" readonly>${SHARE_TEXT}</textarea>
            <button class="share-copy-btn" id="share-copy-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.3333 6H7.33333C6.59695 6 6 6.59695 6 7.33333V13.3333C6 14.0697 6.59695 14.6667 7.33333 14.6667H13.3333C14.0697 14.6667 14.6667 14.0697 14.6667 13.3333V7.33333C14.6667 6.59695 14.0697 6 13.3333 6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.33333 10H2.66667C2.29848 10 2 9.70152 2 9.33333V3.33333C2 2.96514 2.29848 2.66667 2.66667 2.66667H8.66667C9.03486 2.66667 9.33333 2.96514 9.33333 3.33333V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Copy
            </button>
          </div>
          <div class="share-platforms">
            <a href="#" class="share-platform-btn" id="share-twitter" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 4.01C21.1 4.38 20.16 4.62 19.18 4.72C20.19 4.1 20.98 3.15 21.34 2.02C20.4 2.58 19.35 2.98 18.23 3.18C17.35 2.23 16.12 1.65 14.75 1.65C12.13 1.65 9.99 3.79 9.99 6.41C9.99 6.75 10.03 7.08 10.1 7.39C6.77 7.22 3.85 5.58 1.8 3.05C1.44 3.6 1.24 4.25 1.24 4.95C1.24 6.25 1.89 7.4 2.85 8.08C2.06 8.05 1.32 7.85 0.7 7.53V7.58C0.7 9.88 2.18 11.78 4.19 12.23C3.84 12.33 3.47 12.38 3.09 12.38C2.82 12.38 2.56 12.35 2.31 12.3C2.84 14.18 4.58 15.58 6.64 15.6C5.05 16.88 3.01 17.65 0.8 17.65C0.53 17.65 0.26 17.63 0 17.6C2.01 18.95 4.4 19.75 6.98 19.75C14.75 19.75 19.18 12.45 19.18 5.92C19.18 5.75 19.18 5.58 19.17 5.42C20.1 4.75 20.88 3.95 21.5 3.05L22 4.01Z" fill="currentColor"/>
              </svg>
              Twitter
            </a>
            <a href="#" class="share-platform-btn" id="share-linkedin" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 0H5C2.24 0 0 2.24 0 5V19C0 21.76 2.24 24 5 24H19C21.76 24 24 21.76 24 19V5C24 2.24 21.76 0 19 0ZM8 19H5V9H8V19ZM6.5 7.5C5.67 7.5 5 6.83 5 6C5 5.17 5.67 4.5 6.5 4.5C7.33 4.5 8 5.17 8 6C8 6.83 7.33 7.5 6.5 7.5ZM20 19H17V13.5C17 12.12 15.88 11 14.5 11C13.12 11 12 12.12 12 13.5V19H9V9H12V10.5C12.8 9.4 14.1 8.5 15.5 8.5C18.54 8.5 20 10.96 20 14V19Z" fill="currentColor"/>
              </svg>
              LinkedIn
            </a>
            <a href="#" class="share-platform-btn" id="share-slack" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.042 15.165C5.042 16.653 3.808 17.887 2.32 17.887C0.832 17.887 -0.402 16.653 -0.402 15.165C-0.402 13.677 0.832 12.443 2.32 12.443H5.042V15.165ZM6.313 15.165C6.313 13.677 7.547 12.443 9.035 12.443C10.523 12.443 11.757 13.677 11.757 15.165V22.239C11.757 23.727 10.523 24.961 9.035 24.961C7.547 24.961 6.313 23.727 6.313 22.239V15.165Z" fill="currentColor"/>
                <path d="M9.035 5.042C7.547 5.042 6.313 3.808 6.313 2.32C6.313 0.832 7.547 -0.402 9.035 -0.402C10.523 -0.402 11.757 0.832 11.757 2.32V5.042H9.035ZM9.035 6.313C10.523 6.313 11.757 7.547 11.757 9.035C11.757 10.523 10.523 11.757 9.035 11.757H2.32C0.832 11.757 -0.402 10.523 -0.402 9.035C-0.402 7.547 0.832 6.313 2.32 6.313H9.035Z" fill="currentColor"/>
                <path d="M18.958 8.835C18.958 7.347 20.192 6.113 21.68 6.113C23.168 6.113 24.402 7.347 24.402 8.835C24.402 10.323 23.168 11.557 21.68 11.557H18.958V8.835ZM17.687 8.835C17.687 10.323 16.453 11.557 14.965 11.557C13.477 11.557 12.243 10.323 12.243 8.835V1.761C12.243 0.273 13.477 -0.961 14.965 -0.961C16.453 -0.961 17.687 0.273 17.687 1.761V8.835Z" fill="currentColor"/>
                <path d="M14.965 18.958C16.453 18.958 17.687 20.192 17.687 21.68C17.687 23.168 16.453 24.402 14.965 24.402C13.477 24.402 12.243 23.168 12.243 21.68V18.958H14.965ZM14.965 17.687C13.477 17.687 12.243 16.453 12.243 14.965C12.243 13.477 13.477 12.243 14.965 12.243H21.68C23.168 12.243 24.402 13.477 24.402 14.965C24.402 16.453 23.168 17.687 21.68 17.687H14.965Z" fill="currentColor"/>
              </svg>
              Slack
            </a>
            <a href="#" class="share-platform-btn" id="share-discord" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37C19.396 3.97 18.426 3.65 17.411 3.43C16.956 3.29 16.5 3.17 16.04 3.07C15.1 2.9 14.15 2.78 13.19 2.7C12.23 2.62 11.27 2.58 10.31 2.58C9.35 2.58 8.39 2.62 7.43 2.7C6.47 2.78 5.52 2.9 4.58 3.07C4.12 3.17 3.66 3.29 3.21 3.43C2.19 3.65 1.22 3.97 0.3 4.37C0.1 5.21 -0.05 6.04 -0.14 6.88C-0.23 7.72 -0.27 8.56 -0.27 9.4C-0.27 10.24 -0.23 11.08 -0.14 11.92C-0.05 12.76 0.1 13.59 0.3 14.43C1.22 14.83 2.19 15.15 3.21 15.37C3.66 15.51 4.12 15.63 4.58 15.73C5.52 15.9 6.47 16.02 7.43 16.1C8.39 16.18 9.35 16.22 10.31 16.22C11.27 16.22 12.23 16.18 13.19 16.1C14.15 16.02 15.1 15.9 16.04 15.73C16.5 15.63 16.96 15.51 17.41 15.37C18.43 15.15 19.4 14.83 20.32 14.43C20.52 13.59 20.67 12.76 20.76 11.92C20.85 11.08 20.89 10.24 20.89 9.4C20.89 8.56 20.85 7.72 20.76 6.88C20.67 6.04 20.52 5.21 20.32 4.37H20.317ZM8.02 12.33C7.17 12.33 6.48 11.64 6.48 10.79C6.48 9.94 7.17 9.25 8.02 9.25C8.87 9.25 9.56 9.94 9.56 10.79C9.56 11.64 8.87 12.33 8.02 12.33ZM15.98 12.33C15.13 12.33 14.44 11.64 14.44 10.79C14.44 9.94 15.13 9.25 15.98 9.25C16.83 9.25 17.52 9.94 17.52 10.79C17.52 11.64 16.83 12.33 15.98 12.33Z" fill="currentColor"/>
              </svg>
              Discord
            </a>
          </div>
          <button class="share-close-btn" id="share-close-btn">
            Copy & Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    shareOptionsModal = modal;

    // Setup event listeners
    const closeBtn = modal.querySelector('.share-options-close');
    const copyBtn = modal.querySelector('#share-copy-btn');
    const closeActionBtn = modal.querySelector('#share-close-btn');
    const textInput = modal.querySelector('#share-text-input');

    closeBtn.addEventListener('click', closeShareOptions);
    copyBtn.addEventListener('click', handleCopyText);
    closeActionBtn.addEventListener('click', handleCopyAndClose);
    textInput.addEventListener('click', () => textInput.select());

    // Setup share platform links (must be after modal is created)
    setTimeout(() => {
      updateShareLinks();
    }, 0);

    return modal;
  }

  /**
   * Update share platform links with encoded text
   */
  function updateShareLinks() {
    const encodedText = encodeURIComponent(SHARE_TEXT);
    const specUrl = currentSpecId ? `${window.location.origin}/pages/spec-viewer.html?id=${currentSpecId}` : window.location.origin;
    const encodedUrl = encodeURIComponent(specUrl);
    
    const twitterLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    const linkedinLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    const slackLink = `https://slack.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    const discordLink = `https://discord.com/channels/@me`; // Discord doesn't have direct share, but we can provide the text

    const twitterBtn = shareOptionsModal.querySelector('#share-twitter');
    const linkedinBtn = shareOptionsModal.querySelector('#share-linkedin');
    const slackBtn = shareOptionsModal.querySelector('#share-slack');
    const discordBtn = shareOptionsModal.querySelector('#share-discord');

    // Remove existing listeners if any
    const newTwitterBtn = twitterBtn ? twitterBtn.cloneNode(true) : null;
    const newLinkedinBtn = linkedinBtn ? linkedinBtn.cloneNode(true) : null;
    const newSlackBtn = slackBtn ? slackBtn.cloneNode(true) : null;
    const newDiscordBtn = discordBtn ? discordBtn.cloneNode(true) : null;

    if (newTwitterBtn && twitterBtn && twitterBtn.parentNode) {
      newTwitterBtn.href = twitterLink;
      newTwitterBtn.addEventListener('click', async (e) => {
        // Call handleShareComplete when user clicks share
        setTimeout(() => {
          handleShareComplete();
        }, 500); // Small delay to allow popup to open
      });
      twitterBtn.parentNode.replaceChild(newTwitterBtn, twitterBtn);
    }

    if (newLinkedinBtn && linkedinBtn && linkedinBtn.parentNode) {
      newLinkedinBtn.href = linkedinLink;
      newLinkedinBtn.addEventListener('click', async (e) => {
        setTimeout(() => {
          handleShareComplete();
        }, 500);
      });
      linkedinBtn.parentNode.replaceChild(newLinkedinBtn, linkedinBtn);
    }

    if (newSlackBtn && slackBtn && slackBtn.parentNode) {
      newSlackBtn.href = slackLink;
      newSlackBtn.addEventListener('click', async (e) => {
        setTimeout(() => {
          handleShareComplete();
        }, 500);
      });
      slackBtn.parentNode.replaceChild(newSlackBtn, slackBtn);
    }

    if (newDiscordBtn && discordBtn && discordBtn.parentNode) {
      // For Discord, we'll just copy the text when clicked
      newDiscordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleCopyText();
        await handleShareComplete();
      });
      discordBtn.parentNode.replaceChild(newDiscordBtn, discordBtn);
    }
  }

  /**
   * Handle share button click
   */
  function handleShareClick() {
    closeSharePrompt();
    setTimeout(() => {
      openShareOptions();
    }, 300);
  }

  /**
   * Handle maybe later button click
   */
  async function handleMaybeLater() {
    try {
      await recordShareAction('maybe_later');
      closeSharePrompt();
    } catch (error) {
      console.error('[SharePrompt] Error recording maybe later:', error);
      closeSharePrompt();
    }
  }

  /**
   * Handle dismiss permanently (X button)
   */
  async function handleDismissPermanently() {
    try {
      await recordShareAction('dismissed');
      closeSharePrompt();
    } catch (error) {
      console.error('[SharePrompt] Error recording dismissal:', error);
      closeSharePrompt();
    }
  }

  /**
   * Handle copy text
   */
  async function handleCopyText() {
    const textInput = shareOptionsModal.querySelector('#share-text-input');
    if (!textInput) return;

    try {
      await navigator.clipboard.writeText(textInput.value);
      const copyBtn = shareOptionsModal.querySelector('#share-copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.3333 3.33333L6 10.6667L2.66667 7.33333" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Copied!
        `;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('[SharePrompt] Error copying text:', error);
      alert('Failed to copy text. Please select and copy manually.');
    }
  }

  /**
   * Handle copy and close
   */
  async function handleCopyAndClose() {
    try {
      await handleCopyText();
      await handleShareComplete();
      // Small delay before closing to ensure API call completes
      setTimeout(() => {
        closeShareOptions();
      }, 500);
    } catch (error) {
      console.error('[SharePrompt] Error in handleCopyAndClose:', error);
      closeShareOptions();
    }
  }

  /**
   * Handle share complete (user clicked a share platform or copied)
   */
  async function handleShareComplete() {
    if (!currentSpecId) {
      console.warn('[SharePrompt] No specId available for share tracking');
      return;
    }

    try {
      console.log('[SharePrompt] Recording share action for specId:', currentSpecId);
      
      // Record the share action (no credits granted)
      await recordShareAction('shared');
      
      console.log('[SharePrompt] Share action recorded successfully');
    } catch (error) {
      console.error('[SharePrompt] Error recording share action:', error);
      // Don't show error to user - this is just tracking
    }
  }

  /**
   * Record share action in Firestore
   */
  async function recordShareAction(action) {
    if (!currentSpecId) return;

    try {
      await window.api.post('/api/share-prompt/action', {
        specId: currentSpecId,
        action: action // 'maybe_later', 'dismissed', or 'shared'
      });
    } catch (error) {
      console.error('[SharePrompt] Error recording action:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Open share prompt modal
   */
  function openSharePrompt() {
    const modal = createShareModal();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close share prompt modal
   */
  function closeSharePrompt() {
    if (shareModal) {
      shareModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  /**
   * Open share options modal
   */
  function openShareOptions() {
    const modal = createShareOptionsModal();
    updateShareLinks();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close share options modal
   */
  function closeShareOptions() {
    if (shareOptionsModal) {
      shareOptionsModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  /**
   * Check if should show share prompt
   */
  async function shouldShowSharePrompt(specId) {
    try {
      const response = await window.api.get(`/api/share-prompt/check?specId=${specId}`);
      return response && response.shouldShow === true;
    } catch (error) {
      console.error('[SharePrompt] Error checking if should show:', error);
      return false; // Don't show on error
    }
  }

  /**
   * Initialize share button in overview header
   * Button is part of the frame and always visible once spec is ready
   */
  function initOverviewShareButton() {
    const shareBtn = document.getElementById('overview-share-btn');
    if (!shareBtn) return;

    // Show the button (it's part of the frame, always visible once spec is ready)
    shareBtn.style.display = 'flex';
    shareBtn.classList.remove('hidden');

    // Remove existing listeners by cloning
    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    
    // Show the new button
    newShareBtn.style.display = 'flex';
    newShareBtn.classList.remove('hidden');

    // Add click handler
    newShareBtn.addEventListener('click', async () => {
      // Try to get specId from URL if not set
      let specId = currentSpecId;
      if (!specId) {
        const urlParams = new URLSearchParams(window.location.search);
        specId = urlParams.get('id');
      }
      
      // Also try to get from global currentSpecData if available
      // Note: currentSpecData is defined in spec-viewer-main.js
      if (!specId && typeof currentSpecData !== 'undefined' && currentSpecData && currentSpecData.id) {
        specId = currentSpecData.id;
      }

      if (specId) {
        // Set current specId for share functionality
        currentSpecId = specId;
        // Open share options directly (as if clicked "Share & get +1 free credit")
        handleShareClick();
      } else {
        console.warn('[SharePrompt] No specId available for sharing');
      }
    });
  }

  /**
   * Initialize share prompt for a spec
   */
  async function initSharePrompt(specId, specTitle) {
    currentSpecId = specId;
    currentSpecTitle = specTitle;

    // Always initialize the share button in overview (button is always visible as part of the frame)
    initOverviewShareButton();

    // Check if should show modal (independent of button visibility)
    const shouldShow = await shouldShowSharePrompt(specId);
    if (!shouldShow) {
      return;
    }

    // Show after 5 seconds
    setTimeout(() => {
      openSharePrompt();
    }, 5000);
  }

  // Export functions
  window.sharePrompt = {
    init: initSharePrompt,
    open: openSharePrompt,
    close: closeSharePrompt,
    initButton: initOverviewShareButton
  };

  // Inject styles
  if (!document.getElementById('share-prompt-styles')) {
    const style = document.createElement('style');
    style.id = 'share-prompt-styles';
    style.textContent = `
      /* Share Prompt Modal Styles */
      .share-prompt-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .share-prompt-content {
        background: #ffffff;
        border-radius: 16px;
        padding: 32px;
        max-width: 480px;
        width: 100%;
        position: relative;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .share-prompt-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .share-prompt-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .share-prompt-body {
        text-align: center;
      }

      .share-prompt-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 12px 0;
      }

      .share-prompt-description {
        font-size: 1rem;
        color: #6b7280;
        margin: 0 0 24px 0;
      }

      .share-prompt-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .share-prompt-btn {
        padding: 14px 24px;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .share-prompt-btn-primary {
        background: linear-gradient(135deg, #FF6B35 0%, #FF8551 100%);
        color: white;
      }

      .share-prompt-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
      }

      .share-prompt-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .share-prompt-btn-secondary:hover {
        background: #e5e7eb;
      }

      /* Share Options Modal Styles */
      .share-options-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
        animation: fadeIn 0.3s ease;
      }

      .share-options-content {
        background: #ffffff;
        border-radius: 16px;
        max-width: 560px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
        overflow: hidden;
      }

      .share-options-header {
        padding: 24px 24px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .share-options-header h3 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0;
      }

      .share-options-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .share-options-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .share-options-body {
        padding: 24px;
      }

      .share-text-container {
        margin-bottom: 24px;
      }

      .share-text-input {
        width: 100%;
        min-height: 120px;
        padding: 16px;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        font-size: 0.95rem;
        font-family: inherit;
        color: #1f2937;
        resize: vertical;
        margin-bottom: 12px;
        background: #f9fafb;
      }

      .share-text-input:focus {
        outline: none;
        border-color: #FF6B35;
        background: #ffffff;
      }

      .share-copy-btn {
        width: 100%;
        padding: 12px;
        background: #f3f4f6;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #374151;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .share-copy-btn:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
      }

      .share-platforms {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      }

      .share-platform-btn {
        padding: 16px;
        background: #f9fafb;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        text-decoration: none;
        color: #374151;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: all 0.2s ease;
      }

      .share-platform-btn:hover {
        background: #f3f4f6;
        border-color: #FF6B35;
        color: #FF6B35;
        transform: translateY(-2px);
      }

      .share-close-btn {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #FF6B35 0%, #FF8551 100%);
        border: none;
        border-radius: 10px;
        color: white;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .share-close-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
      }

      .share-success-message {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #FF6B35 0%, #FF8551 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        font-weight: 600;
        z-index: 10002;
        animation: slideInRight 0.3s ease;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @media (max-width: 640px) {
        .share-prompt-content,
        .share-options-content {
          max-width: 100%;
          margin: 0;
        }

        .share-platforms {
          grid-template-columns: 1fr;
        }
      }

      /* Overview Share Button Styles */
      .overview-share-button {
        background: transparent;
        border: 1px solid #e5e7eb;
        color: #6b7280;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.875rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        font-weight: 500;
      }

      .overview-share-button:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
        color: #374151;
      }

      .overview-share-button i {
        font-size: 0.875rem;
      }

      .content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    `;
    document.head.appendChild(style);
  }
})();

