  // Auth UI functions
  function updateAuthUI(user) {
    const authButtons = document.getElementById('auth-buttons');
    if (!authButtons) return;
    
    if (user) {
      const displayName = user.displayName || user.email.split('@')[0];
      const firstLetter = displayName.charAt(0).toUpperCase();
      authButtons.innerHTML = `
        <a href="/pages/profile.html" class="user-info no-underline">
          <div class="user-avatar">${firstLetter}</div>
          <span>${displayName}</span>
        </a>
      `;
      updateSideMenuUser(user);
    } else {
      // User is not logged in
      authButtons.innerHTML = `
        <button class="auth-btn" onclick="showLoginModal()">Log in/Sign up</button>
      `;
    }
  }

  // Global auth functions
  window.showLoginModal = function() {
    if (typeof trackButtonClick !== 'undefined') {
      trackButtonClick('Show Login', 'Authentication', 'header');
    }
    window.location.href = '/pages/auth.html';
  };

  window.showRegisterModal = function() {
    if (typeof trackButtonClick !== 'undefined') {
      trackButtonClick('Show Register', 'Authentication', 'header');
    }
    window.location.href = '/pages/auth.html';
  };

  window.logout = function() {
    if (typeof trackAuthEvent !== 'undefined') {
      trackAuthEvent('logout', 'email');
    }
    auth.signOut()
      .then(() => {

      })
      .catch(error => {

      });
  };

  // Listen to auth state changes
  auth.onAuthStateChanged((user) => {
    updateAuthUI(user);
    updateSideMenuUser(user);
  });
  
  // Update side menu user info
  function updateSideMenuUser(user) {
    const sideMenuUserAvatar = document.getElementById('side-menu-user-avatar');
    const sideMenuUserInitial = document.getElementById('side-menu-user-initial');
    const sideMenuUserName = document.getElementById('side-menu-user-name');
    
    if (user && sideMenuUserAvatar && sideMenuUserInitial && sideMenuUserName) {
      const displayName = user.displayName || user.email.split('@')[0];
      const firstLetter = displayName.charAt(0).toUpperCase();
      
      sideMenuUserInitial.textContent = firstLetter;
      sideMenuUserName.textContent = displayName;
      
      // Make user section clickable to go to profile
      const userSection = sideMenuUserAvatar.closest('.side-menu-user');
      if (userSection) {
        userSection.style.cursor = 'pointer';
        userSection.onclick = () => window.location.href = '/pages/profile.html';
      }
    }
  }

  // Initialize auth buttons with default state
  document.addEventListener('DOMContentLoaded', function() {
    // Handle side menu hover to close submenus when menu collapses
    const sideMenu = document.getElementById('sideMenu');
    
    if (sideMenu) {
      // Close all submenus when menu collapses
      sideMenu.addEventListener('mouseleave', () => {
        document.querySelectorAll('.side-menu-submenu').forEach(submenu => {
          submenu.classList.remove('expanded');
        });
      });
    }
    
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons && !authButtons.innerHTML.trim()) {
      authButtons.innerHTML = `
        <button class="auth-btn login-btn">Log in/Sign up</button>
      `;
      
      const loginBtn = authButtons.querySelector('.login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', function(event) {
          event.stopPropagation();
          window.location.href = '/pages/auth.html';
        });
      }
    }
    
    // Font Awesome icons initialization completed
  });
