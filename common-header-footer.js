// Common Header, Footer and Menu JavaScript for Specifys.ai

document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme toggle
  initializeThemeToggle();
  
  // Initialize menu toggle
  initializeMenuToggle();
  
  // Initialize scroll to top button
  initializeScrollToTop();
  
  // Load saved theme
  loadSavedTheme();
});

// Theme Toggle Functionality
function initializeThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDarkMode = document.body.classList.contains('dark-mode');
      
      // Update icon
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon', !isDarkMode);
        icon.classList.toggle('fa-sun', isDarkMode);
      }
      
      // Update aria-label
      themeToggle.setAttribute('aria-label', isDarkMode ? 'Toggle light mode' : 'Toggle dark mode');
      
      // Save to localStorage
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      
      // Track event if gtag exists
      if (typeof gtag !== 'undefined') {
        gtag('event', 'click', {
          'event_category': 'Theme Toggle',
          'event_label': isDarkMode ? 'Dark Mode' : 'Light Mode'
        });
      }
    });
  }
}

// Menu Toggle Functionality
function initializeMenuToggle() {
  const menuToggle = document.querySelector('.menu-toggle');
  const headerLinks = document.querySelector('.header-links');
  
  if (menuToggle && headerLinks) {
    menuToggle.addEventListener('click', () => {
      const isActive = headerLinks.classList.contains('active');
      headerLinks.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', !isActive);
      
      // Track event if gtag exists
      if (typeof gtag !== 'undefined') {
        gtag('event', 'click', {
          'event_category': 'Menu Interaction',
          'event_label': isActive ? 'Menu Close' : 'Menu Open'
        });
      }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!menuToggle.contains(event.target) && !headerLinks.contains(event.target)) {
        headerLinks.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Close menu when pressing Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && headerLinks.classList.contains('active')) {
        headerLinks.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

// Scroll to Top Functionality
function initializeScrollToTop() {
  const scrollToTop = document.getElementById('scrollToTop');
  if (scrollToTop) {
    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 200) {
        scrollToTop.classList.add('visible');
      } else {
        scrollToTop.classList.remove('visible');
      }
    });
    
    // Scroll to top when clicked
    scrollToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

// Load Saved Theme
function loadSavedTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeToggle = document.getElementById('themeToggle');
  
  // Check if we're on the homepage (index.html)
  const isHomepage = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname.endsWith('/') || 
                     window.location.pathname === '';
  
  if (isHomepage) {
    // On homepage: check system preference for dark mode
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Determine initial theme:
    // 1. If user explicitly chose a theme, use that
    // 2. Otherwise, follow system preference
    let shouldUseDarkMode = false;
    
    if (savedTheme === 'dark') {
      shouldUseDarkMode = true;
    } else if (savedTheme === 'light') {
      shouldUseDarkMode = false;
    } else {
      // No saved preference, follow system
      shouldUseDarkMode = systemPrefersDark;
    }
    
    // Apply the determined theme
    if (shouldUseDarkMode) {
      document.body.classList.add('dark-mode');
      if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.classList.replace('fa-moon', 'fa-sun');
        }
        themeToggle.setAttribute('aria-label', 'Toggle light mode');
      }
    } else {
      document.body.classList.remove('dark-mode');
      if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.classList.replace('fa-sun', 'fa-moon');
        }
        themeToggle.setAttribute('aria-label', 'Toggle dark mode');
      }
    }
    
    // Save the current theme to localStorage
    localStorage.setItem('theme', shouldUseDarkMode ? 'dark' : 'light');
    
    // Listen for system theme changes (only on homepage)
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't explicitly chosen a theme
        if (!localStorage.getItem('theme')) {
          if (e.matches) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
          } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
          }
          // Update theme toggle button
          if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
              icon.className = e.matches ? 'fas fa-sun' : 'fas fa-moon';
            }
            themeToggle.setAttribute('aria-label', e.matches ? 'Toggle light mode' : 'Toggle dark mode');
          }
        }
      });
    }
  } else {
    // On other pages: use normal theme loading (no system preference check)
    // ALWAYS start with light mode
    document.body.classList.remove('dark-mode');
    
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.classList.replace('fa-sun', 'fa-moon');
      }
      themeToggle.setAttribute('aria-label', 'Toggle dark mode');
    }
    
    // Only apply dark mode if user explicitly chose it
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.classList.replace('fa-moon', 'fa-sun');
        }
        themeToggle.setAttribute('aria-label', 'Toggle light mode');
      }
    } else {
      // Force light mode and save it
      localStorage.setItem('theme', 'light');
    }
  }
}

// Toggle Dark Mode (for backward compatibility)
function toggleDarkMode() {
  const body = document.body;
  const isDarkMode = body.classList.toggle('dark-mode');
  
  // Update theme toggle button if it exists
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
    themeToggle.setAttribute('aria-label', isDarkMode ? 'Toggle light mode' : 'Toggle dark mode');
  }
  
  // Save to localStorage
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}



// Export functions for use in other scripts
window.SpecifysCommon = {
  initializeThemeToggle,
  initializeMenuToggle,
  initializeScrollToTop,
  loadSavedTheme,
  toggleDarkMode
};
