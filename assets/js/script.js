let formData = {};

function selectTopic(button, topic) {
  const buttons = document.querySelectorAll("#topicSelector button");
  buttons.forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");
  formData.topic = topic;
}

function selectPlatform(button, platform) {
  const buttons = document.querySelectorAll("#platformSelector button");
  buttons.forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");
  formData.platform = platform;

  buttons.forEach((btn) => btn.classList.remove("required"));
}

function saveAndProceed() {
  const ideaInput = document.getElementById("ideaInput").value.trim();
  const platformButtons = document.querySelectorAll("#platformSelector button");
  let platformSelected = false;

  platformButtons.forEach((button) => {
    if (button.classList.contains("active")) {
      platformSelected = true;
    }
  });

  if (!formData.topic) {
    alert("Please select a topic.");
    return;
  }

  if (!ideaInput) {
    alert("Please enter your app idea.");
    return;
  }

  formData.idea = ideaInput;
  localStorage.setItem("formData", JSON.stringify(formData));
  window.location.href = "processing.html";
}

function handleLogin() {
  window.location.href = "login.html";
}

function handleRegister() {
  window.location.href = "register.html";
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
}
