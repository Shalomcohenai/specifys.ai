// Blog Post Functionality - Specifys.ai
// Reading time, progress bar, table of contents, smooth scroll, share buttons

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== Calculate and Display Reading Time =====
  function calculateReadingTime() {
    const postBody = document.getElementById('post-body');
    if (!postBody) return;
    
    const text = postBody.innerText || postBody.textContent;
    const wordCount = text.trim().split(/\s+/).length;
    const wordsPerMinute = 200; // Average reading speed
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    
    const readingTimeElement = document.getElementById('reading-time');
    if (readingTimeElement) {
      readingTimeElement.textContent = `${readingTime} min read`;
    }
    
    return wordCount;
  }
  
  // ===== Reading Progress Bar =====
  function updateProgressBar() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;
    
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const progress = (scrollTop / documentHeight) * 100;
    
    progressBar.style.width = progress + '%';
  }
  
  // ===== Table of Contents Generator =====
  function generateTableOfContents() {
    const postBody = document.getElementById('post-body');
    const tocContainer = document.getElementById('toc-container');
    const toc = document.getElementById('toc');
    
    if (!postBody || !tocContainer || !toc) return;
    
    // Get all h2 and h3 headings
    const headings = postBody.querySelectorAll('h2, h3');
    
    // Only show TOC if there are at least 3 headings
    if (headings.length < 3) return;
    
    tocContainer.style.display = 'block';
    
    headings.forEach((heading, index) => {
      // Add ID to heading if it doesn't have one
      if (!heading.id) {
        const id = 'heading-' + index;
        heading.id = id;
      }
      
      // Create TOC link
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;
      link.className = heading.tagName.toLowerCase() === 'h3' ? 'toc-h3' : 'toc-h2';
      
      // Smooth scroll on click
      link.addEventListener('click', function(e) {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Update URL hash
        history.pushState(null, null, '#' + heading.id);
      });
      
      toc.appendChild(link);
    });
    
    // Highlight active TOC item on scroll
    window.addEventListener('scroll', highlightActiveTocItem);
  }
  
  function highlightActiveTocItem() {
    const headings = document.querySelectorAll('#post-body h2, #post-body h3');
    const tocLinks = document.querySelectorAll('#toc a');
    
    if (headings.length === 0 || tocLinks.length === 0) return;
    
    let current = '';
    
    headings.forEach(heading => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 150) {
        current = heading.id;
      }
    });
    
    tocLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }
  
  // ===== Back to Top Button =====
  function handleBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) return;
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });
    
    // Scroll to top on click
    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  // ===== Share Functions =====
  window.shareOnTwitter = function(event) {
    event.preventDefault();
    const url = window.location.href;
    const title = document.querySelector('.post-title').textContent;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };
  
  window.shareOnLinkedIn = function(event) {
    event.preventDefault();
    const url = window.location.href;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };
  
  window.shareOnFacebook = function(event) {
    event.preventDefault();
    const url = window.location.href;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };
  
  window.copyLink = function(event) {
    event.preventDefault();
    const url = window.location.href;
    
    // Create temporary input to copy text
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    // Visual feedback
    const btn = event.currentTarget;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = '#28a745';
    
    setTimeout(() => {
      btn.innerHTML = originalIcon;
      btn.style.background = '';
    }, 2000);
  };
  
  // ===== Enhance Code Blocks =====
  function enhanceCodeBlocks() {
    const codeBlocks = document.querySelectorAll('.post-body pre');
    
    codeBlocks.forEach(block => {
      // Add copy button to code blocks
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
      copyBtn.setAttribute('aria-label', 'Copy code');
      
      copyBtn.addEventListener('click', function() {
        const code = block.querySelector('code');
        const text = code.textContent;
        
        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        // Visual feedback
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        copyBtn.style.background = '#28a745';
        
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          copyBtn.style.background = '';
        }, 2000);
      });
      
      block.style.position = 'relative';
      block.appendChild(copyBtn);
    });
  }
  
  // ===== Add CSS for Code Copy Button =====
  function addCodeCopyButtonStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .code-copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s ease;
        z-index: 10;
      }
      
      .code-copy-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      .toc-h3 {
        padding-left: calc(var(--spacing-md) + var(--spacing-sm)) !important;
        font-size: 0.85rem !important;
        color: var(--text-muted) !important;
      }
      
      .toc-h3:hover {
        padding-left: calc(var(--spacing-lg) + var(--spacing-sm)) !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ===== Image Lazy Loading and Zoom =====
  function enhanceImages() {
    const images = document.querySelectorAll('.post-body img');
    
    images.forEach(img => {
      // Add loading attribute for lazy loading
      img.loading = 'lazy';
      
      // Add alt text if missing
      if (!img.alt) {
        img.alt = 'Article image';
      }
      
      // Add click to zoom functionality
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function() {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
          <div class="image-modal-content">
            <span class="image-modal-close">&times;</span>
            <img src="${img.src}" alt="${img.alt}">
          </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // Close modal
        const closeModal = () => {
          modal.remove();
          document.body.style.overflow = '';
        };
        
        modal.querySelector('.image-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
          if (e.target === modal || e.target.className === 'image-modal-content') {
            closeModal();
          }
        });
      });
    });
  }
  
  // ===== Add Image Modal Styles =====
  function addImageModalStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .image-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .image-modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
      }
      
      .image-modal-content img {
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        border-radius: 8px;
      }
      
      .image-modal-close {
        position: absolute;
        top: -40px;
        right: 0;
        color: white;
        font-size: 35px;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s ease;
      }
      
      .image-modal-close:hover {
        color: #ccc;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ===== Initialize All Functions =====
  const wordCount = calculateReadingTime();
  generateTableOfContents();
  handleBackToTop();
  enhanceCodeBlocks();
  enhanceImages();
  addCodeCopyButtonStyles();
  addImageModalStyles();
  
  // Update progress bar on scroll
  window.addEventListener('scroll', updateProgressBar);
  
  // Initial progress bar update
  updateProgressBar();
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href.length > 1) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.pushState(null, null, href);
        }
      }
    });
  });
  
  // Analytics tracking (if GA is available)
  if (typeof gtag !== 'undefined') {
    // Track reading progress
    let milestones = [25, 50, 75, 100];
    let trackedMilestones = [];
    
    window.addEventListener('scroll', function() {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const progress = Math.round((scrollTop / documentHeight) * 100);
      
      milestones.forEach(milestone => {
        if (progress >= milestone && !trackedMilestones.includes(milestone)) {
          trackedMilestones.push(milestone);
          gtag('event', 'reading_progress', {
            'event_category': 'Blog Post',
            'event_label': document.title,
            'value': milestone
          });
        }
      });
    });
    
    // Track time spent on page
    let startTime = Date.now();
    window.addEventListener('beforeunload', function() {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      gtag('event', 'time_on_page', {
        'event_category': 'Blog Post',
        'event_label': document.title,
        'value': timeSpent
      });
    });
  }
});

