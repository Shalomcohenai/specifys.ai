async function generateSpecificationFromProcessingNoviceJs() {
  try {
    console.log('Starting generateSpecificationFromProcessingNoviceJs');
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    const currentMode = localStorage.getItem('currentMode') || 'nocode';
    console.log('Form data:', { idea, topic, platform, currentMode });

    const answers = JSON.parse(localStorage.getItem('processingAnswers')) || {};
    console.log('Answers:', answers);

    let details = '';
    const steps = [
      { name: 'App Overview', question: 'What is the general purpose and idea of your app?' },
      { name: 'User Workflow', question: 'Describe the typical workflow of a user using your app.' },
      { name: 'Design', question: 'What design elements are most important for your app?' },
      { name: 'Features', question: 'What key features do you want your app to have?' },
      { name: 'Target Audience', question: 'Who is your target audience?' },
      { name: 'User Account System', question: 'Does your app require a user account system?', type: 'yesno' },
      { name: 'AI Features', question: 'Does your app use or integrate with AI features?', type: 'yesno' },
      { name: 'Free to Use', question: 'Will your app be free to use?', type: 'yesno' },
      { name: 'Notifications', question: 'Does your app need to send notifications?', type: 'yesno' },
      { name: 'Offline Mode', question: 'Does your app need to work offline?', type: 'yesno' },
      { name: 'Multiple Languages', question: 'Will your app support multiple languages?', type: 'yesno' },
      { name: 'Social Media Integration', question: 'Does your app require integration with social media?', type: 'yesno' },
      { name: 'Analytics', question: 'Will your app collect user data for analytics?', type: 'yesno' },
      { name: 'Additional Notes', question: 'Any additional notes or requirements for your app?' }
    ];

    steps.forEach((step, index) => {
      const response = index < 5 ? answers[index] || 'Not provided' : 
                      index < 13 ? answers[`yesNo_${index - 5}`] || 'Not specified' : 
                      answers[index] || 'Not provided';
      if (step.type === 'yesno') {
        details += `${step.question}: ${response}\n`;
      } else {
        details += `${step.name}: ${response}\n`;
      }
    });

    const fullPrompt = `You are a professional product manager and UX architect.  

Your task is to generate a clear, structured, and highly detailed **Application Specification Document** written in the language and mindset of software developers.  

The goal is to help a **non-technical user** who described their app idea.  
Your output will allow them to copy-paste the document into an AI coding assistant (like ChatGPT or GitHub Copilot) so that it can start generating the actual app code.  

Please follow these instructions:

- Write the specification **as if it was prepared by a professional product team for software developers**.
- Use structured, technical vocabulary (but no actual code).
- **If the user input is vague or incomplete, proactively fill in missing parts** using reasonable assumptions based on standard UX and software design best practices.
- **Your response must be extremely detailed, verbose, and comprehensive. Use the maximum possible output length**. Expand every section with examples, edge cases, user scenarios, and functional notes.
- Do not summarize. Do not simplify. Go deep.

---

Use the following structure (mandatory), with clear section titles (no markdown symbols like ##):

Application Specification Document

General Information  
**Topic**:  
**Platform**:  
**Suggested App Title**:  
**General Idea Summary**:  
(A rich summary describing what the app does, for whom, and why it matters.)

Problem Statement  
(Clearly articulate the main user problem the app is solving. Include emotional, behavioral, or contextual aspects of the problem if relevant.)

Core Features  
(Numbered list of key features. Each feature should be explained in 3–5 lines, including expected behavior, possible variations, and purpose.)

User Flow  
(Step-by-step interaction flow of a typical user. Include alternative paths, errors, edge cases, and post-onboarding behavior. Use numbering or bullet steps.)

Screens  
(List all major screens with names and functional descriptions. For each screen, explain what the user does, what is displayed, and what data is used or changed.)

UI Components per Screen  
[Screen Name]  
- List all UI elements (e.g., buttons, inputs, tabs, dropdowns, cards, modals)  
- Describe interactions, transitions, conditional states, or dynamic content

Navigation Map  
(Describe app navigation logic, including which screens are connected and how. Visualize it in bullet steps or text arrows, e.g., Onboarding → Home → Profile → Settings.)

Data Models  
(Define each data entity used in the app. For each, list attributes, expected data types, validation rules, and relationships with other entities such as one-to-many or many-to-many.)

Storage and Backend Logic  
(Describe what data is stored, how it is structured, and what logic governs it. Include expected APIs, CRUD operations, login flows, and authorization. Mention if the app is expected to use external APIs.)

Offline Mode (if relevant)  
(Explain what parts of the app should work offline, what data is cached locally, how conflicts are resolved, and how sync occurs when connectivity returns.)

User Roles and Permissions  
(Define every role that exists in the app – e.g., guest, user, admin – and what screens/features/permissions each has access to.)

Notifications  
(Explain types of notifications used (push/in-app/email), what triggers them, and what content they include. Include timing and frequency if applicable.)

Visual Style Guidelines  
(Describe intended visual tone: color palette, component shapes (e.g., rounded/minimalist), typography, spacing, branding direction. Give concrete adjectives like modern, calm, high-contrast, etc.)

Design & UX Principles  
(Specify interaction style: animations, response speed, transitions, accessibility rules, feedback timing, error display patterns, etc.)

Technical Requirements  
(Specify preferences or requirements for frameworks, platforms, operating systems, API usage, integrations, or device compatibility.)

Development Phases  
Phase 1 – Core MVP (must-have features and core screens)  
Phase 2 – UX enhancements, performance, offline  
Phase 3 – Analytics, monetization, admin dashboard, future roadmap items

Appendix  
(Optional section for extra insights)  
- List future features not in MVP  
- Notes or inspiration from similar apps  
- Known constraints  
- Hypothetical user feedback

---

Now, based on this structure, generate a **fully detailed and developer-oriented Application Specification Document** for the following app idea.  
Please maximize the detail and token usage. Be as comprehensive as possible in every section.

**User Input:**  
Topic: ${topic}  
Platform: ${platform}  
Idea: ${idea}  
Details:  
${details}
`;

    console.log('Full prompt constructed:', fullPrompt);
    console.log('Prompt length (characters):', fullPrompt.length);
    console.log('Sending request with prompt:', fullPrompt);
    const response = await fetch('https://worker1.shalom-cohen-111.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    console.log('API response status received:', response.status);
    const data = await response.json();
    console.log('API response data received:', data);

    if (!response.ok) {
      throw new Error(`API Error: ${data.error || 'Unknown error'}`);
    }

    const generatedContent = data.specification || 'No specification generated';
    console.log('Generated content extracted:', generatedContent);

    console.log('Saving generated content to localStorage');
    localStorage.setItem('generatedContent', generatedContent);

    if (typeof confetti === 'function') {
      console.log('Triggering confetti');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    console.log('Redirecting to result-novice.html');
    window.location.href = 'result-novice.html';
  } catch (err) {
    console.error('Error in generateSpecificationFromProcessingNoviceJs:', err.message);
    alert('Failed to generate specification: ' + err.message);
    const goButton = document.getElementById("goButton");
    const loadingSpinner = document.getElementById("loadingSpinner");
    if (goButton) goButton.disabled = false;
    if (loadingSpinner) loadingSpinner.style.display = "none";
  }
}

document.addEventListener('DOMContentLoaded', () => {
console.log('processing-novice.js loaded, setting generateSpecificationOriginal');
window.generateSpecificationOriginal = generateSpecificationFromProcessingNoviceJs;
});