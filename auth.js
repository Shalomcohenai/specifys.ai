// Run after DOM loads
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
  
    // Login page
    if (path.includes("login.html")) {
      const loginForm = document.getElementById("login-form");
      if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
          e.preventDefault();
          const { username, password } = loginForm;
          const users = JSON.parse(localStorage.getItem("users") || "[]");
          const user = users.find(
            (u) => u.username === username.value && u.password === password.value
          );
          if (user) {
            localStorage.setItem("currentUser", JSON.stringify(user));
            window.location.href = "home.html";
          } else {
            alert("Invalid credentials.");
          }
        });
      }
    }
  
    // Register page
    if (path.includes("register.html")) {
      const registerForm = document.getElementById("register-form");
      if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
          e.preventDefault();
          const { username, email, password } = registerForm;
          const users = JSON.parse(localStorage.getItem("users") || "[]");
          const exists = users.some((u) => u.username === username.value);
          if (exists) {
            alert("Username already exists.");
            return;
          }
          const newUser = {
            username: username.value,
            email: email.value,
            password: password.value,
            authMethod: "local",
          };
          users.push(newUser);
          localStorage.setItem("users", JSON.stringify(users));
          localStorage.setItem("currentUser", JSON.stringify(newUser));
          window.location.href = "home.html";
        });
      }
    }
  
    // Home page
    if (path.includes("home.html")) {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser) {
        window.location.href = "login.html";
        return;
      }
      const welcomeEl = document.getElementById("welcome-message");
      if (welcomeEl) {
        welcomeEl.textContent = `Welcome, ${currentUser.username}!`;
      }
    }
  });
  
  // Dummy login for Google/Apple
  function dummyLogin(method) {
    const dummyUser = {
      username: method === "google" ? "GoogleUser" : "AppleUser",
      email: method === "google" ? "google@example.com" : "apple@example.com",
      password: "",
      authMethod: method,
    };
    localStorage.setItem("currentUser", JSON.stringify(dummyUser));
    window.location.href = "home.html";
  }
  
  // Logout
  function logout() {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  }
  