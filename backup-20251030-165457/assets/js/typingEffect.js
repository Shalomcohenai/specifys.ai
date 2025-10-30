// Array of placeholder texts to cycle through
const placeholderTexts = [
    "A productivity app to manage tasks...",
    "A health app to track fitness goals...",
    "An education platform for online learning...",
    "An entertainment app for streaming music...",
    "A finance tool to budget expenses...",
    "A social app to connect with friends...",
    "A game with immersive storytelling...",
    "A design tool for creating mockups...",
    "An AI assistant for daily tasks..."
  ];
  
  // Get the textarea element
  const textarea = document.getElementById("ideaInput");
  let currentTextIndex = 0;
  let currentCharIndex = 0;
  let isDeleting = false;
  let typingSpeed = 100; // Speed of typing (ms per character)
  let deletingSpeed = 50; // Speed of deleting (ms per character)
  let pauseDuration = 2000; // Pause duration between texts (ms)
  
  // Function to handle the typing effect
  function typeEffect() {
    const currentText = placeholderTexts[currentTextIndex];
  
    // Skip the typing effect if the user has started typing
    if (textarea.value.length > 0) {
      textarea.placeholder = "";
      return;
    }
  
    // Update the placeholder text
    if (!isDeleting && currentCharIndex <= currentText.length) {
      // Typing
      textarea.placeholder = currentText.substring(0, currentCharIndex);
      currentCharIndex++;
      setTimeout(typeEffect, typingSpeed);
    } else if (isDeleting && currentCharIndex >= 0) {
      // Deleting
      textarea.placeholder = currentText.substring(0, currentCharIndex);
      currentCharIndex--;
      setTimeout(typeEffect, deletingSpeed);
    } else if (!isDeleting && currentCharIndex > currentText.length) {
      // Pause before deleting
      setTimeout(() => {
        isDeleting = true;
        typeEffect();
      }, pauseDuration);
    } else if (isDeleting && currentCharIndex < 0) {
      // Move to the next text
      isDeleting = false;
      currentTextIndex = (currentTextIndex + 1) % placeholderTexts.length;
      setTimeout(typeEffect, typingSpeed);
    }
  }
  
  // Start the typing effect when the page loads
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(typeEffect, 500); // Start after a short delay
  });
  
  // Stop the typing effect if the user starts typing
  textarea.addEventListener("input", () => {
    if (textarea.value.length > 0) {
      textarea.placeholder = "";
    }
  });