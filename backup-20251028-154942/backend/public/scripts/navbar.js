import { onAuthChanged, logout, getCurrentUser } from './authService.js';

/**
 * Initialize navbar with authentication state
 */
export function initNavbar() {
  const navLinks = document.getElementById('nav-links');
  const authButtons = document.getElementById('auth-buttons');
  const navbar = document.getElementById('navbar');
  const hero = document.querySelector('.hero');
  
  if (!navLinks && !authButtons) {
    console.warn('Navbar elements not found');
    return;
  }

  // Listen to authentication state changes
  onAuthChanged((user) => {
    if (user) {
      // User is logged in
      renderLoggedInState(user);
      updateVisualIndicators(true);
    } else {
      // User is not logged in
      renderLoggedOutState();
      updateVisualIndicators(false);
    }
  });
}

/**
 * Update visual indicators for logged in state
 * @param {boolean} isLoggedIn - Whether user is logged in
 */
function updateVisualIndicators(isLoggedIn) {
  const navbar = document.getElementById('navbar');
  const hero = document.querySelector('.hero');
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  const featuresSection = document.getElementById('features-section');
  const loggedInContent = document.getElementById('logged-in-content');
  
  if (navbar) {
    if (isLoggedIn) {
      navbar.classList.add('navbar-logged-in');
      // Add status indicator if not exists
      if (!navbar.querySelector('.user-status-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'user-status-indicator';
        navbar.appendChild(indicator);
      }
    } else {
      navbar.classList.remove('navbar-logged-in');
      const indicator = navbar.querySelector('.user-status-indicator');
      if (indicator) {
        indicator.remove();
      }
    }
  }
  
  if (hero) {
      if (isLoggedIn) {
      hero.classList.add('logged-in');
      if (heroTitle) heroTitle.textContent = 'Welcome to Specifys.ai!';
      if (heroSubtitle) heroSubtitle.textContent = 'You are successfully logged in';
    } else {
      hero.classList.remove('logged-in');
      if (heroTitle) heroTitle.textContent = 'Welcome to Specifys.ai';
      if (heroSubtitle) heroSubtitle.textContent = 'Smart specification management system with user authentication';
    }
  }
  
  // Show/hide content based on login state
  if (featuresSection) {
    featuresSection.style.display = isLoggedIn ? 'none' : 'grid';
  }
  
  if (loggedInContent) {
    loggedInContent.style.display = isLoggedIn ? 'block' : 'none';
  }
}

/**
 * Render navbar for logged in user
 * @param {Object} user - Firebase user object
 */
function renderLoggedInState(user) {
  const navLinks = document.getElementById('nav-links');
  const authButtons = document.getElementById('auth-buttons');
  
  if (navLinks) {
    navLinks.innerHTML = `
      <a href="/pages/app-dashboard.html" class="nav-link">Dashboard</a>
      <a href="/pages/profile.html" class="nav-link">Profile</a>
      <span class="nav-user">
        <span class="user-avatar">${user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</span>
        Hello, ${user.displayName || user.email.split('@')[0]}
      </span>
      <button id="logout-btn" class="btn btn-outline">Logout</button>
    `;
  }
  
  if (authButtons) {
    authButtons.innerHTML = `
      <a href="/pages/app-dashboard.html" class="btn btn-primary">Dashboard</a>
      <a href="/pages/profile.html" class="btn btn-outline">Profile</a>
      <button id="logout-btn-main" class="btn btn-outline">Logout</button>
    `;
  }
  
  // Add logout event listeners
  const logoutBtn = document.getElementById('logout-btn');
  const logoutBtnMain = document.getElementById('logout-btn-main');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  if (logoutBtnMain) {
    logoutBtnMain.addEventListener('click', handleLogout);
  }
}

/**
 * Render navbar for logged out user
 */
function renderLoggedOutState() {
  const navLinks = document.getElementById('nav-links');
  const authButtons = document.getElementById('auth-buttons');
  
  if (navLinks) {
    navLinks.innerHTML = `
      <a href="/pages/auth.html" class="nav-link">Login</a>
      <a href="/pages/auth.html" class="nav-link">Sign Up</a>
    `;
  }
  
  if (authButtons) {
    authButtons.innerHTML = `
      <a href="/pages/auth.html" class="btn btn-primary">Login</a>
      <a href="/pages/auth.html" class="btn btn-outline">Sign Up</a>
    `;
  }
}

/**
 * Handle logout action
 */
async function handleLogout() {
  try {
    await logout();
    // Redirect to home page after logout
    window.location.href = '/index.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error logging out: ' + error.message);
  }
}

/**
 * Get current user info for display
 * @returns {Object|null} - User info or null if not authenticated
 */
export function getCurrentUserInfo() {
  const user = getCurrentUser();
  if (!user) return null;
  
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL
  };
}

// Initialize navbar when script loads
document.addEventListener('DOMContentLoaded', initNavbar);
