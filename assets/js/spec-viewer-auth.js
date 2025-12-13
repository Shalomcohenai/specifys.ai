  // Auth UI functions
  function updateAuthUI(user) {
    const authButtons = document.getElementById('auth-buttons');
    if (!authButtons) return;
    
    if (user) {
      // User is logged in - username is now in side menu, so hide from header
      authButtons.innerHTML = '';
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
    // Handle side menu hover to adjust content margins
    const sideMenu = document.getElementById('sideMenu');
    const container = document.querySelector('.container');
    const pageIntroSection = document.querySelector('.page-intro-section');
    
    if (sideMenu) {
      // Menu expanded (hover) - 280px menu + 20px spacing = 300px
      sideMenu.addEventListener('mouseenter', () => {
        if (container) {
          container.style.marginLeft = '300px';
        }
        if (pageIntroSection) {
          pageIntroSection.style.marginLeft = '300px';
        }
      });
      
      // Menu collapsed (closed) - 60px menu + 30px spacing = 90px
      sideMenu.addEventListener('mouseleave', () => {
        if (container) {
          container.style.marginLeft = '90px';
        }
        if (pageIntroSection) {
          pageIntroSection.style.marginLeft = '90px';
        }
        // Close all submenus when menu collapses
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
